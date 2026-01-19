import { Boom } from '@hapi/boom'
import { proto } from '../../WAProto/index.mjs'
import { SignalRepository, WAMessage, WAMessageKey } from '../Types'
import {
	areJidsSameUser,
	BinaryNode,
	isHostedLidUser,
	isHostedPnUser,
	isJidBroadcast,
	isJidGroup,
	isJidMetaIa,
	isJidNewsletter,
	isJidStatusBroadcast,
	isJidUser,
	isLidUser,
	isPnUser,
	jidDecode,
	jidNormalizedUser
} from '../WABinary'
import { unpadRandomMax16 } from './generics'
import { ILogger } from './logger'
import caches from './cache-utils'

export const NO_MESSAGE_FOUND_ERROR_TEXT = 'Message absent from node'
export const MISSING_KEYS_ERROR_TEXT = 'Key used already or never filled'

export const NACK_REASONS = {
	ParsingError: 487,
	UnrecognizedStanza: 488,
	UnrecognizedStanzaClass: 489,
	UnrecognizedStanzaType: 490,
	InvalidProtobuf: 491,
	InvalidHostedCompanionStanza: 493,
	MissingMessageSecret: 495,
	SignalErrorOldCounter: 496,
	MessageDeletedOnPeer: 499,
	UnhandledError: 500,
	UnsupportedAdminRevoke: 550,
	UnsupportedLIDGroup: 551,
	DBOperationFailed: 552
}

// Retry configuration for failed decryption
export const DECRYPTION_RETRY_CONFIG = {
	maxRetries: 3,
	baseDelayMs: 100,
	sessionRecordErrors: ['No session record', 'SessionError: No session record']
}

/**
 * Get the JID to use for decryption - resolves PN to LID if mapping exists
 */
export const getDecryptionJid = async (sender: string, repository: SignalRepository): Promise<string> => {
	if (isLidUser(sender) || isHostedLidUser(sender)) {
		return sender
	}

	const mapped = await repository.lidMapping.getLIDForPN(sender)
	return mapped || sender
}

/**
 * Store LID mapping from message envelope if present
 */
const storeMappingFromEnvelope = async (
	stanza: BinaryNode,
	sender: string,
	repository: SignalRepository,
	decryptionJid: string,
	logger: ILogger
): Promise<void> => {
	// TODO: Handle hosted IDs
	const { senderAlt } = extractAddressingContext(stanza)

	if (senderAlt && isLidUser(senderAlt) && isPnUser(sender) && decryptionJid === sender) {
		try {
			await repository.lidMapping.storeLIDPNMappings([{ lid: senderAlt, pn: sender }])
			await repository.migrateSession(sender, senderAlt)
			logger.debug({ sender, senderAlt }, 'Stored LID mapping from envelope')
		} catch (error) {
			logger.warn({ sender, senderAlt, error }, 'Failed to store LID mapping')
		}
	}
}

/**
 * Utility function to check if an error is related to missing session record
 */
function isSessionRecordError(error: any): boolean {
	const errorMessage = error?.message || error?.toString() || ''
	return DECRYPTION_RETRY_CONFIG.sessionRecordErrors.some(errorPattern => errorMessage.includes(errorPattern))
}

type MessageType =
	| 'chat'
	| 'peer_broadcast'
	| 'other_broadcast'
	| 'group'
	| 'direct_peer_status'
	| 'other_status'
	| 'newsletter'

/**
 * Extract addressing context from a message stanza
 * Determines if message is LID or PN addressed and extracts alternate identifiers
 */
export const extractAddressingContext = (stanza: BinaryNode) => {
	let senderAlt: string | undefined
	let recipientAlt: string | undefined

	const sender = stanza.attrs.participant || stanza.attrs.from
	const addressingMode = stanza.attrs.addressing_mode || (sender?.endsWith('lid') ? 'lid' : 'pn')

	if (addressingMode === 'lid') {
		// Message is LID-addressed: sender is LID, extract corresponding PN
		senderAlt = stanza.attrs.participant_pn || stanza.attrs.sender_pn || stanza.attrs.peer_recipient_pn
		recipientAlt = stanza.attrs.recipient_pn
	} else {
		// Message is PN-addressed: sender is PN, extract corresponding LID
		senderAlt = stanza.attrs.participant_lid || stanza.attrs.sender_lid || stanza.attrs.peer_recipient_lid
		recipientAlt = stanza.attrs.recipient_lid
	}

	return {
		addressingMode,
		senderAlt,
		recipientAlt
	}
}

/**
 * Decode the received node as a message.
 * @note this will only parse the message, not decrypt it
 */
export function decodeMessageNode(stanza: BinaryNode, meId: string, meLid: string) {
	let msgType: MessageType
	let chatId: string
	let author: string

	const msgId = stanza.attrs.id
	const from = stanza.attrs.from
	const participant: string | undefined = stanza.attrs.participant
	const isMe = (jid: string) => areJidsSameUser(jid, meId)
	const isMeLid = (jid: string) => areJidsSameUser(jid, meLid)
	const participant_lid: string | undefined = stanza.attrs.participant_lid
	const participant_pn: string | undefined = stanza?.attrs?.participant_pn
	const sender_lid: string | undefined = stanza.attrs.sender_lid
	const recipient: string | undefined = stanza.attrs.recipient
	const sender_pn: string | undefined = stanza?.attrs?.sender_pn
	const peer_recipient_pn: string | undefined = stanza?.attrs?.peer_recipient_pn
	const peer_recipient_lid :string | undefined = stanza?.attrs?.peer_recipient_lid
	const fromMe = (isLidUser(from) || isLidUser(participant) ? isMeLid : isMe)(stanza.attrs.participant || stanza.attrs.from);

		if (isJidUser(from) || isLidUser(from)) {
		if (recipient && !isJidMetaIa(recipient)) {
			if (!isMe(from) && !isMeLid(from)) {
			throw new Boom('recipient present, but msg not from me', { data: stanza });
			}
			chatId = recipient;
		} else {
			chatId = from || sender_lid;
		}

		msgType = 'chat';

		const deviceOrigem = jidDecode(from)?.device;

		if (fromMe) {
			const userDestino = jidDecode(jidNormalizedUser(meLid))?.user;
			author = deviceOrigem
			? `${userDestino}:${deviceOrigem}@lid`
			: `${userDestino}@lid`;			
		} else {
			if (!sender_lid) {
			author = from;
			} else {
			const userDestino = jidDecode(sender_lid)?.user;
			author = deviceOrigem
				? `${userDestino}:${deviceOrigem}@lid`
				: `${userDestino}@lid`;
			}
		}
		if(sender_lid && sender_pn ){
		const verify = caches.lidCache.get(jidNormalizedUser(sender_pn));
		 if(!verify)
		 {
			caches.lidCache.set(jidNormalizedUser(sender_pn), jidNormalizedUser(sender_lid))
		 }
		}
	}
 else if (isJidGroup(from)) {
		if (!participant) {
			throw new Boom('No participant in group message')
		}

		msgType = 'group'
		chatId = from || sender_lid
		const deviceOrigem = jidDecode(participant)?.device;
		if (fromMe) {
			const userDestino = jidDecode(jidNormalizedUser(meLid))?.user;
			author = deviceOrigem
			? `${userDestino}:${deviceOrigem}@lid`
			: `${userDestino}@lid`;
		} else {
			if (!participant_lid) {
			author = participant;
			} else {
			const userDestino = jidDecode(participant_lid)?.user;
			author = deviceOrigem
				? `${userDestino}:${deviceOrigem}@lid`
				: `${userDestino}@lid`;
			}
		}

	} else if (isJidBroadcast(from)) {
		if (!participant && participant_lid) {
			throw new Boom('No participant in group message')
		}

		const isParticipantMe = isMe(participant)
		if (isJidStatusBroadcast(from)) {
			msgType = isParticipantMe ? 'direct_peer_status' : 'other_status'
		} else {
			msgType = isParticipantMe ? 'peer_broadcast' : 'other_broadcast'
		}

		chatId = from
		author = participant_lid || participant	 		
	
	} else if (isJidNewsletter(from)) {
		msgType = 'newsletter'
		chatId = from
		author = from
	} else {
		throw new Boom('Unknown message type', { data: stanza })
	}

	
	const pushname = stanza?.attrs?.notify

	const key: WAMessageKey = {
		remoteJid: chatId,
		fromMe,
		id: msgId,
		...(sender_lid && { sender_lid }),
		...(participant && { participant }),
		...(participant_pn && { participant_pn }),
		...(participant_lid && { participant_lid }),
		...(sender_pn && { sender_pn }),
		...(peer_recipient_pn && { peer_recipient_pn }),
		...(peer_recipient_lid && { peer_recipient_lid }),
	};

	const fullMessage: WAMessage = {
		key,
		messageTimestamp: +stanza.attrs.t,
		pushName: pushname,
		broadcast: isJidBroadcast(from)
	}

	if (key.fromMe) {
		fullMessage.status = proto.WebMessageInfo.Status.SERVER_ACK
	}

	return {
		fullMessage,
		author,
		sender: msgType === 'chat' ? author : chatId
	}
}

export const decryptMessageNode = (
	stanza: BinaryNode,
	meId: string,
	meLid: string,
	repository: SignalRepository,
	logger: ILogger
) => {
	const { fullMessage, author, sender } = decodeMessageNode(stanza, meId, meLid)
	return {
		fullMessage,
		category: stanza.attrs.category,
		author,
		async decrypt() {
			let decryptables = 0
			if (Array.isArray(stanza.content)) {
				for (const { tag, attrs, content } of stanza.content) {
					if (tag === 'verified_name' && content instanceof Uint8Array) {
						const cert = proto.VerifiedNameCertificate.decode(content)
						const details = proto.VerifiedNameCertificate.Details.decode(cert.details!)
						fullMessage.verifiedBizName = details.verifiedName
					}

					// Handle view_once messages
					if (tag === 'unavailable' && attrs.type === 'view_once') {
						fullMessage.key.isViewOnce = true
					}

					// Track retry count
					if (attrs.count && tag === 'enc') {
						fullMessage.retryCount = Number(attrs.count)
					}

					if (tag !== 'enc' && tag !== 'plaintext') {
						continue
					}

					if (!(content instanceof Uint8Array)) {
						continue
					}

					decryptables += 1

					let msgBuffer: Uint8Array

					// Get the appropriate JID for decryption (resolves PN to LID if needed)
					const decryptionJid = await getDecryptionJid(author, repository)

					// Store LID mapping from envelope if present (for non-plaintext messages)
					if (tag !== 'plaintext') {
						await storeMappingFromEnvelope(stanza, author, repository, decryptionJid, logger)
					}

					try {
						const e2eType = tag === 'plaintext' ? 'plaintext' : attrs.type
						switch (e2eType) {
							case 'skmsg':
								msgBuffer = await repository.decryptGroupMessage({
									group: sender,
									authorJid: author,
									msg: content
								})
								break
							case 'pkmsg':
							case 'msg':
								msgBuffer = await repository.decryptMessage({
									jid: decryptionJid,
									type: e2eType,
									ciphertext: content
								})
								break
							case 'plaintext':
								msgBuffer = content
								break
							default:
								throw new Error(`Unknown e2e type: ${e2eType}`)
						}

						let msg: proto.IMessage = proto.Message.decode(
							e2eType !== 'plaintext' ? unpadRandomMax16(msgBuffer) : msgBuffer
						)
						msg = msg.deviceSentMessage?.message || msg
						if (msg.senderKeyDistributionMessage) {
							//eslint-disable-next-line max-depth
							try {
								await repository.processSenderKeyDistributionMessage({
									authorJid: author,
									item: msg.senderKeyDistributionMessage
								})
							} catch (err) {
								logger.error({ key: fullMessage.key, err }, 'failed to process sender key distribution message')
							}
						}

						if (fullMessage.message) {
							Object.assign(fullMessage.message, msg)
						} else {
							fullMessage.message = msg
						}
					} catch (err: any) {
						const errorContext = {
							key: fullMessage.key,
							err,
							messageType: tag === 'plaintext' ? 'plaintext' : attrs.type,
							sender,
							author,
							isSessionRecordError: isSessionRecordError(err)
						}

						logger.error(errorContext, 'failed to decrypt message')

						fullMessage.messageStubType = proto.WebMessageInfo.StubType.CIPHERTEXT
						fullMessage.messageStubParameters = [err.message?.toString()]
					}
				}
			}

			// if nothing was found to decrypt
			if (!decryptables && !fullMessage.key?.isViewOnce) {
				fullMessage.messageStubType = proto.WebMessageInfo.StubType.CIPHERTEXT
				fullMessage.messageStubParameters = [NO_MESSAGE_FOUND_ERROR_TEXT]
			}
		}
	}
}
