"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatId = exports.shouldIncrementChatUnread = exports.isRealMessage = exports.cleanMessage = void 0;
exports.decryptPollVote = decryptPollVote;
exports.decryptEventResponse = decryptEventResponse;
const WAProto_1 = require("../../WAProto");
const Types_1 = require("../Types");
const messages_1 = require("../Utils/messages");
const WABinary_1 = require("../WABinary");
const crypto_1 = require("./crypto");
const generics_1 = require("./generics");
const history_1 = require("./history");
const history_debug_1 = require("./history-debug");
const REAL_MSG_STUB_TYPES = new Set([
    Types_1.WAMessageStubType.CALL_MISSED_GROUP_VIDEO,
    Types_1.WAMessageStubType.CALL_MISSED_GROUP_VOICE,
    Types_1.WAMessageStubType.CALL_MISSED_VIDEO,
    Types_1.WAMessageStubType.CALL_MISSED_VOICE
]);
const REAL_MSG_REQ_ME_STUB_TYPES = new Set([Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD]);
/** Cleans a received message to further processing */
const cleanMessage = (message, meId, meLid) => {
    // ensure remoteJid and participant doesn't have device or agent in it
    if ((0, WABinary_1.isHostedPnUser)(message.key.remoteJid) || (0, WABinary_1.isHostedLidUser)(message.key.remoteJid)) {
        message.key.remoteJid = (0, WABinary_1.jidEncode)((0, WABinary_1.jidDecode)(message.key?.remoteJid)?.user, (0, WABinary_1.isHostedPnUser)(message.key.remoteJid) ? 's.whatsapp.net' : 'lid');
    }
    else {
        message.key.remoteJid = (0, WABinary_1.jidNormalizedUser)(message.key.remoteJid);
    }
    if ((0, WABinary_1.isHostedPnUser)(message.key.participant) || (0, WABinary_1.isHostedLidUser)(message.key.participant)) {
        message.key.participant = (0, WABinary_1.jidEncode)((0, WABinary_1.jidDecode)(message.key.participant)?.user, (0, WABinary_1.isHostedPnUser)(message.key.participant) ? 's.whatsapp.net' : 'lid');
    }
    else {
        message.key.participant = (0, WABinary_1.jidNormalizedUser)(message.key.participant);
    }
    const content = (0, messages_1.normalizeMessageContent)(message.message);
    // if the message has a reaction, ensure fromMe & remoteJid are from our perspective
    if (content?.reactionMessage) {
        normaliseKey(content.reactionMessage.key);
    }
    if (content?.pollUpdateMessage) {
        normaliseKey(content.pollUpdateMessage.pollCreationMessageKey);
    }
    function normaliseKey(msgKey) {
        // if the reaction is from another user
        // we've to correctly map the key to this user's perspective
        if (!message.key.fromMe) {
            // if the sender believed the message being reacted to is not from them
            // we've to correct the key to be from them, or some other participant
            msgKey.fromMe = !msgKey.fromMe
                ? (0, WABinary_1.areJidsSameUser)(msgKey.participant || msgKey.remoteJid, meId) ||
                    (meLid ? (0, WABinary_1.areJidsSameUser)(msgKey.participant || msgKey.remoteJid, meLid) : false)
                : // if the message being reacted to, was from them
                    // fromMe automatically becomes false
                    false;
            // set the remoteJid to being the same as the chat the message came from
            msgKey.remoteJid = message.key.remoteJid;
            // set participant of the message
            msgKey.participant = msgKey.participant || message.key.participant;
        }
    }
};
exports.cleanMessage = cleanMessage;
const isRealMessage = (message) => {
    const normalizedContent = (0, messages_1.normalizeMessageContent)(message.message);
    const hasSomeContent = !!(0, messages_1.getContentType)(normalizedContent);
    return ((!!normalizedContent ||
        REAL_MSG_STUB_TYPES.has(message.messageStubType) ||
        REAL_MSG_REQ_ME_STUB_TYPES.has(message.messageStubType)) &&
        hasSomeContent &&
        !normalizedContent?.protocolMessage &&
        !normalizedContent?.reactionMessage &&
        !normalizedContent?.pollUpdateMessage);
};
exports.isRealMessage = isRealMessage;
const shouldIncrementChatUnread = (message) => !message.key.fromMe && !message.messageStubType;
exports.shouldIncrementChatUnread = shouldIncrementChatUnread;
/**
 * Get the ID of the chat from the given key.
 * Typically -- that'll be the remoteJid, but for broadcasts, it'll be the participant
 */
const getChatId = ({ remoteJid, participant, fromMe }) => {
    if ((0, WABinary_1.isJidBroadcast)(remoteJid) && !(0, WABinary_1.isJidStatusBroadcast)(remoteJid) && !fromMe) {
        return participant;
    }
    return remoteJid;
};
exports.getChatId = getChatId;
/**
 * Decrypt a poll vote
 * @param vote encrypted vote
 * @param ctx additional info about the poll required for decryption
 * @returns list of SHA256 options
 */
function decryptPollVote({ encPayload, encIv }, { pollCreatorJid, pollMsgId, pollEncKey, voterJid }) {
    const sign = Buffer.concat([
        toBinary(pollMsgId),
        toBinary(pollCreatorJid),
        toBinary(voterJid),
        toBinary('Poll Vote'),
        new Uint8Array([1])
    ]);
    const key0 = (0, crypto_1.hmacSign)(pollEncKey, new Uint8Array(32), 'sha256');
    const decKey = (0, crypto_1.hmacSign)(sign, key0, 'sha256');
    const aad = toBinary(`${pollMsgId}\u0000${voterJid}`);
    const decrypted = (0, crypto_1.aesDecryptGCM)(encPayload, decKey, encIv, aad);
    return WAProto_1.proto.Message.PollVoteMessage.decode(decrypted);
    function toBinary(txt) {
        return Buffer.from(txt);
    }
}
/**
 * Decrypt an event response
 * @param response encrypted event response
 * @param ctx additional info about the event required for decryption
 * @returns event response message
 */
function decryptEventResponse({ encPayload, encIv }, { eventCreatorJid, eventMsgId, eventEncKey, responderJid }) {
    const sign = Buffer.concat([
        toBinary(eventMsgId),
        toBinary(eventCreatorJid),
        toBinary(responderJid),
        toBinary('Event Response'),
        new Uint8Array([1])
    ]);
    const key0 = (0, crypto_1.hmacSign)(eventEncKey, new Uint8Array(32), 'sha256');
    const decKey = (0, crypto_1.hmacSign)(sign, key0, 'sha256');
    const aad = toBinary(`${eventMsgId}\u0000${responderJid}`);
    const decrypted = (0, crypto_1.aesDecryptGCM)(encPayload, decKey, encIv, aad);
    return WAProto_1.proto.Message.EventResponseMessage.decode(decrypted);
    function toBinary(txt) {
        return Buffer.from(txt);
    }
}
const processMessage = async (message, { shouldProcessHistoryMsg, placeholderResendCache, ev, creds, signalRepository, keyStore, logger, options, getMessage, historySyncDebug }) => {
    const meId = creds.me.id;
    const { accountSettings } = creds;
    const chat = { id: (0, WABinary_1.jidNormalizedUser)((0, exports.getChatId)(message.key)) };
    const isRealMsg = (0, exports.isRealMessage)(message);
    if (isRealMsg) {
        chat.messages = [{ message }];
        chat.conversationTimestamp = (0, generics_1.toNumber)(message.messageTimestamp);
        // only increment unread count if not CIPHERTEXT and from another person
        if ((0, exports.shouldIncrementChatUnread)(message)) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        }
    }
    const content = (0, messages_1.normalizeMessageContent)(message.message);
    // unarchive chat if it's a real message, or someone reacted to our message
    // and we've the unarchive chats setting on
    if ((isRealMsg || content?.reactionMessage?.key?.fromMe) && accountSettings?.unarchiveChats) {
        chat.archived = false;
        chat.readOnly = false;
    }
    const protocolMsg = content?.protocolMessage;
    if (protocolMsg) {
        switch (protocolMsg.type) {
            case WAProto_1.proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION:
                const histNotification = protocolMsg.historySyncNotification;
                const process = shouldProcessHistoryMsg;
                const isLatest = !creds.processedHistoryMessages?.length;
                logger?.info({
                    histNotification,
                    process,
                    id: message.key.id,
                    isLatest
                }, 'got history notification');
                if (process) {
                    if (histNotification.syncType !== WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND) {
                        ev.emit('creds.update', {
                            processedHistoryMessages: [
                                ...(creds.processedHistoryMessages || []),
                                { key: message.key, messageTimestamp: message.messageTimestamp }
                            ]
                        });
                    }
                    const data = await (0, history_1.downloadAndProcessHistorySyncNotification)(histNotification, options);
                    // Debug logging for history sync (if enabled)
                    if (historySyncDebug?.enabled) {
                        const debugConfig = { ...history_debug_1.DEFAULT_HISTORY_DEBUG_CONFIG, ...historySyncDebug };
                        const debugger_ = (0, history_debug_1.createHistorySyncDebugger)(debugConfig, logger);
                        // Create a synthetic HistorySync object from processed data for debugging
                        // This avoids downloading the history twice
                        const syntheticHistorySync = {
                            syncType: data.syncType,
                            progress: data.progress,
                            conversations: data.chats,
                            pushnames: data.contacts
                                .filter(c => c.notify)
                                .map(c => ({ id: c.id, pushname: c.notify })),
                            phoneNumberToLidMappings: data.lidPnMappings?.map(m => ({
                                pnJid: m.pn,
                                lidJid: m.lid
                            }))
                        };
                        debugger_.log(syntheticHistorySync, data.lidPnMappings || []);
                    }
                    // Emit LID-PN mappings from history sync (PR #2268)
                    if (data.lidPnMappings?.length) {
                        logger?.info({ count: data.lidPnMappings.length }, '[BAILEYS-LID] 📱 Extracted LID-PN mappings from history sync');
                        // Log sample mappings at debug level
                        if (data.lidPnMappings.length <= 5) {
                            logger?.debug({ mappings: data.lidPnMappings }, '[BAILEYS-LID] 📋 LID-PN mappings detail');
                        }
                        else {
                            logger?.debug({
                                sample: data.lidPnMappings.slice(0, 5),
                                total: data.lidPnMappings.length
                            }, '[BAILEYS-LID] 📋 LID-PN mappings sample (first 5)');
                        }
                        for (const mapping of data.lidPnMappings) {
                            ev.emit('lid-mapping.update', mapping);
                        }
                        // Also store in signal repository for immediate use
                        await signalRepository.lidMapping.storeLIDPNMappings(data.lidPnMappings);
                        logger?.debug({ count: data.lidPnMappings.length }, '[BAILEYS-LID] ✅ LID-PN mappings stored in repository');
                    }
                    ev.emit('messaging-history.set', {
                        ...data,
                        isLatest: histNotification.syncType !== WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND ? isLatest : undefined,
                        peerDataRequestSessionId: histNotification.peerDataRequestSessionId
                    });
                }
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE:
                const keys = protocolMsg.appStateSyncKeyShare.keys;
                if (keys?.length) {
                    let newAppStateSyncKeyId = '';
                    await keyStore.transaction(async () => {
                        const newKeys = [];
                        for (const { keyData, keyId } of keys) {
                            const strKeyId = Buffer.from(keyId.keyId).toString('base64');
                            newKeys.push(strKeyId);
                            await keyStore.set({ 'app-state-sync-key': { [strKeyId]: keyData } });
                            newAppStateSyncKeyId = strKeyId;
                        }
                        logger?.info({ newAppStateSyncKeyId, newKeys }, 'injecting new app state sync keys');
                    }, meId);
                    ev.emit('creds.update', { myAppStateKeyId: newAppStateSyncKeyId });
                }
                else {
                    logger?.info({ protocolMsg }, 'recv app state sync with 0 keys');
                }
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.REVOKE:
                ev.emit('messages.update', [
                    {
                        key: {
                            ...message.key,
                            id: protocolMsg.key.id
                        },
                        update: { message: null, messageStubType: Types_1.WAMessageStubType.REVOKE, key: message.key }
                    }
                ]);
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
                Object.assign(chat, {
                    ephemeralSettingTimestamp: (0, generics_1.toNumber)(message.messageTimestamp),
                    ephemeralExpiration: protocolMsg.ephemeralExpiration || null
                });
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE:
                const response = protocolMsg.peerDataOperationRequestResponseMessage;
                if (response) {
                    await placeholderResendCache?.del(response.stanzaId);
                    // TODO: IMPLEMENT HISTORY SYNC ETC (sticker uploads etc.).
                    const { peerDataOperationResult } = response;
                    for (const result of peerDataOperationResult) {
                        const { placeholderMessageResendResponse: retryResponse } = result;
                        //eslint-disable-next-line max-depth
                        if (retryResponse) {
                            const webMessageInfo = WAProto_1.proto.WebMessageInfo.decode(retryResponse.webMessageInfoBytes);
                            ev.emit('messages.upsert', {
                                messages: [webMessageInfo],
                                type: 'notify',
                                requestId: response.stanzaId
                            });
                        }
                    }
                }
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.MESSAGE_EDIT:
                ev.emit('messages.update', [
                    {
                        // flip the sender / fromMe properties because they're in the perspective of the sender
                        key: { ...message.key, id: protocolMsg.key?.id },
                        update: {
                            message: {
                                editedMessage: {
                                    message: protocolMsg.editedMessage
                                }
                            },
                            messageTimestamp: protocolMsg.timestampMs
                                ? Math.floor((0, generics_1.toNumber)(protocolMsg.timestampMs) / 1000)
                                : message.messageTimestamp
                        }
                    }
                ]);
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE:
                const labelAssociationMsg = protocolMsg.memberLabel;
                if (labelAssociationMsg?.label) {
                    ev.emit('group.member-tag.update', {
                        groupId: chat.id,
                        label: labelAssociationMsg.label,
                        participant: message.key.participant,
                        participantAlt: message.key.participantAlt,
                        messageTimestamp: Number(message.messageTimestamp)
                    });
                }
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.LID_MIGRATION_MAPPING_SYNC:
                const encodedPayload = protocolMsg.lidMigrationMappingSyncMessage?.encodedMappingPayload;
                if (encodedPayload) {
                    const { pnToLidMappings, chatDbMigrationTimestamp } = WAProto_1.proto.LIDMigrationMappingSyncPayload.decode(encodedPayload);
                    logger?.debug({ pnToLidMappings, chatDbMigrationTimestamp }, 'got lid mappings and chat db migration timestamp');
                    const pairs = [];
                    for (const { pn, latestLid, assignedLid } of pnToLidMappings) {
                        const lid = latestLid || assignedLid;
                        pairs.push({ lid: `${lid}@lid`, pn: `${pn}@s.whatsapp.net` });
                    }
                    await signalRepository.lidMapping.storeLIDPNMappings(pairs);
                    if (pairs.length) {
                        for (const { pn, lid } of pairs) {
                            await signalRepository.migrateSession(pn, lid);
                        }
                    }
                }
                break;
        }
    }
    else if (content?.reactionMessage) {
        const reaction = {
            ...content.reactionMessage,
            key: message.key
        };
        ev.emit('messages.reaction', [
            {
                reaction,
                key: content.reactionMessage?.key
            }
        ]);
    }
    else if (content?.encEventResponseMessage) {
        const encEventResponse = content.encEventResponseMessage;
        const creationMsgKey = encEventResponse.eventCreationMessageKey;
        // we need to fetch the event creation message to get the event enc key
        const eventMsg = await getMessage(creationMsgKey);
        if (eventMsg) {
            try {
                const meIdNormalised = (0, WABinary_1.jidNormalizedUser)(meId);
                // all jids need to be PN
                const eventCreatorKey = creationMsgKey.participant || creationMsgKey.remoteJid;
                const eventCreatorPn = (0, WABinary_1.isLidUser)(eventCreatorKey)
                    ? await signalRepository.lidMapping.getPNForLID(eventCreatorKey)
                    : eventCreatorKey;
                const eventCreatorJid = (0, generics_1.getKeyAuthor)({ remoteJid: (0, WABinary_1.jidNormalizedUser)(eventCreatorPn), fromMe: meIdNormalised === eventCreatorPn }, meIdNormalised);
                const responderJid = (0, generics_1.getKeyAuthor)(message.key, meIdNormalised);
                const eventEncKey = eventMsg?.messageContextInfo?.messageSecret;
                if (!eventEncKey) {
                    logger?.warn({ creationMsgKey }, 'event response: missing messageSecret for decryption');
                }
                else {
                    const responseMsg = decryptEventResponse(encEventResponse, {
                        eventEncKey,
                        eventCreatorJid,
                        eventMsgId: creationMsgKey.id,
                        responderJid
                    });
                    const eventResponse = {
                        eventResponseMessageKey: message.key,
                        senderTimestampMs: responseMsg.timestampMs,
                        response: responseMsg
                    };
                    ev.emit('messages.update', [
                        {
                            key: creationMsgKey,
                            update: {
                                eventResponses: [eventResponse]
                            }
                        }
                    ]);
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey }, 'failed to decrypt event response');
            }
        }
        else {
            logger?.warn({ creationMsgKey }, 'event creation message not found, cannot decrypt response');
        }
    }
    else if (message.messageStubType) {
        const jid = message.key?.remoteJid;
        //let actor = whatsappID (message.participant)
        let participants;
        const emitParticipantsUpdate = (action) => ev.emit('group-participants.update', {
            id: jid,
            author: message.key.participant,
            authorPn: message.key.participantAlt,
            participants,
            action
        });
        const emitGroupUpdate = (update) => {
            ev.emit('groups.update', [{ id: jid, ...update, author: message.key.participant ?? undefined, authorPn: message.key.participantAlt }]);
        };
        const emitGroupRequestJoin = (participant, action, method) => {
            ev.emit('group.join-request', {
                id: jid,
                author: message.key.participant,
                authorPn: message.key.participantAlt,
                participant: participant.lid,
                participantPn: participant.pn,
                action,
                method: method
            });
        };
        const participantsIncludesMe = () => participants.find(p => (0, WABinary_1.areJidsSameUser)(meId, p.phoneNumber)); // ADD SUPPORT FOR LID
        switch (message.messageStubType) {
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER:
                participants = message.messageStubParameters?.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('modify');
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_LEAVE:
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_REMOVE:
                participants = message.messageStubParameters?.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('remove');
                // mark the chat read only if you left the group
                if (participantsIncludesMe()) {
                    chat.readOnly = true;
                }
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD:
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_INVITE:
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD_REQUEST_JOIN:
                participants = message.messageStubParameters?.map((a) => JSON.parse(a)) || [];
                if (participantsIncludesMe()) {
                    chat.readOnly = false;
                }
                emitParticipantsUpdate('add');
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_DEMOTE:
                participants = message.messageStubParameters?.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('demote');
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_PROMOTE:
                participants = message.messageStubParameters?.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('promote');
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_ANNOUNCE:
                const announceValue = message.messageStubParameters?.[0];
                emitGroupUpdate({ announce: announceValue === 'true' || announceValue === 'on' });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_RESTRICT:
                const restrictValue = message.messageStubParameters?.[0];
                emitGroupUpdate({ restrict: restrictValue === 'true' || restrictValue === 'on' });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_SUBJECT:
                const name = message.messageStubParameters?.[0];
                chat.name = name;
                emitGroupUpdate({ subject: name });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_DESCRIPTION:
                const description = message.messageStubParameters?.[0];
                chat.description = description;
                emitGroupUpdate({ desc: description });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
                const code = message.messageStubParameters?.[0];
                emitGroupUpdate({ inviteCode: code });
                break;
            case Types_1.WAMessageStubType.GROUP_MEMBER_ADD_MODE:
                const memberAddValue = message.messageStubParameters?.[0];
                emitGroupUpdate({ memberAddMode: memberAddValue === 'all_member_add' });
                break;
            case Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE:
                const approvalMode = message.messageStubParameters?.[0];
                emitGroupUpdate({ joinApprovalMode: approvalMode === 'on' });
                break;
            case Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD: // TODO: Add other events
                const participant = JSON.parse(message.messageStubParameters?.[0]);
                const action = message.messageStubParameters?.[1];
                const method = message.messageStubParameters?.[2];
                emitGroupRequestJoin(participant, action, method);
                break;
        }
    }
    if (Object.keys(chat).length > 1) {
        ev.emit('chats.update', [chat]);
    }
};
exports.default = processMessage;
//# sourceMappingURL=process-message.js.map