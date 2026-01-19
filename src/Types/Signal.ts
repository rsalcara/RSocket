import { proto } from '../../WAProto/index.js'

/** LID (Link ID) to Phone Number mapping */
export type LIDMapping = {
	lid: string
	pn: string
}

/** LID mapping storage interface */
export type LIDMappingStore = {
	getLIDPNMappings(lids: string[]): Promise<LIDMapping[]>
	storeLIDPNMappings(mappings: LIDMapping[]): Promise<void>
	/** Get phone number for a single LID */
	getPNForLID(lid: string): Promise<string | undefined>
	/** Get LID for a single phone number */
	getLIDForPN(pn: string): Promise<string | undefined>
}

type DecryptGroupSignalOpts = {
	group: string
	authorJid: string
	msg: Uint8Array
}

type ProcessSenderKeyDistributionMessageOpts = {
	item: proto.Message.ISenderKeyDistributionMessage
	authorJid: string
}

type DecryptSignalProtoOpts = {
	jid: string
	type: 'pkmsg' | 'msg'
	ciphertext: Uint8Array
}

type EncryptMessageOpts = {
	jid: string
	data: Uint8Array
}

type EncryptGroupMessageOpts = {
	group: string
	data: Uint8Array
	meId: string
}

type PreKey = {
	keyId: number
	publicKey: Uint8Array
}

type SignedPreKey = PreKey & {
	signature: Uint8Array
}

type E2ESession = {
	registrationId: number
	identityKey: Uint8Array
	signedPreKey: SignedPreKey
	preKey: PreKey
}

type E2ESessionOpts = {
	jid: string
	session: E2ESession
}

export type SignalRepository = {
	decryptGroupMessage(opts: DecryptGroupSignalOpts): Promise<Uint8Array>
	processSenderKeyDistributionMessage(opts: ProcessSenderKeyDistributionMessageOpts): Promise<void>
	decryptMessage(opts: DecryptSignalProtoOpts): Promise<Uint8Array>
	encryptMessage(opts: EncryptMessageOpts): Promise<{
		type: 'pkmsg' | 'msg'
		ciphertext: Uint8Array
	}>
	encryptGroupMessage(opts: EncryptGroupMessageOpts): Promise<{
		senderKeyDistributionMessage: Uint8Array
		ciphertext: Uint8Array
	}>
	injectE2ESession(opts: E2ESessionOpts): Promise<void>
	jidToSignalProtocolAddress(jid: string): string
	/** LID mapping storage (optional, for LID migration support) */
	lidMapping: LIDMappingStore
	/** Migrate session from phone number to LID with bulk support */
	migrateSession(fromJid: string, toJid: string): Promise<{ migrated: number; skipped: number; total: number }>
	/** Validate if a session exists for a JID */
	validateSession(jid: string): Promise<{ exists: boolean; reason?: string }>
	/** Delete sessions for multiple JIDs */
	deleteSession(jids: string[]): Promise<void>
}

/**
 * Alias for upstream compatibility.
 * In upstream, SignalRepositoryWithLIDStore extends SignalRepository with lidMapping.
 * Our fork already includes lidMapping in SignalRepository, so this is just an alias.
 */
export type SignalRepositoryWithLIDStore = SignalRepository
