/**
 * Baileys Logger Utility
 *
 * Provides controlled logging that can be enabled/disabled via BAILEYS_LOG environment variable.
 * When enabled, logs appear with [BAILEYS] prefix for easy filtering.
 *
 * Usage in zpro-backend:
 *   Set BAILEYS_LOG=true in .env file to enable detailed Baileys logging
 */
/**
 * Check if Baileys logging is enabled
 */
export declare function isBaileysLogEnabled(): boolean;
/**
 * Log message if BAILEYS_LOG is enabled
 * @param message - Message to log (with emoji prefix recommended)
 * @param data - Optional data object to include
 */
export declare function baileysLog(message: string, data?: any): void;
/**
 * Log connection event
 */
export declare function logConnection(event: 'connecting' | 'open' | 'close', sessionName?: string): void;
/**
 * Log disconnection with reason
 */
export declare function logDisconnect(reason: string, sessionName?: string): void;
/**
 * Log QR code generation
 */
export declare function logQRGenerated(sessionName?: string): void;
/**
 * Log authentication events
 */
export declare function logAuth(event: 'success' | 'saved' | 'cleared', sessionName?: string): void;
/**
 * Log message events
 */
export declare function logMessage(event: 'sent' | 'received' | 'decrypt_failed', details: {
    messageId?: string;
    from?: string;
    to?: string;
    retryCount?: number;
    maxRetries?: number;
}): void;
/**
 * Log PreKey events
 */
export declare function logPreKeys(event: 'uploaded' | 'low' | 'refreshed', count?: number): void;
/**
 * Log session establishment
 */
export declare function logSession(contact: string, forced?: boolean): void;
/**
 * Log error events
 */
export declare function logError(context: string, error: Error | string): void;
/**
 * Log general info
 */
export declare function logInfo(message: string, data?: any): void;
/**
 * Log event buffer operations
 */
export declare function logEventBuffer(event: 'buffer_start' | 'buffer_flush' | 'buffer_overflow' | 'buffer_timeout' | 'cache_cleanup' | 'adaptive_flush_enabled', details?: {
    itemsBuffered?: number;
    flushCount?: number;
    historyCacheSize?: number;
    maxItems?: number;
    removed?: number;
    remaining?: number;
    autoFlushed?: boolean;
    adaptiveMode?: string;
    timeoutMs?: number;
    flushDuration?: number;
    minTimeout?: number;
    maxTimeout?: number;
    mode?: string;
}): void;
/**
 * Log event buffer metrics (periodic monitoring)
 */
export declare function logBufferMetrics(metrics: {
    itemsBuffered: number;
    flushCount: number;
    historyCacheSize: number;
    buffersInProgress: number;
}): void;
/**
 * Log cache memory operations and metrics
 *
 * Memory leak prevention (Issue #3):
 * Monitors cache memory usage and warns when approaching limits
 */
export declare function logCacheMemory(event: 'init' | 'limit_reached' | 'eviction' | 'metrics', details: {
    cacheName: string;
    size?: number;
    maxKeys?: number;
    evictedKeys?: number;
    utilizationPct?: number;
    ttl?: number;
}): void;
/**
 * Log aggregate cache metrics for all caches in a socket
 */
export declare function logSocketCacheMetrics(metrics: {
    userDevicesCache: {
        size: number;
        maxKeys: number;
    };
    lidCache: {
        size: number;
        maxKeys: number;
    };
    msgRetryCache: {
        size: number;
        maxKeys: number;
    };
    callOfferCache: {
        size: number;
        maxKeys: number;
    };
    placeholderResendCache: {
        size: number;
        maxKeys: number;
    };
    signalStore: {
        size: number;
        maxKeys: number;
    };
    totalKeys: number;
    totalMaxKeys: number;
    avgUtilization: number;
}): void;
