"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistorySyncDebugger = exports.logHistorySyncDebug = exports.extractHistorySyncDebugData = exports.DEFAULT_HISTORY_DEBUG_CONFIG = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const WAProto_1 = require("../../WAProto");
/**
 * Default debug configuration
 */
exports.DEFAULT_HISTORY_DEBUG_CONFIG = {
    enabled: false,
    outputDir: '/tmp/baileys-debug',
    saveToFile: true,
    logToConsole: true,
    includeConversations: false,
    includeMessages: false
};
/**
 * Get human-readable sync type name
 */
const getSyncTypeName = (syncType) => {
    if (syncType === null || syncType === undefined)
        return 'UNKNOWN';
    const names = {
        [WAProto_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP]: 'INITIAL_BOOTSTRAP',
        [WAProto_1.proto.HistorySync.HistorySyncType.INITIAL_STATUS_V3]: 'INITIAL_STATUS_V3',
        [WAProto_1.proto.HistorySync.HistorySyncType.FULL]: 'FULL',
        [WAProto_1.proto.HistorySync.HistorySyncType.RECENT]: 'RECENT',
        [WAProto_1.proto.HistorySync.HistorySyncType.PUSH_NAME]: 'PUSH_NAME',
        [WAProto_1.proto.HistorySync.HistorySyncType.NON_BLOCKING_DATA]: 'NON_BLOCKING_DATA',
        [WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND]: 'ON_DEMAND'
    };
    return names[syncType] || `UNKNOWN_${syncType}`;
};
/**
 * Extract debug data from history sync payload
 */
const extractHistorySyncDebugData = (historySync, lidPnMappings, config = exports.DEFAULT_HISTORY_DEBUG_CONFIG) => {
    const conversations = historySync.conversations || [];
    const pushnames = historySync.pushnames || [];
    // Count total messages across all conversations
    let messagesCount = 0;
    for (const conv of conversations) {
        messagesCount += conv.messages?.length || 0;
    }
    const debugData = {
        timestamp: Date.now(),
        syncType: historySync.syncType,
        syncTypeName: getSyncTypeName(historySync.syncType),
        progress: historySync.progress,
        // LID-PN mappings
        hasPhoneNumberMappings: lidPnMappings.length > 0,
        phoneNumberMappingsCount: lidPnMappings.length,
        phoneNumberMappings: lidPnMappings,
        // Conversations
        conversationsCount: conversations.length,
        // Messages
        messagesCount,
        // Contacts (extracted from conversations)
        contactsCount: conversations.length,
        // Push names
        pushnamesCount: pushnames.length
    };
    // Include conversation IDs if requested
    if (config.includeConversations) {
        debugData.conversationIds = conversations.map(c => c.id || 'unknown');
    }
    // Include full payload if requested (WARNING: can be very large)
    if (config.includeMessages) {
        debugData.fullPayload = historySync;
    }
    return debugData;
};
exports.extractHistorySyncDebugData = extractHistorySyncDebugData;
/**
 * Log history sync debug data
 */
const logHistorySyncDebug = (debugData, logger, config = exports.DEFAULT_HISTORY_DEBUG_CONFIG) => {
    if (!config.enabled)
        return undefined;
    let savedFilePath;
    // Log to console via logger
    if (config.logToConsole && logger) {
        const logData = {
            syncType: debugData.syncTypeName,
            progress: debugData.progress,
            lidMappings: {
                found: debugData.hasPhoneNumberMappings,
                count: debugData.phoneNumberMappingsCount,
                samples: debugData.phoneNumberMappings.slice(0, 3).map(m => ({
                    pn: m.pn.replace(/\d{4,}/, '***'), // Mask phone numbers
                    lid: m.lid.substring(0, 10) + '...'
                }))
            },
            conversations: debugData.conversationsCount,
            messages: debugData.messagesCount,
            pushnames: debugData.pushnamesCount
        };
        logger.info(logData, `[BAILEYS-DEBUG] 📊 History Sync: ${debugData.syncTypeName}, ${debugData.conversationsCount} conversations`);
        // Log LID-PN mapping summary at debug level
        if (debugData.phoneNumberMappingsCount > 0) {
            logger.debug({ mappings: debugData.phoneNumberMappings }, `[BAILEYS-DEBUG] 📱 LID-PN mappings found: ${debugData.phoneNumberMappingsCount}`);
        }
        else {
            logger.debug({}, '[BAILEYS-DEBUG] ℹ️ No LID-PN mappings in this sync');
        }
    }
    // Save to file
    if (config.saveToFile) {
        const outputDir = config.outputDir || '/tmp/baileys-debug';
        // Ensure directory exists
        if (!(0, fs_1.existsSync)(outputDir)) {
            (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        }
        const filename = `history-sync-${debugData.syncTypeName}-${debugData.timestamp}.json`;
        savedFilePath = (0, path_1.join)(outputDir, filename);
        try {
            (0, fs_1.writeFileSync)(savedFilePath, JSON.stringify(debugData, null, 2));
            logger?.info({ path: savedFilePath }, '[BAILEYS-DEBUG] 📁 History sync debug saved to file');
        }
        catch (err) {
            logger?.warn({ err, path: savedFilePath }, '[BAILEYS-DEBUG] ❌ Failed to save history sync debug file');
        }
    }
    return savedFilePath;
};
exports.logHistorySyncDebug = logHistorySyncDebug;
/**
 * Create a history sync debug logger instance
 */
const createHistorySyncDebugger = (config = {}, logger) => {
    const mergedConfig = {
        ...exports.DEFAULT_HISTORY_DEBUG_CONFIG,
        ...config
    };
    return {
        config: mergedConfig,
        /**
         * Log history sync data
         */
        log: (historySync, lidPnMappings) => {
            if (!mergedConfig.enabled)
                return undefined;
            const debugData = (0, exports.extractHistorySyncDebugData)(historySync, lidPnMappings, mergedConfig);
            return (0, exports.logHistorySyncDebug)(debugData, logger, mergedConfig);
        },
        /**
         * Enable debug logging
         */
        enable: () => {
            mergedConfig.enabled = true;
        },
        /**
         * Disable debug logging
         */
        disable: () => {
            mergedConfig.enabled = false;
        }
    };
};
exports.createHistorySyncDebugger = createHistorySyncDebugger;
//# sourceMappingURL=history-debug.js.map