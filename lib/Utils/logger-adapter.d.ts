/**
 * Logger Adapter - Backward Compatibility Bridge
 *
 * Provides a smooth migration path from console.log to structured Pino logging.
 * Existing code continues to work while new code can adopt structured logging.
 *
 * ## Migration Strategy
 *
 * ### Phase 1: Drop-in Replacement (Immediate)
 * - Keep using baileys-logger.ts functions
 * - Set USE_STRUCTURED_LOGS=true to switch backend to Pino
 * - Zero code changes required
 *
 * ### Phase 2: Gradual Adoption (Incremental)
 * - Import structured-logger.ts in new code
 * - Refactor critical paths to use structured logging
 * - Add trace context to important operations
 *
 * ### Phase 3: Full Migration (Long-term)
 * - Replace all console.log with structured logger
 * - Deprecate baileys-logger.ts
 * - Remove USE_STRUCTURED_LOGS flag
 *
 * ## Environment Variables
 *
 * - `USE_STRUCTURED_LOGS=true` - Enable Pino backend (default: false for compatibility)
 * - `BAILEYS_LOG=true|false` - Enable/disable Baileys logs (default: true)
 * - `BAILEYS_LOG_LEVEL=debug|info|warn|error` - Log level (default: info)
 * - `LOG_FORMAT=json|pretty` - Output format (default: json)
 */
import type { Logger } from 'pino';
import { createBaileysLogger } from './structured-logger.js';
/**
 * Check if structured logging is enabled
 */
export declare function useStructuredLogs(): boolean;
/**
 * Get log format from environment
 */
export declare function getLogFormat(): 'json' | 'pretty';
/**
 * Create default Pino logger instance
 * Used when user doesn't provide their own
 */
export declare function createDefaultPinoLogger(): Logger;
/**
 * Get or create global structured logger
 *
 * @param baseLogger - Optional Pino logger to use (defaults to auto-created instance)
 * @returns Structured logger instance
 */
export declare function getStructuredLogger(baseLogger?: Logger): ReturnType<typeof createBaileysLogger>;
/**
 * Set custom logger instance
 * Useful when integrating with existing logging infrastructure
 *
 * @param baseLogger - Pino logger instance
 *
 * @example
 * ```typescript
 * import pino from 'pino'
 * import { setStructuredLogger } from './logger-adapter'
 *
 * // Use your app's logger
 * const appLogger = pino({ level: 'debug' })
 * setStructuredLogger(appLogger)
 * ```
 */
export declare function setStructuredLogger(baseLogger: Logger): void;
/**
 * Adapter function: routes to console.log or structured logger based on config
 *
 * @example
 * ```typescript
 * // In existing code (no changes needed)
 * adaptedLog('connection', 'info', { event: 'open' }, 'Connected to WhatsApp')
 * ```
 */
export declare function adaptedLog(category: string, level: 'trace' | 'debug' | 'info' | 'warn' | 'error', data: any, message: string): void;
/**
 * Adapter for baileys-logger functions
 * Provides backward compatibility while enabling structured logging
 */
export declare const legacyLoggerAdapter: {
    /**
     * Log connection events (adapter)
     */
    logConnection(event: "connecting" | "open" | "close", sessionName?: string): void;
    /**
     * Log message events (adapter)
     */
    logMessage(event: "sent" | "received" | "decrypt_failed", details: {
        messageId?: string;
        from?: string;
        to?: string;
        retryCount?: number;
        maxRetries?: number;
    }): void;
    /**
     * Log error events (adapter)
     */
    logError(context: string, error: Error | string, data?: any): void;
    /**
     * Generic log adapter
     */
    log(message: string, data?: any): void;
};
/**
 * Example: How to enable structured logging in your app
 *
 * @example
 * ```typescript
 * // Option 1: Environment variable (easiest)
 * // Set in .env or environment:
 * USE_STRUCTURED_LOGS=true
 * BAILEYS_LOG_LEVEL=debug
 * LOG_FORMAT=pretty // For development
 *
 * // Option 2: Programmatic (more control)
 * import pino from 'pino'
 * import { setStructuredLogger } from '@whiskeysockets/baileys'
 *
 * const logger = pino({
 *   level: 'info',
 *   transport: {
 *     target: 'pino-datadog',
 *     options: { apiKey: process.env.DATADOG_API_KEY }
 *   }
 * })
 *
 * setStructuredLogger(logger)
 * ```
 */
/**
 * Type guard to check if logger is structured
 */
export declare function isStructuredLogger(logger: any): logger is ReturnType<typeof createBaileysLogger>;
//# sourceMappingURL=logger-adapter.d.ts.map