import NodeCache from '@cacheable/node-cache';
import { Boom } from '@hapi/boom';
import { proto } from '../../WAProto/index.mjs';
import { DEFAULT_CACHE_TTLS, DEFAULT_CACHE_MAX_KEYS, WA_DEFAULT_EPHEMERAL } from '../Defaults/index.js';
var ListType = proto.Message.ListMessage.ListType;
import { aggregateMessageKeysNotFromMe, assertMediaContent, bindWaitForEvent, decryptMediaRetryData, encodeSignedDeviceIdentity, encodeWAMessage, encryptMediaRetryRequest, extractDeviceJids, generateMessageIDV2, generateParticipantHashV2, generateWAMessage, getStatusCodeForMediaRetry, getUrlFromDirectPath, getWAUploadToServer, logMessage, logSession, MessageRetryManager, normalizeMessageContent, parseAndInjectE2ESessions, unixTimestampSeconds, convertlidDevice, getContentType, encodeNewsletterMessage } from '../Utils/index.js';
import { getUrlInfo } from '../Utils/link-preview.js';
import { makeKeyedMutex } from '../Utils/make-mutex.js';
import { getMessageReportingToken, shouldIncludeReportingToken } from '../Utils/reporting-utils.js';
import { getPrometheus } from '../Utils/prometheus-metrics.js';
import { areJidsSameUser, getBinaryNodeChild, getBinaryNodeChildren, isHostedLidUser, isHostedPnUser, isJidGroup, isJidUser, isLidUser, isPnUser, jidDecode, jidEncode, jidNormalizedUser, S_WHATSAPP_NET } from '../WABinary/index.js';
import { USyncQuery, USyncUser } from '../WAUSync/index.js';
import { makeNewsletterSocket } from './newsletter.js';
import caches from '../Utils/cache-utils.js';
export const makeMessagesSocket = (config) => {
    const { logger, linkPreviewImageThumbnailWidth, generateHighQualityLinkPreview, options: axiosOptions, patchMessageBeforeSending, cachedGroupMetadata, enableRecentMessageCache, maxMsgRetryCount } = config;
    const sock = makeNewsletterSocket(config);
    const { ev, authState, processingMutex, signalRepository, upsertMessage, query, fetchPrivacySettings, sendNode, groupMetadata, groupToggleEphemeral } = sock;
    const userDevicesCache = config.userDevicesCache ||
        new NodeCache({
            stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES,
            maxKeys: DEFAULT_CACHE_MAX_KEYS.USER_DEVICES,
            deleteOnExpire: true,
            useClones: false
        });
    const lidCache = new NodeCache({
        stdTTL: 3600, // 1 hour
        maxKeys: DEFAULT_CACHE_MAX_KEYS.LID_PER_SOCKET,
        deleteOnExpire: true,
        useClones: false
    });
    const peerSessionsCache = new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES,
        maxKeys: DEFAULT_CACHE_MAX_KEYS.USER_DEVICES,
        deleteOnExpire: true,
        useClones: false
    });
    // Initialize message retry manager if enabled
    const messageRetryManager = enableRecentMessageCache ? new MessageRetryManager(logger, maxMsgRetryCount) : null;
    // Prevent race conditions in Signal session encryption by user
    const encryptionMutex = makeKeyedMutex();
    let mediaConn;
    const refreshMediaConn = async (forceGet = false) => {
        const media = await mediaConn;
        if (!media || forceGet || new Date().getTime() - media.fetchDate.getTime() > media.ttl * 1000) {
            mediaConn = (async () => {
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        type: 'set',
                        xmlns: 'w:m',
                        to: S_WHATSAPP_NET
                    },
                    content: [{ tag: 'media_conn', attrs: {} }]
                });
                const mediaConnNode = getBinaryNodeChild(result, 'media_conn');
                // TODO: explore full length of data that whatsapp provides
                const node = {
                    hosts: getBinaryNodeChildren(mediaConnNode, 'host').map(({ attrs }) => ({
                        hostname: attrs.hostname,
                        maxContentLengthBytes: +attrs.maxContentLengthBytes
                    })),
                    auth: mediaConnNode.attrs.auth,
                    ttl: +mediaConnNode.attrs.ttl,
                    fetchDate: new Date()
                };
                logger.debug('fetched media conn');
                return node;
            })();
        }
        return mediaConn;
    };
    /**
     * generic send receipt function
     * used for receipts of phone call, read, delivery etc.
     * */
    const sendReceipt = async (jid, participant, messageIds, type) => {
        if (!messageIds || messageIds.length === 0) {
            throw new Boom('missing ids in receipt');
        }
        const node = {
            tag: 'receipt',
            attrs: {
                id: messageIds[0]
            }
        };
        const isReadReceipt = type === 'read' || type === 'read-self';
        if (isReadReceipt) {
            node.attrs.t = unixTimestampSeconds().toString();
        }
        if (type === 'sender' && (isPnUser(jid) || isLidUser(jid))) {
            node.attrs.recipient = jid;
            node.attrs.to = participant;
        }
        else {
            node.attrs.to = jid;
            if (participant) {
                node.attrs.participant = participant;
            }
        }
        if (type) {
            node.attrs.type = type;
        }
        const remainingMessageIds = messageIds.slice(1);
        if (remainingMessageIds.length) {
            node.content = [
                {
                    tag: 'list',
                    attrs: {},
                    content: remainingMessageIds.map(id => ({
                        tag: 'item',
                        attrs: { id }
                    }))
                }
            ];
        }
        logger.debug({ attrs: node.attrs, messageIds }, 'sending receipt for messages');
        await sendNode(node);
    };
    /** Correctly bulk send receipts to multiple chats, participants */
    const sendReceipts = async (keys, type) => {
        const recps = aggregateMessageKeysNotFromMe(keys);
        for (const { jid, participant, messageIds } of recps) {
            await sendReceipt(jid, participant, messageIds, type);
        }
    };
    /** Bulk read messages. Keys can be from different chats & participants */
    const readMessages = async (keys) => {
        const privacySettings = await fetchPrivacySettings();
        // based on privacy settings, we have to change the read type
        const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self';
        await sendReceipts(keys, readType);
    };
    /** Fetch all the devices we've to send a message to */
    const getUSyncDevices = async (jids, useCache, ignoreZeroDevices) => {
        const deviceResults = [];
        if (!useCache) {
            logger.debug('not using cache for devices');
        }
        const toFetch = [];
        jids = Array.from(new Set(jids));
        for (let jid of jids) {
            const user = jidDecode(jid)?.user;
            jid = jidNormalizedUser(jid);
            if (useCache) {
                const devices = userDevicesCache.get(user);
                if (devices) {
                    deviceResults.push(...devices);
                    logger.trace({ user }, 'using cache for devices');
                }
                else {
                    toFetch.push(jid);
                }
            }
            else {
                toFetch.push(jid);
            }
        }
        if (!toFetch.length) {
            return deviceResults;
        }
        const usyncQuery = new USyncQuery().withContext('message').withDeviceProtocol();
        for (const jid of toFetch) {
            usyncQuery.withUser(new USyncUser().withId(jid));
        }
        const result = await sock.executeUSyncQuery(usyncQuery);
        if (result) {
            // Store LID mappings from device call
            const lidResults = result.list.filter(a => !!a.lid);
            if (lidResults.length > 0) {
                logger.trace('Storing LID maps from device call');
                for (const item of lidResults) {
                    if (item.lid && item.id) {
                        caches.lidCache.set(item.id, item.lid);
                    }
                }
            }
            const extracted = extractDeviceJids(result?.list, authState.creds.me.id, authState.creds.me?.lid || '', ignoreZeroDevices);
            const deviceMap = {};
            for (const item of extracted) {
                deviceMap[item.user] = deviceMap[item.user] || [];
                deviceMap[item.user].push(item);
                deviceResults.push(item);
            }
            for (const key in deviceMap) {
                userDevicesCache.set(key, deviceMap[key]);
            }
        }
        return deviceResults;
    };
    /**
     * Update Member Label
     */
    const updateMemberLabel = (jid, memberLabel) => {
        return relayMessage(jid, {
            protocolMessage: {
                type: proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE,
                memberLabel: {
                    label: memberLabel?.slice(0, 30),
                    labelTimestamp: unixTimestampSeconds()
                }
            }
        }, {
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: {
                        tag_reason: 'user_update',
                        appdata: 'member_tag'
                    },
                    content: undefined
                }
            ]
        });
    };
    const assertSessions = async (jids, force, lids) => {
        let didFetchNewSession = false;
        const melid = jidNormalizedUser(authState.creds.me?.lid);
        const meid = jidNormalizedUser(authState.creds.me?.id);
        let jidsRequiringFetch = [];
        if (force) {
            jidsRequiringFetch = jids;
        }
        else {
            const addrs = jids.map(jid => signalRepository.jidToSignalProtocolAddress(convertlidDevice(jid, lids, meid, melid)));
            const sessions = await authState.keys.get('session', addrs);
            for (const jid of jids) {
                const signalId = signalRepository.jidToSignalProtocolAddress(convertlidDevice(jid, lids, meid, melid));
                if (!sessions[signalId]) {
                    jidsRequiringFetch.push(jid);
                }
            }
        }
        if (jidsRequiringFetch.length) {
            logger.debug({ jidsRequiringFetch }, 'fetching sessions');
            const result = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'encrypt',
                    type: 'get',
                    to: S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'key',
                        attrs: {},
                        content: jidsRequiringFetch.map(jid => ({
                            tag: 'user',
                            attrs: { jid }
                        }))
                    }
                ]
            });
            await parseAndInjectE2ESessions(result, signalRepository, lids, meid, melid);
            // Log session establishment for each contact
            for (const jid of jidsRequiringFetch) {
                logSession(jid, force);
            }
            didFetchNewSession = true;
        }
        return didFetchNewSession;
    };
    //TODO: for later, abstract the logic to send a Peer Message instead of just PDO - useful for App State Key Resync with phone
    const sendPeerDataOperationMessage = async (pdoMessage) => {
        if (!authState.creds.me?.id) {
            throw new Boom('Not authenticated');
        }
        const protocolMessage = {
            protocolMessage: {
                peerDataOperationRequestMessage: pdoMessage,
                type: proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_MESSAGE
            }
        };
        const meJid = jidNormalizedUser(authState.creds.me.id);
        const msgId = await relayMessage(meJid, protocolMessage, {
            additionalAttributes: {
                category: 'peer',
                push_priority: 'high_force'
            },
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: { appdata: 'default' }
                }
            ]
        });
        return msgId;
    };
    const createParticipantNodes = async (jids, message, extraAttrs, lid, meid, melid, dsmMessage) => {
        if (!jids.length) {
            return { nodes: [], shouldIncludeDeviceIdentity: false };
        }
        let patched = await patchMessageBeforeSending(message, jids);
        if (!Array.isArray(patched)) {
            patched = jids ? jids.map(jid => ({ recipientJid: jid, ...patched })) : [patched];
        }
        let shouldIncludeDeviceIdentity = false;
        const meId = authState.creds.me.id;
        const meLid = authState.creds.me?.lid;
        const meLidUser = meLid ? jidDecode(meLid)?.user : null;
        const encryptionPromises = patched.map(async (patchedMessageWithJid) => {
            const { recipientJid: jid, ...patchedMessage } = patchedMessageWithJid;
            if (!jid) {
                return null;
            }
            let msgToEncrypt = patchedMessage;
            if (dsmMessage) {
                const { user: targetUser } = jidDecode(jid);
                const { user: ownPnUser } = jidDecode(meId);
                const ownLidUser = meLidUser;
                const isOwnUser = targetUser === ownPnUser || (ownLidUser && targetUser === ownLidUser);
                const isExactSenderDevice = jid === meId || (meLid && jid === meLid);
                if (isOwnUser && !isExactSenderDevice) {
                    msgToEncrypt = dsmMessage;
                    logger.debug({ jid, targetUser }, 'Using DSM for own device');
                }
            }
            const bytes = encodeWAMessage(msgToEncrypt);
            const mutexKey = jid;
            try {
                const node = await encryptionMutex.mutex(mutexKey, async () => {
                    const { type, ciphertext } = await signalRepository.encryptMessage({
                        jid: convertlidDevice(jid, lid, meid, melid),
                        data: bytes
                    });
                    if (type === 'pkmsg') {
                        shouldIncludeDeviceIdentity = true;
                    }
                    return {
                        tag: 'to',
                        attrs: { jid },
                        content: [
                            {
                                tag: 'enc',
                                attrs: {
                                    v: '2',
                                    type,
                                    ...(extraAttrs || {})
                                },
                                content: ciphertext
                            }
                        ]
                    };
                });
                return node;
            }
            catch (err) {
                logger.error({ jid, err }, 'Failed to encrypt for recipient');
                return null;
            }
        });
        const nodes = (await Promise.all(encryptionPromises)).filter(node => node !== null);
        if (jids.length > 0 && nodes.length === 0) {
            throw new Boom('All encryptions failed', { statusCode: 500 });
        }
        return { nodes, shouldIncludeDeviceIdentity };
    };
    const getLid = async (jid) => {
        const cachedLid = lidCache.get(jid);
        if (cachedLid) {
            return cachedLid;
        }
        const usyncQuery = new USyncQuery()
            .withContactProtocol()
            .withLIDProtocol()
            .withUser(new USyncUser().withPhone(jid.split('@')[0]));
        const results = await sock.executeUSyncQuery(usyncQuery);
        if (results?.list) {
            const maybeLid = results.list[0]?.lid;
            if (typeof maybeLid === 'string') {
                lidCache.set(jid, maybeLid);
                return maybeLid;
            }
        }
        return null;
    };
    const relayMessage = async (jid, message, { messageId: msgId, participant, additionalAttributes, additionalNodes, useUserDevicesCache, useCachedGroupMetadata, statusJidList, isretry }) => {
        const meId = authState.creds.me.id;
        const meLid = authState.creds.me.lid || authState.creds.me.id;
        const lidattrs = jidDecode(authState.creds.me?.lid);
        const jlidUser = lidattrs?.user;
        let lids;
        if (isJidUser(jid) || isJidUser(participant?.jid)) {
            const userQuery = jidNormalizedUser(participant?.jid || jid);
            if (!isLidUser(userQuery)) {
                const verify = await caches.lidCache.get(userQuery);
                if (verify) {
                    lids = verify;
                }
                else {
                    const usyncQuery = new USyncQuery().withContactProtocol().withLIDProtocol();
                    usyncQuery.withUser(new USyncUser().withPhone(userQuery.split('@')[0]));
                    const results = await sock.executeUSyncQuery(usyncQuery);
                    if (results?.list) {
                        const maybeLid = results.list[0]?.lid;
                        if (typeof maybeLid === 'string') {
                            caches.lidCache.set(userQuery, maybeLid);
                            lids = maybeLid;
                        }
                    }
                }
            }
        }
        const { user, server } = jidDecode(jid);
        const statusJid = 'status@broadcast';
        const isGroup = server === 'g.us';
        const isStatus = jid === statusJid;
        const isLid = server === 'lid';
        const isNewsletter = server === 'newsletter';
        const isRetryResend = Boolean(participant?.jid);
        let shouldIncludeDeviceIdentity = isRetryResend;
        let reportingMessage;
        msgId = msgId || generateMessageIDV2(sock.user?.id);
        useUserDevicesCache = useUserDevicesCache !== false;
        useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus;
        const participants = [];
        const destinationJid = !isStatus ? jidEncode(user, isLid ? 'lid' : isGroup ? 'g.us' : 's.whatsapp.net') : statusJid;
        const binaryNodeContent = [];
        const devices = [];
        const meMsg = {
            deviceSentMessage: {
                destinationJid,
                message
            },
            messageContextInfo: message.messageContextInfo
        };
        const extraAttrs = {};
        if (participant) {
            if (!isGroup && !isStatus) {
                additionalAttributes = { ...additionalAttributes, device_fanout: 'false' };
            }
            const { user, device } = jidDecode(participant.jid);
            devices.push({ user, device, jid: jidNormalizedUser(participant.jid) });
        }
        await authState.keys.transaction(async () => {
            const mediaType = getMediaType(message);
            if (mediaType) {
                extraAttrs['mediatype'] = mediaType;
            }
            if (isNewsletter) {
                const patched = patchMessageBeforeSending ? await patchMessageBeforeSending(message, []) : message;
                const bytes = encodeNewsletterMessage(patched);
                binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: {},
                    content: bytes
                });
                const stanza = {
                    tag: 'message',
                    attrs: {
                        to: jid,
                        id: msgId,
                        type: getMessageType(message),
                        ...(additionalAttributes || {})
                    },
                    content: binaryNodeContent
                };
                logger.debug({ msgId }, `sending newsletter message to ${jid}`);
                await sendNode(stanza);
                return;
            }
            if (normalizeMessageContent(message)?.pinInChatMessage || normalizeMessageContent(message)?.reactionMessage) {
                extraAttrs['decrypt-fail'] = 'hide';
            }
            if ((isGroup || isStatus) && !isRetryResend) {
                const [groupData, senderKeyMap] = await Promise.all([
                    (async () => {
                        let groupData = useCachedGroupMetadata && cachedGroupMetadata ? await cachedGroupMetadata(jid) : undefined;
                        if (groupData && Array.isArray(groupData?.participants)) {
                            logger.trace({ jid, participants: groupData.participants.length }, 'using cached group metadata');
                        }
                        else if (!isStatus) {
                            groupData = await groupMetadata(jid);
                        }
                        return groupData;
                    })(),
                    (async () => {
                        if (!participant && !isStatus) {
                            const result = await authState.keys.get('sender-key-memory', [jid]);
                            return result[jid] || {};
                        }
                        return {};
                    })()
                ]);
                if (!participant) {
                    const participantsList = (groupData && !isStatus) ? groupData.participants.map(p => p.lid || p.id) : [];
                    if (isStatus && statusJidList) {
                        participantsList.push(...statusJidList);
                    }
                    if (!isStatus) {
                        additionalAttributes = {
                            ...additionalAttributes,
                            addressing_mode: groupData?.addressingMode || 'pn'
                        };
                    }
                    if (groupData?.ephemeralDuration && groupData.ephemeralDuration > 0) {
                        additionalAttributes = {
                            ...additionalAttributes,
                            expiration: groupData.ephemeralDuration.toString()
                        };
                    }
                    const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false);
                    devices.push(...additionalDevices);
                    const Mephone = additionalDevices.some(d => d.user === jlidUser && d.device === 0);
                    if (!Mephone) {
                        devices.push({ user: jlidUser, device: 0, jid: jidNormalizedUser(meLid) });
                    }
                }
                const patched = await patchMessageBeforeSending(message);
                if (Array.isArray(patched)) {
                    throw new Boom('Per-jid patching is not supported in groups');
                }
                const bytes = encodeWAMessage(patched);
                reportingMessage = patched;
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId: meLid
                });
                const senderKeyJids = [];
                for (const { user, device, jid } of devices) {
                    const deviceServer = jidDecode(jid)?.server || 'lid';
                    const senderId = jidEncode(user, deviceServer, device);
                    if (!senderKeyMap[senderId] && !isHostedLidUser(senderId) && !isHostedPnUser(senderId) && device !== 99) {
                        senderKeyJids.push(senderId);
                        senderKeyMap[senderId] = true;
                    }
                }
                if (senderKeyJids.length) {
                    logger.debug({ senderKeyJids }, 'sending new sender key');
                    const senderKeyMsg = {
                        senderKeyDistributionMessage: {
                            axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage,
                            groupId: destinationJid
                        }
                    };
                    await assertSessions(senderKeyJids, isretry ? true : false, lids);
                    const result = await createParticipantNodes(senderKeyJids, senderKeyMsg, extraAttrs, lids, meId, meLid);
                    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || result.shouldIncludeDeviceIdentity;
                    participants.push(...result.nodes);
                }
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg', ...extraAttrs },
                    content: ciphertext
                });
                await authState.keys.set({ 'sender-key-memory': { [jid]: senderKeyMap } });
            }
            else if (!isRetryResend) {
                const { user: meUser, device: meDevice } = jidDecode(meId);
                if (!participant) {
                    const patchedForReporting = await patchMessageBeforeSending(message, [jid]);
                    reportingMessage = Array.isArray(patchedForReporting)
                        ? patchedForReporting.find(item => item.recipientJid === jid) || patchedForReporting[0]
                        : patchedForReporting;
                    devices.push({ user, device: 0, jid });
                    if (meDevice !== undefined && meDevice !== 0) {
                        if (isLidUser(jid) && jlidUser) {
                            devices.push({ user: jlidUser, device: 0, jid: jidNormalizedUser(meLid) });
                            const additionalDevices = await getUSyncDevices([jid, meLid], !!useUserDevicesCache, true);
                            devices.push(...additionalDevices);
                        }
                        else {
                            devices.push({ user: meUser, device: 0, jid: jidNormalizedUser(meId) });
                            const additionalDevices = await getUSyncDevices([jid, meId], !!useUserDevicesCache, true);
                            devices.push(...additionalDevices);
                        }
                    }
                }
                const allJids = [];
                const meJids = [];
                const otherJids = [];
                for (const { user, device, jid } of devices) {
                    const isMe = user === meUser;
                    const ismeLid = user === jlidUser;
                    const deviceServer = jidDecode(jid)?.server || 'lid';
                    const senderId = jidEncode(user, deviceServer, device);
                    // Skip exact sender device
                    if (senderId === meId || (meLid && senderId === meLid)) {
                        logger.debug({ senderId, meId, meLid }, 'Skipping exact sender device');
                        continue;
                    }
                    if (isMe || ismeLid) {
                        meJids.push(senderId);
                    }
                    else {
                        otherJids.push(senderId);
                    }
                    allJids.push(senderId);
                }
                await assertSessions(allJids, isretry ? true : false, lids);
                const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
                    createParticipantNodes(meJids, meMsg, extraAttrs, lids, meId, meLid),
                    createParticipantNodes(otherJids, message, extraAttrs, lids, meId, meLid, meMsg)
                ]);
                participants.push(...meNodes);
                participants.push(...otherNodes);
                if (meJids.length > 0 || otherJids.length > 0) {
                    extraAttrs['phash'] = generateParticipantHashV2([...meJids, ...otherJids]);
                }
                shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2;
            }
            // Handle retry resend
            if (isRetryResend) {
                const isParticipantLid = isLidUser(participant.jid);
                const isMe = areJidsSameUser(participant.jid, isParticipantLid ? meLid : meId);
                const encodedMessageToSend = isMe
                    ? encodeWAMessage({
                        deviceSentMessage: {
                            destinationJid,
                            message
                        }
                    })
                    : encodeWAMessage(message);
                const { type, ciphertext: encryptedContent } = await signalRepository.encryptMessage({
                    data: encodedMessageToSend,
                    jid: participant.jid
                });
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: {
                        v: '2',
                        type,
                        count: participant.count.toString()
                    },
                    content: encryptedContent
                });
            }
            if (participants.length) {
                if (additionalAttributes?.['category'] === 'peer') {
                    const peerNode = participants[0]?.content?.[0];
                    if (peerNode) {
                        binaryNodeContent.push(peerNode);
                    }
                }
                else {
                    binaryNodeContent.push({
                        tag: 'participants',
                        attrs: {},
                        content: participants
                    });
                }
            }
            const stanza = {
                tag: 'message',
                attrs: {
                    id: msgId,
                    to: destinationJid,
                    type: getMessageType(message),
                    ...(additionalAttributes || {})
                },
                content: binaryNodeContent
            };
            // if the participant to send to is explicitly specified (generally retry recp)
            // ensure the message is only sent to that person
            // if a retry receipt is sent to everyone -- it'll fail decryption for everyone else who received the msg
            if (participant) {
                if (isJidGroup(destinationJid)) {
                    stanza.attrs.to = destinationJid;
                    stanza.attrs.participant = participant.jid;
                }
                else if (areJidsSameUser(participant.jid, meId)) {
                    stanza.attrs.to = participant.jid;
                    stanza.attrs.recipient = destinationJid;
                }
                else {
                    stanza.attrs.to = participant.jid;
                }
            }
            else {
                stanza.attrs.to = destinationJid;
            }
            if (shouldIncludeDeviceIdentity) {
                ;
                stanza.content.push({
                    tag: 'device-identity',
                    attrs: {},
                    content: encodeSignedDeviceIdentity(authState.creds.account, true)
                });
                logger.debug({ jid }, 'adding device identity');
            }
            // Add reporting token if applicable
            if (!isNewsletter &&
                !isRetryResend &&
                reportingMessage?.messageContextInfo?.messageSecret &&
                shouldIncludeReportingToken(reportingMessage)) {
                try {
                    const encoded = encodeWAMessage(reportingMessage);
                    const reportingKey = {
                        id: msgId,
                        fromMe: true,
                        remoteJid: destinationJid,
                        participant: participant?.jid
                    };
                    const reportingNode = await getMessageReportingToken(encoded, reportingMessage, reportingKey);
                    if (reportingNode) {
                        ;
                        stanza.content.push(reportingNode);
                        logger.trace({ jid }, 'added reporting token to message');
                    }
                }
                catch (error) {
                    logger.warn({ jid, trace: error?.stack }, 'failed to attach reporting token');
                }
            }
            // Add TC Token if available
            const contactTcTokenData = !isGroup && !isRetryResend && !isStatus ? await authState.keys.get('tctoken', [destinationJid]) : {};
            const tcTokenBuffer = contactTcTokenData[destinationJid]?.token;
            if (tcTokenBuffer) {
                ;
                stanza.content.push({
                    tag: 'tctoken',
                    attrs: {},
                    content: tcTokenBuffer
                });
            }
            if (additionalNodes && additionalNodes.length > 0) {
                ;
                stanza.content.push(...additionalNodes);
            }
            // Business node for interactive messages
            const content = normalizeMessageContent(message);
            const contentType = getContentType(content);
            if ((isJidGroup(jid) || isJidUser(jid) || isLidUser(jid)) && (contentType === 'interactiveMessage' ||
                contentType === 'buttonsMessage' ||
                contentType === 'listMessage')) {
                const bizNode = { tag: 'biz', attrs: {} };
                if ((message?.viewOnceMessage?.message?.interactiveMessage || message?.viewOnceMessageV2?.message?.interactiveMessage || message?.viewOnceMessageV2Extension?.message?.interactiveMessage || message?.interactiveMessage) || (message?.viewOnceMessage?.message?.buttonsMessage || message?.viewOnceMessageV2?.message?.buttonsMessage || message?.viewOnceMessageV2Extension?.message?.buttonsMessage || message?.buttonsMessage)) {
                    bizNode.content = [{
                            tag: 'interactive',
                            attrs: {
                                type: 'native_flow',
                                v: '1'
                            },
                            content: [{
                                    tag: 'native_flow',
                                    attrs: { v: '9', name: 'mixed' }
                                }]
                        }];
                }
                else if (message?.listMessage) {
                    bizNode.content = [{
                            tag: 'list',
                            attrs: {
                                type: 'product_list',
                                v: '2'
                            }
                        }];
                }
                stanza.content.push(bizNode);
            }
            logger.debug({ msgId }, `sending message to ${participants.length} devices`);
            await sendNode(stanza);
            // Add message to retry cache if enabled
            if (messageRetryManager && !participant) {
                messageRetryManager.addRecentMessage(destinationJid, msgId, message);
            }
        });
        // Log message sent
        logMessage('sent', { messageId: msgId, to: jid });
        // Prometheus: Record message sent
        const prometheus = getPrometheus();
        if (prometheus?.isEnabled()) {
            const messageType = message.conversation ? 'text' :
                message.imageMessage ? 'image' :
                    message.videoMessage ? 'video' :
                        message.audioMessage ? 'audio' :
                            message.documentMessage ? 'document' :
                                message.stickerMessage ? 'sticker' :
                                    message.contactMessage ? 'contact' :
                                        message.locationMessage ? 'location' :
                                            message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3 ? 'poll' :
                                                'other';
            prometheus.recordMessageSent(messageType, true);
        }
        return msgId;
    };
    const getMessageType = (message) => {
        const normalizedMessage = normalizeMessageContent(message);
        if (!normalizedMessage)
            return 'text';
        if (normalizedMessage.reactionMessage || normalizedMessage.encReactionMessage) {
            return 'reaction';
        }
        if (normalizedMessage.pollCreationMessage ||
            normalizedMessage.pollCreationMessageV2 ||
            normalizedMessage.pollCreationMessageV3 ||
            normalizedMessage.pollUpdateMessage) {
            return 'poll';
        }
        if (normalizedMessage.eventMessage) {
            return 'event';
        }
        if (getMediaType(normalizedMessage) !== '') {
            return 'media';
        }
        return 'text';
    };
    const getMediaType = (message) => {
        if (message.imageMessage) {
            return 'image';
        }
        else if (message.videoMessage) {
            return message.videoMessage.gifPlayback ? 'gif' : 'video';
        }
        else if (message.audioMessage) {
            return message.audioMessage.ptt ? 'ptt' : 'audio';
        }
        else if (message.contactMessage) {
            return 'vcard';
        }
        else if (message.documentMessage) {
            return 'document';
        }
        else if (message.contactsArrayMessage) {
            return 'contact_array';
        }
        else if (message.liveLocationMessage) {
            return 'livelocation';
        }
        else if (message.stickerMessage) {
            return 'sticker';
        }
        else if (message.listMessage) {
            return 'list';
        }
        else if (message.listResponseMessage) {
            return 'list_response';
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response';
        }
        else if (message.orderMessage) {
            return 'order';
        }
        else if (message.productMessage) {
            return 'product';
        }
        else if (message.interactiveResponseMessage) {
            return 'native_flow_response';
        }
        else if (message.groupInviteMessage) {
            return 'url';
        }
        return '';
    };
    const getButtonType = (message) => {
        if (message.buttonsMessage) {
            return 'buttons';
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response';
        }
        else if (message.interactiveResponseMessage) {
            return 'interactive_response';
        }
        else if (message.listMessage) {
            return 'list';
        }
        else if (message.listResponseMessage) {
            return 'list_response';
        }
    };
    const getButtonArgs = (message) => {
        if (message.templateMessage) {
            return {};
        }
        else if (message.listMessage) {
            const type = message.listMessage.listType;
            if (!type) {
                throw new Boom('Expected list type inside message');
            }
            return { v: '2', type: ListType[type].toLowerCase() };
        }
        else {
            return {};
        }
    };
    const getPrivacyTokens = async (jids) => {
        const t = unixTimestampSeconds().toString();
        const result = await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'privacy'
            },
            content: [
                {
                    tag: 'tokens',
                    attrs: {},
                    content: jids.map(jid => ({
                        tag: 'token',
                        attrs: {
                            jid: jidNormalizedUser(jid),
                            t,
                            type: 'trusted_contact'
                        }
                    }))
                }
            ]
        });
        return result;
    };
    const waUploadToServer = getWAUploadToServer(config, refreshMediaConn);
    const waitForMsgMediaUpdate = bindWaitForEvent(ev, 'messages.media-update');
    return {
        ...sock,
        getPrivacyTokens,
        assertSessions,
        relayMessage,
        sendReceipt,
        sendReceipts,
        readMessages,
        refreshMediaConn,
        waUploadToServer,
        fetchPrivacySettings,
        sendPeerDataOperationMessage,
        createParticipantNodes,
        getUSyncDevices,
        getLid,
        messageRetryManager,
        updateMemberLabel,
        updateMediaMessage: async (message) => {
            const content = assertMediaContent(message.message);
            const mediaKey = content.mediaKey;
            const meId = authState.creds.me.id;
            const node = await encryptMediaRetryRequest(message.key, mediaKey, meId);
            let error = undefined;
            await Promise.all([
                sendNode(node),
                waitForMsgMediaUpdate(async (update) => {
                    const result = update.find(c => c.key.id === message.key.id);
                    if (result) {
                        if (result.error) {
                            error = result.error;
                        }
                        else {
                            try {
                                const media = await decryptMediaRetryData(result.media, mediaKey, result.key.id);
                                if (media.result !== proto.MediaRetryNotification.ResultType.SUCCESS) {
                                    const resultStr = proto.MediaRetryNotification.ResultType[media.result];
                                    throw new Boom(`Media re-upload failed by device (${resultStr})`, {
                                        data: media,
                                        statusCode: getStatusCodeForMediaRetry(media.result) || 404
                                    });
                                }
                                content.directPath = media.directPath;
                                content.url = getUrlFromDirectPath(content.directPath);
                                logger.debug({ directPath: media.directPath, key: result.key }, 'media update successful');
                            }
                            catch (err) {
                                error = err;
                            }
                        }
                        return true;
                    }
                })
            ]);
            if (error) {
                throw error;
            }
            ev.emit('messages.update', [{ key: message.key, update: { message: message.message } }]);
            return message;
        },
        sendMessage: async (jid, content, options = {}) => {
            const userJid = authState.creds.me.id;
            if (typeof content === 'object' &&
                'disappearingMessagesInChat' in content &&
                typeof content['disappearingMessagesInChat'] !== 'undefined' &&
                isJidGroup(jid)) {
                const { disappearingMessagesInChat } = content;
                const value = typeof disappearingMessagesInChat === 'boolean'
                    ? disappearingMessagesInChat
                        ? WA_DEFAULT_EPHEMERAL
                        : 0
                    : disappearingMessagesInChat;
                await groupToggleEphemeral(jid, value);
            }
            else {
                const fullMsg = await generateWAMessage(jid, content, {
                    logger,
                    userJid,
                    getUrlInfo: text => getUrlInfo(text, {
                        thumbnailWidth: linkPreviewImageThumbnailWidth,
                        fetchOpts: {
                            timeout: 3000,
                            ...(axiosOptions || {})
                        },
                        logger,
                        uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
                    }),
                    //TODO: CACHE
                    getProfilePicUrl: sock.profilePictureUrl,
                    getCallLink: sock.createCallLink,
                    upload: waUploadToServer,
                    mediaCache: config.mediaCache,
                    options: config.options,
                    messageId: generateMessageIDV2(sock.user?.id),
                    ...options
                });
                const isEventMsg = 'event' in content && !!content.event;
                const isDeleteMsg = 'delete' in content && !!content.delete;
                const isEditMsg = 'edit' in content && !!content.edit;
                const isPinMsg = 'pin' in content && !!content.pin;
                const isPollMessage = 'poll' in content && !!content.poll;
                const additionalAttributes = {};
                const additionalNodes = [];
                if (isDeleteMsg) {
                    if (isJidGroup(content.delete?.remoteJid) && !content.delete?.fromMe) {
                        additionalAttributes.edit = '8';
                    }
                    else {
                        additionalAttributes.edit = '7';
                    }
                }
                else if (isEditMsg) {
                    additionalAttributes.edit = '1';
                }
                else if (isPinMsg) {
                    additionalAttributes.edit = '2';
                }
                else if (isPollMessage) {
                    additionalNodes.push({
                        tag: 'meta',
                        attrs: {
                            polltype: 'creation'
                        }
                    });
                }
                else if (isEventMsg) {
                    additionalNodes.push({
                        tag: 'meta',
                        attrs: {
                            event_type: 'creation'
                        }
                    });
                }
                if ('cachedGroupMetadata' in options) {
                    console.warn('cachedGroupMetadata in sendMessage are deprecated, now cachedGroupMetadata is part of the socket config.');
                }
                await relayMessage(jid, fullMsg.message, {
                    messageId: fullMsg.key.id,
                    useCachedGroupMetadata: options.useCachedGroupMetadata,
                    additionalAttributes,
                    statusJidList: options.statusJidList,
                    additionalNodes
                });
                if (config.emitOwnEvents) {
                    process.nextTick(() => {
                        processingMutex.mutex(() => upsertMessage(fullMsg, 'append'));
                    });
                }
                return fullMsg;
            }
        }
    };
};
//# sourceMappingURL=messages-send.js.map