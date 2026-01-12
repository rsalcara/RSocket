"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyLoggerAdapter = void 0;
exports.useStructuredLogs = useStructuredLogs;
exports.getLogFormat = getLogFormat;
exports.createDefaultPinoLogger = createDefaultPinoLogger;
exports.getStructuredLogger = getStructuredLogger;
exports.setStructuredLogger = setStructuredLogger;
exports.adaptedLog = adaptedLog;
exports.isStructuredLogger = isStructuredLogger;
const structured_logger_1 = require("./structured-logger");
/**
 * Check if structured logging is enabled
 */
function useStructuredLogs() {
    return process.env.USE_STRUCTURED_LOGS === 'true';
}
/**
 * Get log format from environment
 */
function getLogFormat() {
    return process.env.LOG_FORMAT === 'pretty' ? 'pretty' : 'json';
}
/**
 * Create default Pino logger instance
 * Used when user doesn't provide their own
 */
function createDefaultPinoLogger() {
    // Dynamic import to avoid loading pino if not needed
    const pino = require('pino');
    const options = {
        level: (0, structured_logger_1.getBaileysLogLevel)(),
        timestamp: pino.stdTimeFunctions.isoTime
    };
    // Pretty print for development
    if (getLogFormat() === 'pretty') {
        options.transport = {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
                messageFormat: '{component} {emoji} {msg}'
            }
        };
    }
    return pino(options);
}
/**
 * Singleton logger instance
 * Lazily initialized on first use
 */
let globalStructuredLogger = null;
/**
 * Get or create global structured logger
 *
 * @param baseLogger - Optional Pino logger to use (defaults to auto-created instance)
 * @returns Structured logger instance
 */
function getStructuredLogger(baseLogger) {
    if (!globalStructuredLogger) {
        const logger = baseLogger || createDefaultPinoLogger();
        globalStructuredLogger = (0, structured_logger_1.createBaileysLogger)({ baseLogger: logger });
    }
    return globalStructuredLogger;
}
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
function setStructuredLogger(baseLogger) {
    globalStructuredLogger = (0, structured_logger_1.createBaileysLogger)({ baseLogger });
}
/**
 * Adapter function: routes to console.log or structured logger based on config
 *
 * @example
 * ```typescript
 * // In existing code (no changes needed)
 * adaptedLog('connection', 'info', { event: 'open' }, 'Connected to WhatsApp')
 * ```
 */
function adaptedLog(category, level, data, message) {
    if (useStructuredLogs()) {
        // Use structured Pino logger
        const logger = getStructuredLogger();
        const logFn = logger.logger[level].bind(logger.logger);
        logFn({ category, ...data }, message);
    }
    else {
        // Fallback to console.log (legacy behavior)
        if (data && Object.keys(data).length > 0) {
            console.log(`[BAILEYS] ${message}`, data);
        }
        else {
            console.log(`[BAILEYS] ${message}`);
        }
    }
}
/**
 * Adapter for baileys-logger functions
 * Provides backward compatibility while enabling structured logging
 */
exports.legacyLoggerAdapter = {
    /**
     * Log connection events (adapter)
     */
    logConnection(event, sessionName) {
        if (useStructuredLogs()) {
            getStructuredLogger().logConnection(event, { sessionName });
        }
        else {
            // Legacy console.log behavior
            const session = sessionName ? ` [${sessionName}]` : '';
            const messages = {
                connecting: `🔌 Connecting to WhatsApp...`,
                open: `✅ Connected to WhatsApp successfully`,
                close: `🔴 Disconnected from WhatsApp`
            };
            console.log(`[BAILEYS]${session} ${messages[event]}`);
        }
    },
    /**
     * Log message events (adapter)
     */
    logMessage(event, details) {
        if (useStructuredLogs()) {
            getStructuredLogger().logMessage(event, details);
        }
        else {
            // Legacy console.log behavior
            const { messageId, from, to, retryCount, maxRetries } = details;
            switch (event) {
                case 'sent':
                    console.log(`[BAILEYS] 📤 Message sent: ${messageId} → ${to}`);
                    break;
                case 'received':
                    console.log(`[BAILEYS] 📥 Message received: ${messageId || 'unknown'} ← ${from}`);
                    break;
                case 'decrypt_failed':
                    console.log(`[BAILEYS] ⚠️  Message decrypt failed - Retry ${retryCount}/${maxRetries}`);
                    break;
            }
        }
    },
    /**
     * Log error events (adapter)
     */
    logError(context, error, data) {
        if (useStructuredLogs()) {
            getStructuredLogger().logError(context, error, data);
        }
        else {
            // Legacy console.log behavior
            const errorMsg = typeof error === 'string' ? error : error.message;
            if (data) {
                console.log(`[BAILEYS] ❌ Error in ${context}: ${errorMsg}`, data);
            }
            else {
                console.log(`[BAILEYS] ❌ Error in ${context}: ${errorMsg}`);
            }
        }
    },
    /**
     * Generic log adapter
     */
    log(message, data) {
        adaptedLog('general', 'info', data || {}, message);
    }
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
function isStructuredLogger(logger) {
    return logger && typeof logger.logConnection === 'function' && logger.logger;
}
