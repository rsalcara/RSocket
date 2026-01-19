"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptMessageNode = exports.extractAddressingContext = exports.getDecryptionJid = exports.DECRYPTION_RETRY_CONFIG = exports.NACK_REASONS = exports.MISSING_KEYS_ERROR_TEXT = exports.NO_MESSAGE_FOUND_ERROR_TEXT = void 0;
exports.decodeMessageNode = decodeMessageNode;
const boom_1 = require("@hapi/boom");
const WAProto_1 = require("../../WAProto");
const WABinary_1 = require("../WABinary");
const generics_1 = require("./generics");
const cache_utils_1 = __importDefault(require("./cache-utils"));
exports.NO_MESSAGE_FOUND_ERROR_TEXT = 'Message absent from node';
exports.MISSING_KEYS_ERROR_TEXT = 'Key used already or never filled';
exports.NACK_REASONS = {
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
};
// Retry configuration for failed decryption
exports.DECRYPTION_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 100,
    sessionRecordErrors: ['No session record', 'SessionError: No session record']
};
/**
 * Get the JID to use for decryption - resolves PN to LID if mapping exists
 */
const getDecryptionJid = async (sender, repository) => {
    if ((0, WABinary_1.isLidUser)(sender) || (0, WABinary_1.isHostedLidUser)(sender)) {
        return sender;
    }
    const mapped = await repository.lidMapping.getLIDForPN(sender);
    return mapped || sender;
};
exports.getDecryptionJid = getDecryptionJid;
/**
 * Store LID mapping from message envelope if present
 */
const storeMappingFromEnvelope = async (stanza, sender, repository, decryptionJid, logger) => {
    // TODO: Handle hosted IDs
    const { senderAlt } = (0, exports.extractAddressingContext)(stanza);
    if (senderAlt && (0, WABinary_1.isLidUser)(senderAlt) && (0, WABinary_1.isPnUser)(sender) && decryptionJid === sender) {
        try {
            await repository.lidMapping.storeLIDPNMappings([{ lid: senderAlt, pn: sender }]);
            await repository.migrateSession(sender, senderAlt);
            logger.debug({ sender, senderAlt }, 'Stored LID mapping from envelope');
        }
        catch (error) {
            logger.warn({ sender, senderAlt, error }, 'Failed to store LID mapping');
        }
    }
};
/**
 * Utility function to check if an error is related to missing session record
 */
function isSessionRecordError(error) {
    const errorMessage = error?.message || error?.toString() || '';
    return exports.DECRYPTION_RETRY_CONFIG.sessionRecordErrors.some(errorPattern => errorMessage.includes(errorPattern));
}
/**
 * Extract addressing context from a message stanza
 * Determines if message is LID or PN addressed and extracts alternate identifiers
 */
const extractAddressingContext = (stanza) => {
    let senderAlt;
    let recipientAlt;
    const sender = stanza.attrs.participant || stanza.attrs.from;
    const addressingMode = stanza.attrs.addressing_mode || (sender?.endsWith('lid') ? 'lid' : 'pn');
    if (addressingMode === 'lid') {
        // Message is LID-addressed: sender is LID, extract corresponding PN
        senderAlt = stanza.attrs.participant_pn || stanza.attrs.sender_pn || stanza.attrs.peer_recipient_pn;
        recipientAlt = stanza.attrs.recipient_pn;
    }
    else {
        // Message is PN-addressed: sender is PN, extract corresponding LID
        senderAlt = stanza.attrs.participant_lid || stanza.attrs.sender_lid || stanza.attrs.peer_recipient_lid;
        recipientAlt = stanza.attrs.recipient_lid;
    }
    return {
        addressingMode,
        senderAlt,
        recipientAlt
    };
};
exports.extractAddressingContext = extractAddressingContext;
/**
 * Decode the received node as a message.
 * @note this will only parse the message, not decrypt it
 */
function decodeMessageNode(stanza, meId, meLid) {
    let msgType;
    let chatId;
    let author;
    const msgId = stanza.attrs.id;
    const from = stanza.attrs.from;
    const participant = stanza.attrs.participant;
    const isMe = (jid) => (0, WABinary_1.areJidsSameUser)(jid, meId);
    const isMeLid = (jid) => (0, WABinary_1.areJidsSameUser)(jid, meLid);
    const participant_lid = stanza.attrs.participant_lid;
    const participant_pn = stanza?.attrs?.participant_pn;
    const sender_lid = stanza.attrs.sender_lid;
    const recipient = stanza.attrs.recipient;
    const sender_pn = stanza?.attrs?.sender_pn;
    const peer_recipient_pn = stanza?.attrs?.peer_recipient_pn;
    const peer_recipient_lid = stanza?.attrs?.peer_recipient_lid;
    const fromMe = ((0, WABinary_1.isLidUser)(from) || (0, WABinary_1.isLidUser)(participant) ? isMeLid : isMe)(stanza.attrs.participant || stanza.attrs.from);
    if ((0, WABinary_1.isJidUser)(from) || (0, WABinary_1.isLidUser)(from)) {
        if (recipient && !(0, WABinary_1.isJidMetaIa)(recipient)) {
            if (!isMe(from) && !isMeLid(from)) {
                throw new boom_1.Boom('recipient present, but msg not from me', { data: stanza });
            }
            chatId = recipient;
        }
        else {
            chatId = from || sender_lid;
        }
        msgType = 'chat';
        const deviceOrigem = (0, WABinary_1.jidDecode)(from)?.device;
        if (fromMe) {
            const userDestino = (0, WABinary_1.jidDecode)((0, WABinary_1.jidNormalizedUser)(meLid))?.user;
            author = deviceOrigem
                ? `${userDestino}:${deviceOrigem}@lid`
                : `${userDestino}@lid`;
        }
        else {
            if (!sender_lid) {
                author = from;
            }
            else {
                const userDestino = (0, WABinary_1.jidDecode)(sender_lid)?.user;
                author = deviceOrigem
                    ? `${userDestino}:${deviceOrigem}@lid`
                    : `${userDestino}@lid`;
            }
        }
        if (sender_lid && sender_pn) {
            const verify = cache_utils_1.default.lidCache.get((0, WABinary_1.jidNormalizedUser)(sender_pn));
            if (!verify) {
                cache_utils_1.default.lidCache.set((0, WABinary_1.jidNormalizedUser)(sender_pn), (0, WABinary_1.jidNormalizedUser)(sender_lid));
            }
        }
    }
    else if ((0, WABinary_1.isJidGroup)(from)) {
        if (!participant) {
            throw new boom_1.Boom('No participant in group message');
        }
        msgType = 'group';
        chatId = from || sender_lid;
        const deviceOrigem = (0, WABinary_1.jidDecode)(participant)?.device;
        if (fromMe) {
            const userDestino = (0, WABinary_1.jidDecode)((0, WABinary_1.jidNormalizedUser)(meLid))?.user;
            author = deviceOrigem
                ? `${userDestino}:${deviceOrigem}@lid`
                : `${userDestino}@lid`;
        }
        else {
            if (!participant_lid) {
                author = participant;
            }
            else {
                const userDestino = (0, WABinary_1.jidDecode)(participant_lid)?.user;
                author = deviceOrigem
                    ? `${userDestino}:${deviceOrigem}@lid`
                    : `${userDestino}@lid`;
            }
        }
    }
    else if ((0, WABinary_1.isJidBroadcast)(from)) {
        if (!participant && participant_lid) {
            throw new boom_1.Boom('No participant in group message');
        }
        const isParticipantMe = isMe(participant);
        if ((0, WABinary_1.isJidStatusBroadcast)(from)) {
            msgType = isParticipantMe ? 'direct_peer_status' : 'other_status';
        }
        else {
            msgType = isParticipantMe ? 'peer_broadcast' : 'other_broadcast';
        }
        chatId = from;
        author = participant_lid || participant;
    }
    else if ((0, WABinary_1.isJidNewsletter)(from)) {
        msgType = 'newsletter';
        chatId = from;
        author = from;
    }
    else {
        throw new boom_1.Boom('Unknown message type', { data: stanza });
    }
    const pushname = stanza?.attrs?.notify;
    const key = {
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
    const fullMessage = {
        key,
        messageTimestamp: +stanza.attrs.t,
        pushName: pushname,
        broadcast: (0, WABinary_1.isJidBroadcast)(from)
    };
    if (key.fromMe) {
        fullMessage.status = WAProto_1.proto.WebMessageInfo.Status.SERVER_ACK;
    }
    return {
        fullMessage,
        author,
        sender: msgType === 'chat' ? author : chatId
    };
}
const decryptMessageNode = (stanza, meId, meLid, repository, logger) => {
    const { fullMessage, author, sender } = decodeMessageNode(stanza, meId, meLid);
    return {
        fullMessage,
        category: stanza.attrs.category,
        author,
        async decrypt() {
            let decryptables = 0;
            if (Array.isArray(stanza.content)) {
                for (const { tag, attrs, content } of stanza.content) {
                    if (tag === 'verified_name' && content instanceof Uint8Array) {
                        const cert = WAProto_1.proto.VerifiedNameCertificate.decode(content);
                        const details = WAProto_1.proto.VerifiedNameCertificate.Details.decode(cert.details);
                        fullMessage.verifiedBizName = details.verifiedName;
                    }
                    // Handle view_once messages
                    if (tag === 'unavailable' && attrs.type === 'view_once') {
                        fullMessage.key.isViewOnce = true;
                    }
                    // Track retry count
                    if (attrs.count && tag === 'enc') {
                        fullMessage.retryCount = Number(attrs.count);
                    }
                    if (tag !== 'enc' && tag !== 'plaintext') {
                        continue;
                    }
                    if (!(content instanceof Uint8Array)) {
                        continue;
                    }
                    decryptables += 1;
                    let msgBuffer;
                    // Get the appropriate JID for decryption (resolves PN to LID if needed)
                    const decryptionJid = await (0, exports.getDecryptionJid)(author, repository);
                    // Store LID mapping from envelope if present (for non-plaintext messages)
                    if (tag !== 'plaintext') {
                        await storeMappingFromEnvelope(stanza, author, repository, decryptionJid, logger);
                    }
                    try {
                        const e2eType = tag === 'plaintext' ? 'plaintext' : attrs.type;
                        switch (e2eType) {
                            case 'skmsg':
                                msgBuffer = await repository.decryptGroupMessage({
                                    group: sender,
                                    authorJid: author,
                                    msg: content
                                });
                                break;
                            case 'pkmsg':
                            case 'msg':
                                msgBuffer = await repository.decryptMessage({
                                    jid: decryptionJid,
                                    type: e2eType,
                                    ciphertext: content
                                });
                                break;
                            case 'plaintext':
                                msgBuffer = content;
                                break;
                            default:
                                throw new Error(`Unknown e2e type: ${e2eType}`);
                        }
                        let msg = WAProto_1.proto.Message.decode(e2eType !== 'plaintext' ? (0, generics_1.unpadRandomMax16)(msgBuffer) : msgBuffer);
                        msg = msg.deviceSentMessage?.message || msg;
                        if (msg.senderKeyDistributionMessage) {
                            //eslint-disable-next-line max-depth
                            try {
                                await repository.processSenderKeyDistributionMessage({
                                    authorJid: author,
                                    item: msg.senderKeyDistributionMessage
                                });
                            }
                            catch (err) {
                                logger.error({ key: fullMessage.key, err }, 'failed to process sender key distribution message');
                            }
                        }
                        if (fullMessage.message) {
                            Object.assign(fullMessage.message, msg);
                        }
                        else {
                            fullMessage.message = msg;
                        }
                    }
                    catch (err) {
                        const errorContext = {
                            key: fullMessage.key,
                            err,
                            messageType: tag === 'plaintext' ? 'plaintext' : attrs.type,
                            sender,
                            author,
                            isSessionRecordError: isSessionRecordError(err)
                        };
                        logger.error(errorContext, 'failed to decrypt message');
                        fullMessage.messageStubType = WAProto_1.proto.WebMessageInfo.StubType.CIPHERTEXT;
                        fullMessage.messageStubParameters = [err.message?.toString()];
                    }
                }
            }
            // if nothing was found to decrypt
            if (!decryptables && !fullMessage.key?.isViewOnce) {
                fullMessage.messageStubType = WAProto_1.proto.WebMessageInfo.StubType.CIPHERTEXT;
                fullMessage.messageStubParameters = [exports.NO_MESSAGE_FOUND_ERROR_TEXT];
            }
        }
    };
};
exports.decryptMessageNode = decryptMessageNode;
//# sourceMappingURL=decode-wa-message.js.map