import { proto } from '../../WAProto';
import type { LIDMapping } from '../Types';
import type { ILogger } from './logger';
/**
 * History sync debug configuration
 */
export interface HistorySyncDebugConfig {
    /** Enable debug logging for history sync */
    enabled: boolean;
    /** Directory to save debug files (default: /tmp/baileys-debug) */
    outputDir?: string;
    /** Save full payload to JSON files */
    saveToFile?: boolean;
    /** Log to console via logger */
    logToConsole?: boolean;
    /** Include full conversations in logs (can be large) */
    includeConversations?: boolean;
    /** Include full messages in logs (can be very large) */
    includeMessages?: boolean;
}
/**
 * Default debug configuration
 */
export declare const DEFAULT_HISTORY_DEBUG_CONFIG: HistorySyncDebugConfig;
/**
 * History sync debug data structure
 */
export interface HistorySyncDebugData {
    timestamp: number;
    syncType: proto.HistorySync.HistorySyncType | null | undefined;
    syncTypeName: string;
    progress: number | null | undefined;
    hasPhoneNumberMappings: boolean;
    phoneNumberMappingsCount: number;
    phoneNumberMappings: LIDMapping[];
    conversationsCount: number;
    conversationIds?: string[];
    messagesCount: number;
    contactsCount: number;
    pushnamesCount: number;
    fullPayload?: proto.IHistorySync;
}
/**
 * Extract debug data from history sync payload
 */
export declare const extractHistorySyncDebugData: (historySync: proto.IHistorySync, lidPnMappings: LIDMapping[], config?: HistorySyncDebugConfig) => HistorySyncDebugData;
/**
 * Log history sync debug data
 */
export declare const logHistorySyncDebug: (debugData: HistorySyncDebugData, logger?: ILogger, config?: HistorySyncDebugConfig) => string | undefined;
/**
 * Create a history sync debug logger instance
 */
export declare const createHistorySyncDebugger: (config?: Partial<HistorySyncDebugConfig>, logger?: ILogger) => {
    config: HistorySyncDebugConfig;
    /**
     * Log history sync data
     */
    log: (historySync: proto.IHistorySync, lidPnMappings: LIDMapping[]) => string | undefined;
    /**
     * Enable debug logging
     */
    enable: () => void;
    /**
     * Disable debug logging
     */
    disable: () => void;
};
//# sourceMappingURL=history-debug.d.ts.map