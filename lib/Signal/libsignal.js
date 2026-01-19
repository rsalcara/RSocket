"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeLibSignalRepository = makeLibSignalRepository;
/* @ts-ignore */
const libsignal = __importStar(require("libsignal"));
const lru_cache_1 = require("lru-cache");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const sender_key_name_1 = require("./Group/sender-key-name");
const sender_key_record_1 = require("./Group/sender-key-record");
const Group_1 = require("./Group");
/**
 * Helper to check if keys support transactions
 */
function hasTransactionSupport(keys) {
    return typeof keys.transaction === 'function';
}
/**
 * Execute with transaction if available, otherwise execute directly
 */
async function withTransaction(keys, exec, key) {
    if (hasTransactionSupport(keys)) {
        return keys.transaction(exec, key);
    }
    return exec();
}
function makeLibSignalRepository(auth, logger, pnFromLIDUSync) {
    const parsedKeys = auth.keys;
    // LRU cache for migrated sessions - improved with 3-day TTL and auto-purge
    const migratedSessionCache = new lru_cache_1.LRUCache({
        max: 10000,
        ttl: 3 * 24 * 60 * 60 * 1000, // 3 days
        ttlAutopurge: true,
        updateAgeOnGet: true
    });
    // In-memory LID mapping cache (LID -> PN)
    const lidMappingCache = new Map();
    // Reverse cache (PN -> LID) for getLIDForPN lookups
    const pnToLidCache = new Map();
    // LID mapping store implementation - inline dual-cache (fork's approach)
    const lidMapping = {
        async getLIDPNMappings(lids) {
            const result = [];
            const missingLids = [];
            // Check cache first
            for (const lid of lids) {
                const pn = lidMappingCache.get(lid);
                if (pn) {
                    result.push({ lid, pn });
                }
                else {
                    missingLids.push(lid);
                }
            }
            // If we have missing LIDs and a USync function, fetch them
            if (missingLids.length > 0 && pnFromLIDUSync) {
                try {
                    const fetchedMappings = await pnFromLIDUSync(missingLids);
                    if (fetchedMappings) {
                        for (const mapping of fetchedMappings) {
                            lidMappingCache.set(mapping.lid, mapping.pn);
                            pnToLidCache.set(mapping.pn, mapping.lid);
                            result.push(mapping);
                        }
                    }
                }
                catch (err) {
                    logger?.warn({ err, lids: missingLids }, 'Failed to fetch LID mappings via USync');
                }
            }
            return result;
        },
        async storeLIDPNMappings(mappings) {
            for (const mapping of mappings) {
                lidMappingCache.set(mapping.lid, mapping.pn);
                // Also populate reverse cache
                pnToLidCache.set(mapping.pn, mapping.lid);
            }
            // Also store in keys for persistence
            const lidMappingData = {};
            for (const mapping of mappings) {
                lidMappingData[mapping.lid] = mapping.pn;
            }
            try {
                await auth.keys.set({ 'lid-mapping': lidMappingData });
            }
            catch (err) {
                logger?.warn({ err }, 'Failed to persist LID mappings');
            }
        },
        async getPNForLID(lid) {
            // Check cache first
            const cachedPn = lidMappingCache.get(lid);
            if (cachedPn) {
                return cachedPn;
            }
            // Try to fetch from USync if available
            if (pnFromLIDUSync) {
                try {
                    const mappings = await pnFromLIDUSync([lid]);
                    if (mappings && mappings.length > 0) {
                        lidMappingCache.set(lid, mappings[0].pn);
                        pnToLidCache.set(mappings[0].pn, lid);
                        return mappings[0].pn;
                    }
                }
                catch (err) {
                    logger?.warn({ err, lid }, 'Failed to fetch PN for LID via USync');
                }
            }
            return undefined;
        },
        async getLIDForPN(pn) {
            // Check reverse cache first
            const cachedLid = pnToLidCache.get(pn);
            if (cachedLid) {
                return cachedLid;
            }
            // Search in the forward cache (less efficient but ensures consistency)
            for (const [lid, cachedPn] of lidMappingCache.entries()) {
                if (cachedPn === pn) {
                    pnToLidCache.set(pn, lid);
                    return lid;
                }
            }
            return undefined;
        }
    };
    // Create storage with LID resolution support (upstream improvement)
    const storage = signalStorage(auth, lidMapping);
    // Session migration function - enhanced with bulk migration and transaction support
    const migrateSession = async (fromJid, toJid) => {
        if (!fromJid || (!(0, WABinary_1.isLidUser)(toJid) && !(0, WABinary_1.isHostedLidUser)(toJid))) {
            return { migrated: 0, skipped: 0, total: 0 };
        }
        // Only support PN to LID migration
        if (!(0, WABinary_1.isPnUser)(fromJid) && !(0, WABinary_1.isHostedPnUser)(fromJid)) {
            return { migrated: 0, skipped: 0, total: 1 };
        }
        const { user } = (0, WABinary_1.jidDecode)(fromJid);
        logger?.debug({ fromJid }, 'bulk device migration - loading all user devices');
        // Get user's device list from storage
        const { [user]: userDevices } = await parsedKeys.get('device-list', [user]);
        if (!userDevices) {
            return { migrated: 0, skipped: 0, total: 0 };
        }
        const { device: fromDevice } = (0, WABinary_1.jidDecode)(fromJid);
        const fromDeviceStr = fromDevice?.toString() || '0';
        if (!userDevices.includes(fromDeviceStr)) {
            userDevices.push(fromDeviceStr);
        }
        // Filter out cached devices before database fetch
        const uncachedDevices = userDevices.filter((device) => {
            const deviceKey = `${user}.${device}`;
            return !migratedSessionCache.has(deviceKey);
        });
        // Bulk check session existence only for uncached devices
        const deviceSessionKeys = uncachedDevices.map((device) => `${user}.${device}`);
        const existingSessions = await parsedKeys.get('session', deviceSessionKeys);
        // Convert existing sessions to JIDs (only migrate sessions that exist)
        const deviceJids = [];
        for (const [sessionKey, sessionData] of Object.entries(existingSessions)) {
            if (sessionData) {
                const deviceStr = sessionKey.split('.')[1];
                if (!deviceStr)
                    continue;
                const deviceNum = parseInt(deviceStr);
                let jid = deviceNum === 0 ? `${user}@s.whatsapp.net` : `${user}:${deviceNum}@s.whatsapp.net`;
                if (deviceNum === 99) {
                    jid = `${user}:99@hosted`;
                }
                deviceJids.push(jid);
            }
        }
        logger?.debug({
            fromJid,
            totalDevices: userDevices.length,
            devicesWithSessions: deviceJids.length,
            devices: deviceJids
        }, 'bulk device migration complete - all user devices processed');
        if (deviceJids.length === 0) {
            return { migrated: 0, skipped: 0, total: userDevices.length };
        }
        // Execute migration within transaction for atomicity (upstream improvement)
        return withTransaction(parsedKeys, async () => {
            const migrationOps = deviceJids.map(jid => {
                const lidWithDevice = (0, WABinary_1.transferDevice)(jid, toJid);
                const fromDecoded = (0, WABinary_1.jidDecode)(jid);
                const toDecoded = (0, WABinary_1.jidDecode)(lidWithDevice);
                return {
                    fromJid: jid,
                    toJid: lidWithDevice,
                    pnUser: fromDecoded.user,
                    lidUser: toDecoded.user,
                    deviceId: fromDecoded.device || 0,
                    fromAddr: jidToSignalProtocolAddress(jid),
                    toAddr: jidToSignalProtocolAddress(lidWithDevice)
                };
            });
            const totalOps = migrationOps.length;
            let migratedCount = 0;
            // Bulk fetch PN sessions - already exist (verified during device discovery)
            const pnAddrStrings = Array.from(new Set(migrationOps.map(op => op.fromAddr.toString())));
            const pnSessions = await parsedKeys.get('session', pnAddrStrings);
            // Prepare bulk session updates (PN → LID migration + deletion)
            const sessionUpdates = {};
            for (const op of migrationOps) {
                const pnAddrStr = op.fromAddr.toString();
                const lidAddrStr = op.toAddr.toString();
                const pnSession = pnSessions[pnAddrStr];
                if (pnSession) {
                    // Session exists (guaranteed from device discovery)
                    const fromSession = libsignal.SessionRecord.deserialize(pnSession);
                    if (fromSession.haveOpenSession()) {
                        // Queue for bulk update: copy to LID, delete from PN
                        sessionUpdates[lidAddrStr] = fromSession.serialize();
                        sessionUpdates[pnAddrStr] = null;
                        migratedCount++;
                    }
                }
            }
            // Single bulk session update for all migrations
            if (Object.keys(sessionUpdates).length > 0) {
                await parsedKeys.set({ session: sessionUpdates });
                logger?.debug({ migratedSessions: migratedCount }, 'bulk session migration complete');
                // Cache device-level migrations
                for (const op of migrationOps) {
                    if (sessionUpdates[op.toAddr.toString()]) {
                        const deviceKey = `${op.pnUser}.${op.deviceId}`;
                        migratedSessionCache.set(deviceKey, true);
                    }
                }
            }
            const skippedCount = totalOps - migratedCount;
            return { migrated: migratedCount, skipped: skippedCount, total: totalOps };
        }, `migrate-${deviceJids.length}-sessions-${(0, WABinary_1.jidDecode)(toJid)?.user}`);
    };
    // Validate session existence - improved with haveOpenSession() check (upstream improvement)
    const validateSession = async (jid) => {
        try {
            const addr = jidToSignalProtocolAddress(jid);
            const session = await storage.loadSession(addr.toString());
            if (!session) {
                return { exists: false, reason: 'no session' };
            }
            // Check if session is actually open (upstream improvement)
            if (!session.haveOpenSession()) {
                return { exists: false, reason: 'no open session' };
            }
            return { exists: true };
        }
        catch (error) {
            return { exists: false, reason: 'validation error' };
        }
    };
    // Delete sessions in bulk with transaction support
    const deleteSession = async (jids) => {
        if (!jids.length)
            return;
        // Convert JIDs to signal addresses and prepare for bulk deletion
        const sessionUpdates = {};
        jids.forEach(jid => {
            const addr = jidToSignalProtocolAddress(jid);
            sessionUpdates[addr.toString()] = null;
        });
        // Single transaction for all deletions (upstream improvement)
        return withTransaction(parsedKeys, async () => {
            await parsedKeys.set({ session: sessionUpdates });
        }, `delete-${jids.length}-sessions`);
    };
    const repository = {
        decryptGroupMessage({ group, authorJid, msg }) {
            const senderName = jidToSignalSenderKeyName(group, authorJid);
            const cipher = new Group_1.GroupCipher(storage, senderName);
            // Use transaction for atomicity (upstream improvement)
            return withTransaction(parsedKeys, async () => cipher.decrypt(msg), group);
        },
        async processSenderKeyDistributionMessage({ item, authorJid }) {
            const builder = new Group_1.GroupSessionBuilder(storage);
            if (!item.groupId) {
                throw new Error('Group ID is required for sender key distribution message');
            }
            const senderName = jidToSignalSenderKeyName(item.groupId, authorJid);
            const senderMsg = new Group_1.SenderKeyDistributionMessage(null, null, null, null, item.axolotlSenderKeyDistributionMessage);
            // Use transaction for atomicity (upstream improvement)
            return withTransaction(parsedKeys, async () => {
                const senderNameStr = senderName.toString();
                const { [senderNameStr]: senderKey } = await auth.keys.get('sender-key', [senderNameStr]);
                if (!senderKey) {
                    await storage.storeSenderKey(senderName, new sender_key_record_1.SenderKeyRecord());
                }
                await builder.process(senderName, senderMsg);
            }, item.groupId);
        },
        async decryptMessage({ jid, type, ciphertext }) {
            const addr = jidToSignalProtocolAddress(jid);
            const session = new libsignal.SessionCipher(storage, addr);
            async function doDecrypt() {
                let result;
                switch (type) {
                    case 'pkmsg':
                        result = await session.decryptPreKeyWhisperMessage(ciphertext);
                        break;
                    case 'msg':
                        result = await session.decryptWhisperMessage(ciphertext);
                        break;
                    default:
                        throw new Error(`Unknown message type: ${type}`);
                }
                return result;
            }
            // Use transaction for atomicity (upstream improvement)
            return withTransaction(parsedKeys, doDecrypt, jid);
        },
        async encryptMessage({ jid, data }) {
            const addr = jidToSignalProtocolAddress(jid);
            const cipher = new libsignal.SessionCipher(storage, addr);
            // Use transaction for atomicity (upstream improvement)
            return withTransaction(parsedKeys, async () => {
                const { type: sigType, body } = await cipher.encrypt(data);
                const type = sigType === 3 ? 'pkmsg' : 'msg';
                return { type, ciphertext: Buffer.from(body, 'binary') };
            }, jid);
        },
        async encryptGroupMessage({ group, meId, data }) {
            const senderName = jidToSignalSenderKeyName(group, meId);
            const builder = new Group_1.GroupSessionBuilder(storage);
            // Use transaction for atomicity (upstream improvement)
            return withTransaction(parsedKeys, async () => {
                const senderNameStr = senderName.toString();
                const { [senderNameStr]: senderKey } = await auth.keys.get('sender-key', [senderNameStr]);
                if (!senderKey) {
                    await storage.storeSenderKey(senderName, new sender_key_record_1.SenderKeyRecord());
                }
                const senderKeyDistributionMessage = await builder.create(senderName);
                const session = new Group_1.GroupCipher(storage, senderName);
                const ciphertext = await session.encrypt(data);
                return {
                    ciphertext,
                    senderKeyDistributionMessage: senderKeyDistributionMessage.serialize()
                };
            }, group);
        },
        async injectE2ESession({ jid, session }) {
            logger?.trace({ jid }, 'injecting E2EE session');
            const cipher = new libsignal.SessionBuilder(storage, jidToSignalProtocolAddress(jid));
            // Use transaction for atomicity (upstream improvement)
            return withTransaction(parsedKeys, async () => {
                await cipher.initOutgoing(session);
            }, jid);
        },
        jidToSignalProtocolAddress(jid) {
            return jidToSignalProtocolAddress(jid).toString();
        },
        // Optimized direct access to LID mapping store
        lidMapping,
        migrateSession,
        validateSession,
        deleteSession
    };
    return repository;
}
/**
 * Convert JID to Signal Protocol Address
 * Improved with WAJIDDomains handling and device 99 validation (upstream improvement)
 */
const jidToSignalProtocolAddress = (jid) => {
    const decoded = (0, WABinary_1.jidDecode)(jid);
    const { user, device, server, domainType } = decoded;
    if (!user) {
        throw new Error(`JID decoded but user is empty: "${jid}" -> user: "${user}", server: "${server}", device: ${device}`);
    }
    // Handle different domain types (upstream improvement)
    const signalUser = domainType !== WABinary_1.WAJIDDomains.WHATSAPP ? `${user}_${domainType}` : user;
    const finalDevice = device || 0;
    // Validate device 99 is only for hosted domains (upstream improvement)
    if (device === 99 && server !== 'hosted' && server !== 'hosted.lid') {
        throw new Error('Unexpected non-hosted device JID with device 99. This ID seems invalid. ID: ' + jid);
    }
    return new libsignal.ProtocolAddress(signalUser, finalDevice);
};
const jidToSignalSenderKeyName = (group, user) => {
    return new sender_key_name_1.SenderKeyName(group, jidToSignalProtocolAddress(user));
};
/**
 * Create signal storage with LID resolution support
 * Improved with resolveLIDSignalAddress for automatic PN→LID resolution (upstream improvement)
 */
function signalStorage({ creds, keys }, lidMapping) {
    /**
     * Resolve PN signal address to LID if mapping exists (upstream improvement)
     * This enables transparent session lookup using LID when PN→LID mapping is known
     */
    const resolveLIDSignalAddress = async (id) => {
        if (id.includes('.')) {
            const [deviceId, device] = id.split('.');
            const [user, domainType_] = deviceId.split('_');
            const domainType = parseInt(domainType_ || '0');
            // Already a LID address, no resolution needed
            if (domainType === WABinary_1.WAJIDDomains.LID || domainType === WABinary_1.WAJIDDomains.HOSTED_LID) {
                return id;
            }
            // Try to resolve PN to LID
            const pnJid = `${user}${device !== '0' ? `:${device}` : ''}@${domainType === WABinary_1.WAJIDDomains.HOSTED ? 'hosted' : 's.whatsapp.net'}`;
            const lidForPN = await lidMapping.getLIDForPN(pnJid);
            if (lidForPN) {
                const lidAddr = jidToSignalProtocolAddress(lidForPN);
                return lidAddr.toString();
            }
        }
        return id;
    };
    return {
        loadSession: async (id) => {
            try {
                // Resolve to LID address if mapping exists (upstream improvement)
                const wireJid = await resolveLIDSignalAddress(id);
                const { [wireJid]: sess } = await keys.get('session', [wireJid]);
                if (sess) {
                    return libsignal.SessionRecord.deserialize(sess);
                }
            }
            catch (e) {
                return null;
            }
            return null;
        },
        storeSession: async (id, session) => {
            // Resolve to LID address if mapping exists (upstream improvement)
            const wireJid = await resolveLIDSignalAddress(id);
            await keys.set({ session: { [wireJid]: session.serialize() } });
        },
        isTrustedIdentity: () => {
            return true; // todo: implement
        },
        loadPreKey: async (id) => {
            const keyId = id.toString();
            const { [keyId]: key } = await keys.get('pre-key', [keyId]);
            if (key) {
                return {
                    privKey: Buffer.from(key.private),
                    pubKey: Buffer.from(key.public)
                };
            }
        },
        removePreKey: (id) => keys.set({ 'pre-key': { [id]: null } }),
        loadSignedPreKey: () => {
            const key = creds.signedPreKey;
            return {
                privKey: Buffer.from(key.keyPair.private),
                pubKey: Buffer.from(key.keyPair.public)
            };
        },
        loadSenderKey: async (senderKeyName) => {
            const keyId = senderKeyName.toString();
            const { [keyId]: key } = await keys.get('sender-key', [keyId]);
            if (key) {
                return sender_key_record_1.SenderKeyRecord.deserialize(key);
            }
            return new sender_key_record_1.SenderKeyRecord();
        },
        storeSenderKey: async (senderKeyName, key) => {
            const keyId = senderKeyName.toString();
            const serialized = JSON.stringify(key.serialize());
            await keys.set({ 'sender-key': { [keyId]: Buffer.from(serialized, 'utf-8') } });
        },
        getOurRegistrationId: () => creds.registrationId,
        getOurIdentity: () => {
            const { signedIdentityKey } = creds;
            return {
                privKey: Buffer.from(signedIdentityKey.private),
                pubKey: Buffer.from((0, Utils_1.generateSignalPubKey)(signedIdentityKey.public))
            };
        }
    };
}
//# sourceMappingURL=libsignal.js.map