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
/**
 * Trace context data structure
 */
export interface TraceContext {
    /** Unique trace ID for this operation (UUID v4 format) */
    traceId: string;
    /** Optional parent trace ID for nested operations */
    parentTraceId?: string;
    /** Operation name (e.g., 'send_message', 'decrypt_message', 'process_receipt') */
    operation?: string;
    /** Message ID being processed */
    messageId?: string;
    /** JID (user/group identifier) */
    jid?: string;
    /** Socket/session identifier for multi-tenant tracking */
    socketId?: string;
    /** Tenant ID for multi-tenant environments */
    tenantId?: string | number;
    /** Timestamp when trace started (ISO 8601) */
    timestamp: string;
    /** Custom metadata */
    metadata?: Record<string, any>;
}
/**
 * Generate a UUID v4 trace ID
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export declare function generateTraceId(): string;
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
export declare function getTraceContext(): TraceContext | undefined;
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
export declare function getOrCreateTraceId(): string;
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
export declare function withTrace<T>(context: Partial<Omit<TraceContext, 'traceId' | 'timestamp'>> & {
    traceId?: string;
}, fn: () => Promise<T>): Promise<T>;
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
export declare function withTraceSync<T>(context: Partial<Omit<TraceContext, 'traceId' | 'timestamp'>> & {
    traceId?: string;
}, fn: () => T): T;
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
export declare function updateTraceContext(updates: Partial<Omit<TraceContext, 'traceId' | 'timestamp'>>): TraceContext | undefined;
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
export declare function createTracedLogger(baseLogger: any): any;
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
export declare function extractTraceIdFromHeaders(headers: Record<string, any>): string | undefined;
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
export declare function timeOperation<T>(name: string, fn: () => Promise<T>): Promise<[T, number]>;
/**
 * Check if AsyncLocalStorage is available in current Node.js version
 *
 * @returns true if AsyncLocalStorage is available
 */
export declare function isTraceContextAvailable(): boolean;
