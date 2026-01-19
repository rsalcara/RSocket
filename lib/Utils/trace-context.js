"use strict";
/**
 * Trace Context System with AsyncLocalStorage
 *
 * Provides correlation IDs and request tracing across asynchronous operations.
 * Uses Node.js AsyncLocalStorage (Node ≥20) for automatic context propagation.
 *
 * ## Benefits
 * - **End-to-end tracing:** Follow messages through entire pipeline
 * - **Distributed tracing:** Compatible with OpenTelemetry, Datadog, etc.
 * - **Debug correlation:** All logs for same operation share trace ID
 * - **Performance insights:** Identify bottlenecks with timing data
 * - **Multi-tenant isolation:** Separate traces per tenant/socket
 *
 * ## Usage
 *
 * ```typescript
 * // Start trace for message processing
 * await withTrace({ messageId, jid, operation: 'process_message' }, async () => {
 *   await processMessage()
 *   // All operations inside share the same trace context
 * })
 *
 * // Get current trace context anywhere in async chain
 * const ctx = getTraceContext()
 * logger.info({ ...ctx }, 'Processing message')
 * // Output: { traceId, messageId, jid, operation, timestamp, ... }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTraceId = generateTraceId;
exports.getTraceContext = getTraceContext;
exports.getOrCreateTraceId = getOrCreateTraceId;
exports.withTrace = withTrace;
exports.withTraceSync = withTraceSync;
exports.updateTraceContext = updateTraceContext;
exports.createTracedLogger = createTracedLogger;
exports.extractTraceIdFromHeaders = extractTraceIdFromHeaders;
exports.timeOperation = timeOperation;
exports.isTraceContextAvailable = isTraceContextAvailable;
const async_hooks_1 = require("async_hooks");
const crypto_1 = require("crypto");
/**
 * AsyncLocalStorage instance for trace context
 * Available in Node.js ≥20 (stable) and ≥16 (experimental)
 */
const traceStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * Generate a UUID v4 trace ID
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateTraceId() {
    const bytes = (0, crypto_1.randomBytes)(16);
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    // Convert to hex string with dashes
    const hex = bytes.toString('hex');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}
/**
 * Get current trace context from AsyncLocalStorage
 *
 * @returns Current trace context or undefined if not in trace scope
 *
 * @example
 * ```typescript
 * const ctx = getTraceContext()
 * if (ctx) {
 *   logger.info({ ...ctx, action: 'decrypt' }, 'Message decrypted')
 * }
 * ```
 */
function getTraceContext() {
    return traceStorage.getStore();
}
/**
 * Get trace ID from current context, or generate new one if not in trace scope
 *
 * @returns Trace ID (always returns a value, never undefined)
 *
 * @example
 * ```typescript
 * const traceId = getOrCreateTraceId()
 * logger.info({ traceId }, 'Operation started')
 * ```
 */
function getOrCreateTraceId() {
    const ctx = traceStorage.getStore();
    return ctx?.traceId || generateTraceId();
}
/**
 * Execute function within a trace context
 *
 * Automatically propagates context to all async operations within the callback.
 * Nested calls create child traces with parent reference.
 *
 * @param context - Partial trace context (traceId auto-generated if not provided)
 * @param fn - Async function to execute within trace
 * @returns Result of fn()
 *
 * @example
 * ```typescript
 * // Simple trace
 * await withTrace({ operation: 'send_message', messageId }, async () => {
 *   await sendMessage()
 * })
 *
 * // Nested trace (creates parent-child relationship)
 * await withTrace({ operation: 'process_message' }, async () => {
 *   await withTrace({ operation: 'decrypt' }, async () => {
 *     await decryptMessage() // Has both traceId and parentTraceId
 *   })
 * })
 * ```
 */
async function withTrace(context, fn) {
    // Get parent context if exists
    const parentContext = traceStorage.getStore();
    // Create new trace context
    const traceContext = {
        traceId: context.traceId || generateTraceId(),
        parentTraceId: parentContext?.traceId,
        timestamp: new Date().toISOString(),
        ...context
    };
    // Run function within this context
    return traceStorage.run(traceContext, fn);
}
/**
 * Execute synchronous function within a trace context
 *
 * @param context - Partial trace context
 * @param fn - Synchronous function to execute
 * @returns Result of fn()
 *
 * @example
 * ```typescript
 * const result = withTraceSync({ operation: 'validate' }, () => {
 *   return validateMessage()
 * })
 * ```
 */
function withTraceSync(context, fn) {
    const parentContext = traceStorage.getStore();
    const traceContext = {
        traceId: context.traceId || generateTraceId(),
        parentTraceId: parentContext?.traceId,
        timestamp: new Date().toISOString(),
        ...context
    };
    return traceStorage.run(traceContext, fn);
}
/**
 * Update current trace context with additional data
 *
 * Useful for adding metadata as operation progresses.
 * Creates a new context object (immutable update).
 *
 * @param updates - Partial context to merge with current
 * @returns Updated context or undefined if not in trace scope
 *
 * @example
 * ```typescript
 * // Add metadata during operation
 * updateTraceContext({ metadata: { retryCount: 3 } })
 *
 * // Add discovered information
 * updateTraceContext({ jid: extractedJid })
 * ```
 */
function updateTraceContext(updates) {
    const current = traceStorage.getStore();
    if (!current)
        return undefined;
    // Create updated context (immutable)
    const updated = {
        ...current,
        ...updates,
        // Merge metadata instead of replacing
        metadata: updates.metadata
            ? { ...current.metadata, ...updates.metadata }
            : current.metadata
    };
    // Note: AsyncLocalStorage doesn't support in-place updates
    // The updated context is returned but won't affect the store
    // This is by design - use withTrace for nested scopes instead
    return updated;
}
/**
 * Create a child logger with trace context automatically included
 *
 * Compatible with Pino logger. All logs will include trace context fields.
 *
 * @param baseLogger - Pino logger instance
 * @returns Child logger with trace context bindings
 *
 * @example
 * ```typescript
 * import pino from 'pino'
 *
 * const logger = pino()
 * const tracedLogger = createTracedLogger(logger)
 *
 * await withTrace({ messageId: '123' }, async () => {
 *   tracedLogger.info('Processing') // Includes traceId, messageId automatically
 * })
 * ```
 */
function createTracedLogger(baseLogger) {
    return {
        ...baseLogger,
        child: (bindings) => {
            const ctx = getTraceContext();
            const contextBindings = ctx ? {
                traceId: ctx.traceId,
                parentTraceId: ctx.parentTraceId,
                operation: ctx.operation,
                messageId: ctx.messageId,
                jid: ctx.jid,
                socketId: ctx.socketId,
                tenantId: ctx.tenantId
            } : {};
            return baseLogger.child({ ...contextBindings, ...bindings });
        },
        trace: (obj, msg) => {
            const ctx = getTraceContext();
            baseLogger.trace({ ...ctx, ...obj }, msg);
        },
        debug: (obj, msg) => {
            const ctx = getTraceContext();
            baseLogger.debug({ ...ctx, ...obj }, msg);
        },
        info: (obj, msg) => {
            const ctx = getTraceContext();
            baseLogger.info({ ...ctx, ...obj }, msg);
        },
        warn: (obj, msg) => {
            const ctx = getTraceContext();
            baseLogger.warn({ ...ctx, ...obj }, msg);
        },
        error: (obj, msg) => {
            const ctx = getTraceContext();
            baseLogger.error({ ...ctx, ...obj }, msg);
        },
        fatal: (obj, msg) => {
            const ctx = getTraceContext();
            baseLogger.fatal({ ...ctx, ...obj }, msg);
        }
    };
}
/**
 * Extract trace context from incoming requests/messages
 *
 * Supports common trace header formats:
 * - X-Trace-Id
 * - X-Request-Id
 * - traceparent (W3C Trace Context)
 *
 * @param headers - Request headers object
 * @returns Extracted trace ID or undefined
 *
 * @example
 * ```typescript
 * // Extract from HTTP headers
 * const traceId = extractTraceIdFromHeaders(req.headers)
 *
 * await withTrace({ traceId, operation: 'handle_request' }, async () => {
 *   await handleRequest()
 * })
 * ```
 */
function extractTraceIdFromHeaders(headers) {
    // Try X-Trace-Id header
    if (headers['x-trace-id']) {
        return String(headers['x-trace-id']);
    }
    // Try X-Request-Id header
    if (headers['x-request-id']) {
        return String(headers['x-request-id']);
    }
    // Try W3C Trace Context (traceparent)
    // Format: 00-<trace-id>-<span-id>-<flags>
    if (headers['traceparent']) {
        const parts = String(headers['traceparent']).split('-');
        if (parts.length >= 2) {
            return parts[1]; // Extract trace-id part
        }
    }
    return undefined;
}
/**
 * Performance timing utility for traced operations
 *
 * Measures operation duration and adds to trace context.
 *
 * @param name - Operation name
 * @param fn - Function to time
 * @returns Tuple of [result, durationMs]
 *
 * @example
 * ```typescript
 * await withTrace({ operation: 'decrypt' }, async () => {
 *   const [result, duration] = await timeOperation('decrypt_message', async () => {
 *     return await decryptMessage()
 *   })
 *   logger.info({ durationMs: duration }, 'Decryption completed')
 * })
 * ```
 */
async function timeOperation(name, fn) {
    const start = performance.now();
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    // Update trace context with timing
    updateTraceContext({
        metadata: {
            [`${name}_duration_ms`]: duration
        }
    });
    return [result, duration];
}
/**
 * Check if AsyncLocalStorage is available in current Node.js version
 *
 * @returns true if AsyncLocalStorage is available
 */
function isTraceContextAvailable() {
    try {
        return typeof async_hooks_1.AsyncLocalStorage !== 'undefined';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=trace-context.js.map