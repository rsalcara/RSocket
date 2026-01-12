/**
 * Structured Logger with Pino Integration
 *
 * Modern, high-performance structured logging that replaces console.log usage.
 * Provides:
 * - **Structured logs:** JSON format for parsing and querying
 * - **Log levels:** trace, debug, info, warn, error, fatal
 * - **Correlation IDs:** Automatic trace context inclusion
 * - **Performance:** Async logging doesn't block event loop
 * - **APM compatible:** Works with Datadog, New Relic, Elastic, etc.
 *
 * ## Migration from console.log
 *
 * ```typescript
 * // Before
 * console.log('[BAILEYS] Message sent:', messageId)
 *
 * // After
 * logger.info({ messageId }, 'Message sent')
 * // Output: {"level":30,"time":1234567890,"traceId":"...","messageId":"...","msg":"Message sent"}
 * ```
 */
import type { Logger } from 'pino';
/**
 * Baileys logger configuration
 */
export interface BaileysLoggerConfig {
    /** Base Pino logger instance */
    baseLogger: Logger;
    /** Enable emoji prefixes (default: true) */
    enableEmoji?: boolean;
    /** Component name for logs (default: 'baileys') */
    component?: string;
    /** Minimum log level (default: from BAILEYS_LOG_LEVEL env or 'info') */
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    /** Include trace context automatically (default: true) */
    includeTraceContext?: boolean;
}
/**
 * Check if Baileys logging is enabled
 * Backwards compatible with existing BAILEYS_LOG env var
 */
export declare function isBaileysLogEnabled(): boolean;
/**
 * Get log level from environment
 * Priority: BAILEYS_LOG_LEVEL > LOG_LEVEL > 'info'
 */
export declare function getBaileysLogLevel(): string;
/**
 * Create a Baileys logger instance
 *
 * @param config - Logger configuration
 * @returns Structured logger with Baileys-specific methods
 *
 * @example
 * ```typescript
 * import pino from 'pino'
 *
 * const baseLogger = pino({ level: 'info' })
 * const logger = createBaileysLogger({ baseLogger })
 *
 * logger.logConnection('open')
 * logger.logMessage('sent', { messageId: '123', to: 'user@s.whatsapp.net' })
 * ```
 */
export declare function createBaileysLogger(config: BaileysLoggerConfig): {
    /**
     * Raw logger access for custom logging
     */
    logger: import("pino").default.Logger<never, boolean>;
    /**
     * Check if logging is enabled
     */
    isEnabled: typeof isBaileysLogEnabled;
    /**
     * Log connection events
     */
    logConnection(event: "connecting" | "open" | "close", data?: {
        sessionName?: string;
        reason?: string;
    }): void;
    /**
     * Log disconnection with reason
     */
    logDisconnect(reason: string, data?: {
        sessionName?: string;
        code?: number;
    }): void;
    /**
     * Log QR code generation
     */
    logQRGenerated(data?: {
        sessionName?: string;
    }): void;
    /**
     * Log authentication events
     */
    logAuth(event: "success" | "saved" | "cleared", data?: {
        sessionName?: string;
    }): void;
    /**
     * Log message events with structured data
     */
    logMessage(event: "sent" | "received" | "decrypt_failed", details: {
        messageId?: string;
        from?: string;
        to?: string;
        retryCount?: number;
        maxRetries?: number;
        jid?: string;
    }): void;
    /**
     * Log PreKey events
     */
    logPreKeys(event: "uploaded" | "low" | "refreshed", data?: {
        count?: number;
    }): void;
    /**
     * Log session establishment
     */
    logSession(contact: string, forced?: boolean): void;
    /**
     * Log errors with structured data
     */
    logError(context: string, error: Error | string, data?: any): void;
    /**
     * Log general info
     */
    logInfo(message: string, data?: any): void;
    /**
     * Log event buffer operations
     */
    logEventBuffer(event: "buffer_start" | "buffer_flush" | "buffer_overflow" | "buffer_timeout" | "cache_cleanup", details?: {
        itemsBuffered?: number;
        flushCount?: number;
        historyCacheSize?: number;
        maxItems?: number;
        removed?: number;
        remaining?: number;
    }): void;
    /**
     * Log buffer metrics
     */
    logBufferMetrics(metrics: {
        itemsBuffered: number;
        flushCount: number;
        historyCacheSize: number;
        buffersInProgress: number;
    }): void;
    /**
     * Log cache memory operations
     */
    logCacheMemory(event: "init" | "limit_reached" | "eviction" | "metrics", details: {
        cacheName: string;
        size?: number;
        maxKeys?: number;
        evictedKeys?: number;
        utilizationPct?: number;
        ttl?: number;
    }): void;
    /**
     * Log socket cache metrics summary
     */
    logSocketCacheMetrics(metrics: {
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
};
/**
 * Type for Baileys logger instance
 */
export type BaileysLogger = ReturnType<typeof createBaileysLogger>;
