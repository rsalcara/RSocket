import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import * as http from 'http';
/**
 * BaileysPrometheusMetrics - Production-grade Prometheus metrics exporter
 *
 * Features:
 * - Zero overhead when disabled (default)
 * - Opt-in via BAILEYS_PROMETHEUS_ENABLED environment variable
 * - HTTP server for /metrics endpoint
 * - All metrics follow Prometheus naming conventions
 * - Custom labels support for multi-tenant scenarios
 * - Default Node.js metrics (memory, CPU, event loop, etc.)
 */
export class BaileysPrometheusMetrics {
    constructor(logger) {
        this.registry = null;
        this.server = null;
        this.logger = logger;
        this.config = this.loadConfig();
        if (this.config.enabled) {
            this.initializeRegistry();
            this.initializeMetrics();
            this.startServer();
            this.logger.info({
                port: this.config.port,
                path: this.config.path,
                prefix: this.config.prefix
            }, 'prometheus metrics enabled');
        }
        else {
            this.logger.debug('prometheus metrics disabled (set BAILEYS_PROMETHEUS_ENABLED=true to enable)');
        }
    }
    /**
     * Load configuration from environment variables
     */
    loadConfig() {
        const enabled = process.env.BAILEYS_PROMETHEUS_ENABLED === 'true';
        const port = parseInt(process.env.BAILEYS_PROMETHEUS_PORT || '9090');
        const path = process.env.BAILEYS_PROMETHEUS_PATH || '/metrics';
        const prefix = process.env.BAILEYS_PROMETHEUS_PREFIX || 'baileys_';
        let labels = {};
        try {
            if (process.env.BAILEYS_PROMETHEUS_LABELS) {
                labels = JSON.parse(process.env.BAILEYS_PROMETHEUS_LABELS);
            }
        }
        catch (err) {
            this.logger.warn({ err }, 'failed to parse BAILEYS_PROMETHEUS_LABELS, using empty labels');
        }
        const collectDefaultMetrics = process.env.BAILEYS_PROMETHEUS_COLLECT_DEFAULT !== 'false';
        return {
            enabled,
            port,
            path,
            prefix,
            labels,
            collectDefaultMetrics
        };
    }
    /**
     * Initialize Prometheus registry
     */
    initializeRegistry() {
        this.registry = new Registry();
        this.registry.setDefaultLabels(this.config.labels);
        // Collect default Node.js metrics (memory, CPU, GC, etc.)
        if (this.config.collectDefaultMetrics) {
            collectDefaultMetrics({
                register: this.registry,
                prefix: this.config.prefix
            });
        }
    }
    /**
     * Initialize all Prometheus metrics
     */
    initializeMetrics() {
        if (!this.registry)
            return;
        const { prefix } = this.config;
        // ============================================
        // CATEGORY 1: EVENT BUFFER METRICS
        // ============================================
        this.bufferFlushTotal = new Counter({
            name: `${prefix}buffer_flush_total`,
            help: 'Total number of buffer flushes',
            labelNames: ['mode', 'forced'],
            registers: [this.registry]
        });
        this.bufferFlushDuration = new Histogram({
            name: `${prefix}buffer_flush_duration_seconds`,
            help: 'Buffer flush duration in seconds',
            labelNames: ['mode'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.registry]
        });
        this.bufferItemsFlushed = new Counter({
            name: `${prefix}buffer_items_flushed_total`,
            help: 'Total number of items flushed from buffer',
            labelNames: ['mode'],
            registers: [this.registry]
        });
        this.bufferOverflowTotal = new Counter({
            name: `${prefix}buffer_overflow_total`,
            help: 'Total number of buffer overflow events',
            registers: [this.registry]
        });
        this.bufferCacheSize = new Gauge({
            name: `${prefix}buffer_cache_size`,
            help: 'Current size of buffer history cache',
            registers: [this.registry]
        });
        this.bufferCacheCleanupTotal = new Counter({
            name: `${prefix}buffer_cache_cleanup_total`,
            help: 'Total number of cache cleanup operations (LRU evictions)',
            registers: [this.registry]
        });
        this.bufferDestroyedTotal = new Counter({
            name: `${prefix}buffer_destroyed_total`,
            help: 'Total number of event buffers destroyed (prevents orphaned buffers)',
            labelNames: ['reason', 'had_pending_flush'],
            registers: [this.registry]
        });
        this.bufferFinalFlushTotal = new Counter({
            name: `${prefix}buffer_final_flush_total`,
            help: 'Total number of final flushes performed during buffer destruction',
            labelNames: ['items_count'],
            registers: [this.registry]
        });
        this.bufferActiveCount = new Gauge({
            name: `${prefix}buffer_active_count`,
            help: 'Number of currently active event buffers',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 2: ADAPTIVE FLUSH METRICS
        // ============================================
        this.adaptiveTimeoutSeconds = new Gauge({
            name: `${prefix}adaptive_timeout_seconds`,
            help: 'Current adaptive flush timeout in seconds',
            labelNames: ['mode'],
            registers: [this.registry]
        });
        this.adaptiveEventRate = new Gauge({
            name: `${prefix}adaptive_event_rate`,
            help: 'Adaptive flush event rate (events per second)',
            registers: [this.registry]
        });
        this.adaptiveBufferSizeAvg = new Gauge({
            name: `${prefix}adaptive_buffer_size_avg`,
            help: 'Adaptive flush average buffer size',
            registers: [this.registry]
        });
        this.adaptiveCircuitBreakerTrips = new Counter({
            name: `${prefix}adaptive_circuit_breaker_trips_total`,
            help: 'Total number of times circuit breaker was triggered',
            registers: [this.registry]
        });
        this.adaptiveHealthStatus = new Gauge({
            name: `${prefix}adaptive_health_status`,
            help: 'Adaptive flush health status (1=healthy, 0=unhealthy)',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 3: CONNECTION METRICS
        // ============================================
        this.connectionState = new Gauge({
            name: `${prefix}connection_state`,
            help: 'Connection state (0=disconnected, 1=connecting, 2=connected)',
            labelNames: ['connection_id', 'jid'],
            registers: [this.registry]
        });
        this.connectionErrorsTotal = new Counter({
            name: `${prefix}connection_errors_total`,
            help: 'Total number of connection errors',
            labelNames: ['error_type'],
            registers: [this.registry]
        });
        this.reconnectionAttemptsTotal = new Counter({
            name: `${prefix}reconnection_attempts_total`,
            help: 'Total number of reconnection attempts',
            labelNames: ['connection_id'],
            registers: [this.registry]
        });
        this.websocketListenersTotal = new Gauge({
            name: `${prefix}websocket_listeners_total`,
            help: 'Current number of WebSocket event listeners',
            labelNames: ['connection_id'],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 4: MESSAGE METRICS
        // ============================================
        this.messagesReceivedTotal = new Counter({
            name: `${prefix}messages_received_total`,
            help: 'Total number of messages received',
            labelNames: ['message_type'],
            registers: [this.registry]
        });
        this.messagesSentTotal = new Counter({
            name: `${prefix}messages_sent_total`,
            help: 'Total number of messages sent',
            labelNames: ['message_type', 'success'],
            registers: [this.registry]
        });
        this.messagesRetryTotal = new Counter({
            name: `${prefix}messages_retry_total`,
            help: 'Total number of message retry attempts',
            labelNames: ['retry_reason'],
            registers: [this.registry]
        });
        this.messagesProcessingDuration = new Histogram({
            name: `${prefix}messages_processing_duration_seconds`,
            help: 'Message processing duration in seconds',
            labelNames: ['message_type'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
            registers: [this.registry]
        });
        this.messageTypeMismatchFlushTotal = new Counter({
            name: `${prefix}message_type_mismatch_flush_total`,
            help: 'Total number of flushes triggered by message type mismatch (prevents type overshadowing)',
            labelNames: ['buffered_type', 'new_type'],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 5: CACHE METRICS
        // ============================================
        this.cacheSize = new Gauge({
            name: `${prefix}cache_size`,
            help: 'Current size of cache',
            labelNames: ['cache_name'],
            registers: [this.registry]
        });
        this.cacheEvictionsTotal = new Counter({
            name: `${prefix}cache_evictions_total`,
            help: 'Total number of cache evictions (LRU)',
            labelNames: ['cache_name'],
            registers: [this.registry]
        });
        this.cacheHitRate = new Gauge({
            name: `${prefix}cache_hit_rate`,
            help: 'Cache hit rate (0-1)',
            labelNames: ['cache_name'],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 6: SYSTEM METRICS
        // ============================================
        this.activeConnections = new Gauge({
            name: `${prefix}active_connections`,
            help: 'Number of active connections',
            registers: [this.registry]
        });
        this.memoryUsageBytes = new Gauge({
            name: `${prefix}memory_usage_bytes`,
            help: 'Memory usage in bytes',
            labelNames: ['type'],
            registers: [this.registry]
        });
        this.uptimeSeconds = new Gauge({
            name: `${prefix}uptime_seconds`,
            help: 'Process uptime in seconds',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 7: PRE-KEY METRICS
        // ============================================
        this.preKeyUploadsTotal = new Counter({
            name: `${prefix}prekey_uploads_total`,
            help: 'Total number of pre-key upload operations',
            registers: [this.registry]
        });
        this.preKeyUploadCount = new Counter({
            name: `${prefix}prekey_upload_count`,
            help: 'Total number of pre-keys uploaded',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 8: LID MIGRATION METRICS
        // ============================================
        this.lidMigrationTotal = new Counter({
            name: `${prefix}lid_migration_total`,
            help: 'Total number of LID session migrations',
            labelNames: ['status'],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 9: OFFLINE NOTIFICATIONS METRICS
        // ============================================
        this.offlineNotificationsTotal = new Counter({
            name: `${prefix}offline_notifications_total`,
            help: 'Total number of offline notifications processed',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 10: WEBSOCKET CONNECTION METRICS
        // ============================================
        this.websocketConnectionsTotal = new Counter({
            name: `${prefix}websocket_connections_total`,
            help: 'Total number of WebSocket connection state changes',
            labelNames: ['state'],
            registers: [this.registry]
        });
        this.websocketConnectionDuration = new Histogram({
            name: `${prefix}websocket_connection_duration_ms`,
            help: 'WebSocket connection establishment duration in milliseconds',
            buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
            registers: [this.registry]
        });
        // Start periodic system metrics collection
        this.startSystemMetricsCollection();
    }
    /**
     * Start HTTP server for /metrics endpoint
     */
    startServer() {
        if (!this.registry)
            return;
        const { port, path } = this.config;
        this.server = http.createServer((req, res) => {
            if (req.url === path && req.method === 'GET') {
                res.setHeader('Content-Type', this.registry.contentType);
                this.registry.metrics().then(metrics => {
                    res.end(metrics);
                }).catch(err => {
                    this.logger.error({ err }, 'failed to collect prometheus metrics');
                    res.statusCode = 500;
                    res.end('Internal Server Error');
                });
            }
            else {
                res.statusCode = 404;
                res.end('Not Found');
            }
        });
        this.server.listen(port, () => {
            this.logger.info({ port, path }, 'prometheus metrics server started');
        });
        this.server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                this.logger.error({ port }, 'prometheus metrics port already in use');
            }
            else {
                this.logger.error({ err }, 'prometheus metrics server error');
            }
        });
    }
    /**
     * Start periodic system metrics collection
     */
    startSystemMetricsCollection() {
        // Update memory metrics every 10 seconds
        setInterval(() => {
            if (!this.config.enabled || !this.memoryUsageBytes || !this.uptimeSeconds)
                return;
            const memUsage = process.memoryUsage();
            this.memoryUsageBytes.set({ type: 'heapUsed' }, memUsage.heapUsed);
            this.memoryUsageBytes.set({ type: 'heapTotal' }, memUsage.heapTotal);
            this.memoryUsageBytes.set({ type: 'external' }, memUsage.external);
            this.memoryUsageBytes.set({ type: 'rss' }, memUsage.rss);
            this.uptimeSeconds.set(process.uptime());
        }, 10000);
    }
    /**
     * Record buffer flush event
     */
    recordBufferFlush(mode, forced, durationMs, itemsCount) {
        if (!this.config.enabled)
            return;
        this.bufferFlushTotal?.inc({ mode, forced: String(forced) });
        this.bufferFlushDuration?.observe({ mode }, durationMs / 1000);
        this.bufferItemsFlushed?.inc({ mode }, itemsCount);
    }
    /**
     * Record buffer overflow event
     */
    recordBufferOverflow() {
        if (!this.config.enabled)
            return;
        this.bufferOverflowTotal?.inc();
    }
    /**
     * Update buffer cache size
     */
    updateBufferCacheSize(size) {
        if (!this.config.enabled)
            return;
        this.bufferCacheSize?.set(size);
    }
    /**
     * Record buffer cache cleanup
     */
    recordBufferCacheCleanup() {
        if (!this.config.enabled)
            return;
        this.bufferCacheCleanupTotal?.inc();
    }
    /**
     * Record buffer destruction event
     */
    recordBufferDestroyed(reason, hadPendingFlush) {
        if (!this.config.enabled)
            return;
        this.bufferDestroyedTotal?.inc({
            reason,
            had_pending_flush: String(hadPendingFlush)
        });
    }
    /**
     * Record final flush during buffer destruction
     */
    recordBufferFinalFlush(itemsCount) {
        if (!this.config.enabled)
            return;
        this.bufferFinalFlushTotal?.inc({
            items_count: itemsCount > 0 ? 'with_items' : 'empty'
        });
    }
    /**
     * Update active buffer count
     */
    updateBufferActiveCount(count) {
        if (!this.config.enabled)
            return;
        this.bufferActiveCount?.set(count);
    }
    /**
     * Increment active buffer count (when buffer is created)
     */
    incrementBufferActiveCount() {
        if (!this.config.enabled)
            return;
        // This assumes we're tracking it incrementally
        // If we have a way to get current value, we increment it
        // Otherwise, the application should call updateBufferActiveCount with the total
    }
    /**
     * Decrement active buffer count (when buffer is destroyed)
     */
    decrementBufferActiveCount() {
        if (!this.config.enabled)
            return;
        // This assumes we're tracking it incrementally
        // Otherwise, the application should call updateBufferActiveCount with the total
    }
    /**
     * Update adaptive flush metrics
     */
    updateAdaptiveMetrics(mode, timeoutMs, eventRate, avgBufferSize, isHealthy) {
        if (!this.config.enabled)
            return;
        this.adaptiveTimeoutSeconds?.set({ mode }, timeoutMs / 1000);
        this.adaptiveEventRate?.set(eventRate);
        this.adaptiveBufferSizeAvg?.set(avgBufferSize);
        this.adaptiveHealthStatus?.set(isHealthy ? 1 : 0);
    }
    /**
     * Record adaptive circuit breaker trip
     */
    recordAdaptiveCircuitBreakerTrip() {
        if (!this.config.enabled)
            return;
        this.adaptiveCircuitBreakerTrips?.inc();
    }
    /**
     * Update connection state
     */
    updateConnectionState(connectionId, jid, state) {
        if (!this.config.enabled)
            return;
        const stateValue = state === 'disconnected' ? 0 : state === 'connecting' ? 1 : 2;
        this.connectionState?.set({ connection_id: connectionId, jid }, stateValue);
    }
    /**
     * Record connection error
     */
    recordConnectionError(errorType) {
        if (!this.config.enabled)
            return;
        this.connectionErrorsTotal?.inc({ error_type: errorType });
    }
    /**
     * Record reconnection attempt
     */
    recordReconnectionAttempt(connectionId) {
        if (!this.config.enabled)
            return;
        this.reconnectionAttemptsTotal?.inc({ connection_id: connectionId });
    }
    /**
     * Update WebSocket listeners count
     */
    updateWebSocketListeners(connectionId, count) {
        if (!this.config.enabled)
            return;
        this.websocketListenersTotal?.set({ connection_id: connectionId }, count);
    }
    /**
     * Record message received
     */
    recordMessageReceived(messageType) {
        if (!this.config.enabled)
            return;
        this.messagesReceivedTotal?.inc({ message_type: messageType });
    }
    /**
     * Record message sent
     */
    recordMessageSent(messageType, success) {
        if (!this.config.enabled)
            return;
        this.messagesSentTotal?.inc({ message_type: messageType, success: String(success) });
    }
    /**
     * Record message retry
     */
    recordMessageRetry(retryReason) {
        if (!this.config.enabled)
            return;
        this.messagesRetryTotal?.inc({ retry_reason: retryReason });
    }
    /**
     * Record message processing duration
     */
    recordMessageProcessingDuration(messageType, durationMs) {
        if (!this.config.enabled)
            return;
        this.messagesProcessingDuration?.observe({ message_type: messageType }, durationMs / 1000);
    }
    /**
     * Record message type mismatch flush
     * This happens when buffered messages have a different type than incoming messages,
     * requiring an early flush to prevent type information loss (overshadowing)
     */
    recordMessageTypeMismatchFlush(bufferedType, newType) {
        if (!this.config.enabled)
            return;
        this.messageTypeMismatchFlushTotal?.inc({ buffered_type: bufferedType, new_type: newType });
    }
    /**
     * Update cache size
     */
    updateCacheSize(cacheName, size) {
        if (!this.config.enabled)
            return;
        this.cacheSize?.set({ cache_name: cacheName }, size);
    }
    /**
     * Record cache eviction
     */
    recordCacheEviction(cacheName) {
        if (!this.config.enabled)
            return;
        this.cacheEvictionsTotal?.inc({ cache_name: cacheName });
    }
    /**
     * Update cache hit rate
     */
    updateCacheHitRate(cacheName, hitRate) {
        if (!this.config.enabled)
            return;
        this.cacheHitRate?.set({ cache_name: cacheName }, hitRate);
    }
    /**
     * Update active connections count
     */
    updateActiveConnections(count) {
        if (!this.config.enabled)
            return;
        this.activeConnections?.set(count);
    }
    /**
     * Record pre-key upload operation
     */
    recordPreKeyUpload(count) {
        if (!this.config.enabled)
            return;
        this.preKeyUploadsTotal?.inc();
        this.preKeyUploadCount?.inc(count);
    }
    /**
     * Record LID session migration
     */
    recordLIDMigration(status) {
        if (!this.config.enabled)
            return;
        this.lidMigrationTotal?.inc({ status });
    }
    /**
     * Record offline notifications processed
     */
    recordOfflineNotifications(count) {
        if (!this.config.enabled)
            return;
        this.offlineNotificationsTotal?.inc(count);
    }
    /**
     * Record WebSocket connection state change
     * States: 'connecting', 'connected', 'closing', 'closed', 'error'
     */
    recordWebSocketConnection(state) {
        if (!this.config.enabled)
            return;
        this.websocketConnectionsTotal?.inc({ state });
    }
    /**
     * Record WebSocket connection establishment duration
     */
    recordWebSocketConnectionDuration(durationMs) {
        if (!this.config.enabled)
            return;
        this.websocketConnectionDuration?.observe(durationMs);
    }
    /**
     * Check if Prometheus is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
    /**
     * Get metrics endpoint URL
     */
    getMetricsUrl() {
        if (!this.config.enabled)
            return null;
        return `http://localhost:${this.config.port}${this.config.path}`;
    }
    /**
     * Close Prometheus server
     */
    close() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close((err) => {
                if (err) {
                    this.logger.error({ err }, 'error closing prometheus server');
                    reject(err);
                }
                else {
                    this.logger.info('prometheus server closed');
                    resolve();
                }
            });
        });
    }
}
// Singleton instance
let prometheusInstance = null;
/**
 * Initialize Prometheus metrics singleton
 */
export function initPrometheus(logger) {
    if (!prometheusInstance) {
        prometheusInstance = new BaileysPrometheusMetrics(logger);
    }
    return prometheusInstance;
}
/**
 * Get Prometheus metrics singleton instance
 */
export function getPrometheus() {
    return prometheusInstance;
}
//# sourceMappingURL=prometheus-metrics.js.map