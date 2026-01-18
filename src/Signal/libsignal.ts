/* @ts-ignore */
import * as libsignal from 'libsignal'
import { LRUCache } from 'lru-cache'
import { SignalAuthState } from '../Types'
import { LIDMapping, LIDMappingStore, SignalRepository } from '../Types/Signal'
import { PnFromLIDUSyncFn } from '../Types/Socket'
import { generateSignalPubKey } from '../Utils'
import { ILogger } from '../Utils/logger'
import {
	isHostedLidUser,
	isHostedPnUser,
	isLidUser,
	isPnUser,
	jidDecode,
	jidEncode
} from '../WABinary'
import type { SenderKeyStore } from './Group/group_cipher'
import { SenderKeyName } from './Group/sender-key-name'
import { SenderKeyRecord } from './Group/sender-key-record'
import { GroupCipher, GroupSessionBuilder, SenderKeyDistributionMessage } from './Group'

export function makeLibSignalRepository(
	auth: SignalAuthState,
	logger?: ILogger,
	pnFromLIDUSync?: PnFromLIDUSyncFn
): SignalRepository {
	const storage: SenderKeyStore = signalStorage(auth)
	const parsedKeys = auth.keys

	// LRU cache for migrated sessions to prevent re-migration
	const migratedSessionCache = new LRUCache<string, boolean>({
		max: 10000,
		ttl: 1000 * 60 * 60 // 1 hour
	})

	// In-memory LID mapping cache
	const lidMappingCache = new Map<string, string>()

	// LID mapping store implementation
	const lidMapping: LIDMappingStore = {
		async getLIDPNMappings(lids: string[]): Promise<LIDMapping[]> {
			const result: LIDMapping[] = []
			const missingLids: string[] = []

			// Check cache first
			for (const lid of lids) {
				const pn = lidMappingCache.get(lid)
				if (pn) {
					result.push({ lid, pn })
				} else {
					missingLids.push(lid)
				}
			}

			// If we have missing LIDs and a USync function, fetch them
			if (missingLids.length > 0 && pnFromLIDUSync) {
				try {
					const fetchedMappings = await pnFromLIDUSync(missingLids)
					if (fetchedMappings) {
						for (const mapping of fetchedMappings) {
							lidMappingCache.set(mapping.lid, mapping.pn)
							result.push(mapping)
						}
					}
				} catch (err) {
					logger?.warn({ err, lids: missingLids }, 'Failed to fetch LID mappings via USync')
				}
			}

			return result
		},
		async storeLIDPNMappings(mappings: LIDMapping[]): Promise<void> {
			for (const mapping of mappings) {
				lidMappingCache.set(mapping.lid, mapping.pn)
			}

			// Also store in keys for persistence
			const lidMappingData: Record<string, string> = {}
			for (const mapping of mappings) {
				lidMappingData[mapping.lid] = mapping.pn
			}

			try {
				await auth.keys.set({ 'lid-mapping': lidMappingData })
			} catch (err) {
				logger?.warn({ err }, 'Failed to persist LID mappings')
			}
		},
		async getPNForLID(lid: string): Promise<string | undefined> {
			// Check cache first
			const cachedPn = lidMappingCache.get(lid)
			if (cachedPn) {
				return cachedPn
			}

			// Try to fetch from USync if available
			if (pnFromLIDUSync) {
				try {
					const mappings = await pnFromLIDUSync([lid])
					if (mappings && mappings.length > 0) {
						lidMappingCache.set(lid, mappings[0].pn)
						return mappings[0].pn
					}
				} catch (err) {
					logger?.warn({ err, lid }, 'Failed to fetch PN for LID via USync')
				}
			}

			return undefined
		}
	}

	// Session migration function - enhanced with bulk migration support
	const migrateSession = async (
		fromJid: string,
		toJid: string
	): Promise<{ migrated: number; skipped: number; total: number }> => {
		if (!fromJid || (!isLidUser(toJid) && !isHostedLidUser(toJid))) {
			return { migrated: 0, skipped: 0, total: 0 }
		}

		// Only support PN to LID migration
		if (!isPnUser(fromJid) && !isHostedPnUser(fromJid)) {
			return { migrated: 0, skipped: 0, total: 1 }
		}

		const { user } = jidDecode(fromJid)!

		logger?.debug({ fromJid }, 'bulk device migration - loading all user devices')

		// Get user's device list from storage
		const { [user]: userDevices } = await parsedKeys.get('device-list', [user])
		if (!userDevices) {
			return { migrated: 0, skipped: 0, total: 0 }
		}

		const { device: fromDevice } = jidDecode(fromJid)!
		const fromDeviceStr = fromDevice?.toString() || '0'
		if (!userDevices.includes(fromDeviceStr)) {
			userDevices.push(fromDeviceStr)
		}

		// Filter out cached devices before database fetch
		const uncachedDevices = userDevices.filter((device: string) => {
			const deviceKey = `${user}.${device}`
			return !migratedSessionCache.has(deviceKey)
		})

		// Bulk check session existence only for uncached devices
		const deviceSessionKeys = uncachedDevices.map((device: string) => `${user}.${device}`)
		const existingSessions = await parsedKeys.get('session', deviceSessionKeys)

		// Convert existing sessions to JIDs (only migrate sessions that exist)
		const deviceJids: string[] = []
		for (const [sessionKey, sessionData] of Object.entries(existingSessions)) {
			if (sessionData) {
				const deviceStr = sessionKey.split('.')[1]
				if (!deviceStr) continue
				const deviceNum = parseInt(deviceStr)
				let jid = deviceNum === 0 ? `${user}@s.whatsapp.net` : `${user}:${deviceNum}@s.whatsapp.net`
				if (deviceNum === 99) {
					jid = `${user}:99@hosted`
				}

				deviceJids.push(jid)
			}
		}

		if (deviceJids.length === 0) {
			return { migrated: 0, skipped: 0, total: userDevices.length }
		}

		let migrated = 0
		let skipped = 0
		const sessionUpdates: Record<string, Uint8Array> = {}

		for (const jid of deviceJids) {
			const { device } = jidDecode(jid)!
			const cacheKey = `${user}.${device || 0}`

			// Skip if already migrated
			if (migratedSessionCache.has(cacheKey)) {
				skipped++
				continue
			}

			// Get source session
			const fromAddr = jidToSignalProtocolAddress(jid).toString()
			const { [fromAddr]: sessionData } = await parsedKeys.get('session', [fromAddr])

			if (sessionData) {
				// Create LID target address
				const { user: lidUser } = jidDecode(toJid)!
				const toJidWithDevice = device ? `${lidUser}:${device}@lid` : `${lidUser}@lid`
				const toAddr = jidToSignalProtocolAddress(toJidWithDevice).toString()

				sessionUpdates[toAddr] = sessionData
				migrated++
				migratedSessionCache.set(cacheKey, true)
			}
		}

		// Bulk write all session updates
		if (Object.keys(sessionUpdates).length > 0) {
			await parsedKeys.set({ session: sessionUpdates })
		}

		logger?.debug({ fromJid, toJid, migrated, skipped, total: deviceJids.length }, 'Session migration completed')

		return { migrated, skipped, total: deviceJids.length }
	}

	// Validate session existence
	const validateSession = async (jid: string): Promise<{ exists: boolean; reason?: string }> => {
		try {
			const addr = jidToSignalProtocolAddress(jid)
			const addrStr = addr.toString()
			const { [addrStr]: sessionData } = await parsedKeys.get('session', [addrStr])

			if (!sessionData) {
				return { exists: false, reason: 'no session' }
			}

			// Session exists in storage
			return { exists: true }
		} catch (error) {
			return { exists: false, reason: 'validation error' }
		}
	}

	// Delete sessions in bulk
	const deleteSession = async (jids: string[]): Promise<void> => {
		if (!jids.length) return

		// Convert JIDs to signal addresses and prepare for bulk deletion
		const sessionUpdates: { [key: string]: null } = {}
		jids.forEach(jid => {
			const addr = jidToSignalProtocolAddress(jid)
			sessionUpdates[addr.toString()] = null
		})

		// Single transaction for all deletions
		await parsedKeys.set({ session: sessionUpdates })
	}

	return {
		decryptGroupMessage({ group, authorJid, msg }) {
			const senderName = jidToSignalSenderKeyName(group, authorJid)
			const cipher = new GroupCipher(storage, senderName)

			return cipher.decrypt(msg)
		},
		async processSenderKeyDistributionMessage({ item, authorJid }) {
			const builder = new GroupSessionBuilder(storage)
			if (!item.groupId) {
				throw new Error('Group ID is required for sender key distribution message')
			}

			const senderName = jidToSignalSenderKeyName(item.groupId, authorJid)

			const senderMsg = new SenderKeyDistributionMessage(
				null,
				null,
				null,
				null,
				item.axolotlSenderKeyDistributionMessage
			)
			const senderNameStr = senderName.toString()
			const { [senderNameStr]: senderKey } = await auth.keys.get('sender-key', [senderNameStr])
			if (!senderKey) {
				await storage.storeSenderKey(senderName, new SenderKeyRecord())
			}

			await builder.process(senderName, senderMsg)
		},
		async decryptMessage({ jid, type, ciphertext }) {
			const addr = jidToSignalProtocolAddress(jid)
			const session = new libsignal.SessionCipher(storage, addr)
			let result: Buffer
			switch (type) {
				case 'pkmsg':
					result = await session.decryptPreKeyWhisperMessage(ciphertext)
					break
				case 'msg':
					result = await session.decryptWhisperMessage(ciphertext)
					break
				default:
					throw new Error(`Unknown message type: ${type}`)
			}

			return result
		},
		async encryptMessage({ jid, data }) {
			const addr = jidToSignalProtocolAddress(jid)
			const cipher = new libsignal.SessionCipher(storage, addr)

			const { type: sigType, body } = await cipher.encrypt(data)
			const type = sigType === 3 ? 'pkmsg' : 'msg'
			return { type, ciphertext: Buffer.from(body, 'binary') }
		},
		async encryptGroupMessage({ group, meId, data }) {
			const senderName = jidToSignalSenderKeyName(group, meId)
			const builder = new GroupSessionBuilder(storage)

			const senderNameStr = senderName.toString()
			const { [senderNameStr]: senderKey } = await auth.keys.get('sender-key', [senderNameStr])
			if (!senderKey) {
				await storage.storeSenderKey(senderName, new SenderKeyRecord())
			}

			const senderKeyDistributionMessage = await builder.create(senderName)
			const session = new GroupCipher(storage, senderName)
			const ciphertext = await session.encrypt(data)

			return {
				ciphertext,
				senderKeyDistributionMessage: senderKeyDistributionMessage.serialize()
			}
		},
		async injectE2ESession({ jid, session }) {
			const cipher = new libsignal.SessionBuilder(storage, jidToSignalProtocolAddress(jid))
			await cipher.initOutgoing(session)
		},
		jidToSignalProtocolAddress(jid) {
			return jidToSignalProtocolAddress(jid).toString()
		},
		lidMapping,
		migrateSession,
		validateSession,
		deleteSession
	}
}

const jidToSignalProtocolAddress = (jid: string) => {
	const { user, device } = jidDecode(jid)!
	return new libsignal.ProtocolAddress(user, device || 0)
}

const jidToSignalSenderKeyName = (group: string, user: string): SenderKeyName => {
	return new SenderKeyName(group, jidToSignalProtocolAddress(user))
}

function signalStorage({ creds, keys }: SignalAuthState): SenderKeyStore & Record<string, any> {
	return {
		loadSession: async (id: string) => {
			const { [id]: sess } = await keys.get('session', [id])
			if (sess) {
				return libsignal.SessionRecord.deserialize(sess)
			}
		},
		storeSession: async (id: string, session: libsignal.SessionRecord) => {
			await keys.set({ session: { [id]: session.serialize() } })
		},
		isTrustedIdentity: () => {
			return true
		},
		loadPreKey: async (id: number | string) => {
			const keyId = id.toString()
			const { [keyId]: key } = await keys.get('pre-key', [keyId])
			if (key) {
				return {
					privKey: Buffer.from(key.private),
					pubKey: Buffer.from(key.public)
				}
			}
		},
		removePreKey: (id: number) => keys.set({ 'pre-key': { [id]: null } }),
		loadSignedPreKey: () => {
			const key = creds.signedPreKey
			return {
				privKey: Buffer.from(key.keyPair.private),
				pubKey: Buffer.from(key.keyPair.public)
			}
		},
		loadSenderKey: async (senderKeyName: SenderKeyName) => {
			const keyId = senderKeyName.toString()
			const { [keyId]: key } = await keys.get('sender-key', [keyId])
			if (key) {
				return SenderKeyRecord.deserialize(key)
			}

			return new SenderKeyRecord()
		},
		storeSenderKey: async (senderKeyName: SenderKeyName, key: SenderKeyRecord) => {
			const keyId = senderKeyName.toString()
			const serialized = JSON.stringify(key.serialize())
			await keys.set({ 'sender-key': { [keyId]: Buffer.from(serialized, 'utf-8') } })
		},
		getOurRegistrationId: () => creds.registrationId,
		getOurIdentity: () => {
			const { signedIdentityKey } = creds
			return {
				privKey: Buffer.from(signedIdentityKey.private),
				pubKey: generateSignalPubKey(signedIdentityKey.public)
			}
		}
	}
}
