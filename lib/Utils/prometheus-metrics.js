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
exports.BaileysPrometheusMetrics = void 0;
exports.initPrometheus = initPrometheus;
exports.getPrometheus = getPrometheus;
const prom_client_1 = require("prom-client");
const http = __importStar(require("http"));
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
class BaileysPrometheusMetrics {
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
        this.registry = new prom_client_1.Registry();
        this.registry.setDefaultLabels(this.config.labels);
        // Collect default Node.js metrics (memory, CPU, GC, etc.)
        if (this.config.collectDefaultMetrics) {
            (0, prom_client_1.collectDefaultMetrics)({
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
        this.bufferFlushTotal = new prom_client_1.Counter({
            name: `${prefix}buffer_flush_total`,
            help: 'Total number of buffer flushes',
            labelNames: ['mode', 'forced'],
            registers: [this.registry]
        });
        this.bufferFlushDuration = new prom_client_1.Histogram({
            name: `${prefix}buffer_flush_duration_seconds`,
            help: 'Buffer flush duration in seconds',
            labelNames: ['mode'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.registry]
        });
        this.bufferItemsFlushed = new prom_client_1.Counter({
            name: `${prefix}buffer_items_flushed_total`,
            help: 'Total number of items flushed from buffer',
            labelNames: ['mode'],
            registers: [this.registry]
        });
        this.bufferOverflowTotal = new prom_client_1.Counter({
            name: `${prefix}buffer_overflow_total`,
            help: 'Total number of buffer overflow events',
            registers: [this.registry]
        });
        this.bufferCacheSize = new prom_client_1.Gauge({
            name: `${prefix}buffer_cache_size`,
            help: 'Current size of buffer history cache',
            registers: [this.registry]
        });
        this.bufferCacheCleanupTotal = new prom_client_1.Counter({
            name: `${prefix}buffer_cache_cleanup_total`,
            help: 'Total number of cache cleanup operations (LRU evictions)',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 2: ADAPTIVE FLUSH METRICS
        // ============================================
        this.adaptiveTimeoutSeconds = new prom_client_1.Gauge({
            name: `${prefix}adaptive_timeout_seconds`,
            help: 'Current adaptive flush timeout in seconds',
            labelNames: ['mode'],
            registers: [this.registry]
        });
        this.adaptiveEventRate = new prom_client_1.Gauge({
            name: `${prefix}adaptive_event_rate`,
            help: 'Adaptive flush event rate (events per second)',
            registers: [this.registry]
        });
        this.adaptiveBufferSizeAvg = new prom_client_1.Gauge({
            name: `${prefix}adaptive_buffer_size_avg`,
            help: 'Adaptive flush average buffer size',
            registers: [this.registry]
        });
        this.adaptiveCircuitBreakerTrips = new prom_client_1.Counter({
            name: `${prefix}adaptive_circuit_breaker_trips_total`,
            help: 'Total number of times circuit breaker was triggered',
            registers: [this.registry]
        });
        this.adaptiveHealthStatus = new prom_client_1.Gauge({
            name: `${prefix}adaptive_health_status`,
            help: 'Adaptive flush health status (1=healthy, 0=unhealthy)',
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 3: CONNECTION METRICS
        // ============================================
        this.connectionState = new prom_client_1.Gauge({
            name: `${prefix}connection_state`,
            help: 'Connection state (0=disconnected, 1=connecting, 2=connected)',
            labelNames: ['connection_id', 'jid'],
            registers: [this.registry]
        });
        this.connectionErrorsTotal = new prom_client_1.Counter({
            name: `${prefix}connection_errors_total`,
            help: 'Total number of connection errors',
            labelNames: ['error_type'],
            registers: [this.registry]
        });
        this.reconnectionAttemptsTotal = new prom_client_1.Counter({
            name: `${prefix}reconnection_attempts_total`,
            help: 'Total number of reconnection attempts',
            labelNames: ['connection_id'],
            registers: [this.registry]
        });
        this.websocketListenersTotal = new prom_client_1.Gauge({
            name: `${prefix}websocket_listeners_total`,
            help: 'Current number of WebSocket event listeners',
            labelNames: ['connection_id'],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 4: MESSAGE METRICS
        // ============================================
        this.messagesReceivedTotal = new prom_client_1.Counter({
            name: `${prefix}messages_received_total`,
            help: 'Total number of messages received',
            labelNames: ['message_type'],
            registers: [this.registry]
        });
        this.messagesSentTotal = new prom_client_1.Counter({
            name: `${prefix}messages_sent_total`,
            help: 'Total number of messages sent',
            labelNames: ['message_type', 'success'],
            registers: [this.registry]
        });
        this.messagesRetryTotal = new prom_client_1.Counter({
            name: `${prefix}messages_retry_total`,
            help: 'Total number of message retry attempts',
            labelNames: ['retry_reason'],
            registers: [this.registry]
        });
        this.messagesProcessingDuration = new prom_client_1.Histogram({
            name: `${prefix}messages_processing_duration_seconds`,
            help: 'Message processing duration in seconds',
            labelNames: ['message_type'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 5: CACHE METRICS
        // ============================================
        this.cacheSize = new prom_client_1.Gauge({
            name: `${prefix}cache_size`,
            help: 'Current size of cache',
            labelNames: ['cache_name'],
            registers: [this.registry]
        });
        this.cacheEvictionsTotal = new prom_client_1.Counter({
            name: `${prefix}cache_evictions_total`,
            help: 'Total number of cache evictions (LRU)',
            labelNames: ['cache_name'],
            registers: [this.registry]
        });
        this.cacheHitRate = new prom_client_1.Gauge({
            name: `${prefix}cache_hit_rate`,
            help: 'Cache hit rate (0-1)',
            labelNames: ['cache_name'],
            registers: [this.registry]
        });
        // ============================================
        // CATEGORY 6: SYSTEM METRICS
        // ============================================
        this.activeConnections = new prom_client_1.Gauge({
            name: `${prefix}active_connections`,
            help: 'Number of active connections',
            registers: [this.registry]
        });
        this.memoryUsageBytes = new prom_client_1.Gauge({
            name: `${prefix}memory_usage_bytes`,
            help: 'Memory usage in bytes',
            labelNames: ['type'],
            registers: [this.registry]
        });
        this.uptimeSeconds = new prom_client_1.Gauge({
            name: `${prefix}uptime_seconds`,
            help: 'Process uptime in seconds',
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
        var _a, _b, _c;
        if (!this.config.enabled)
            return;
        (_a = this.bufferFlushTotal) === null || _a === void 0 ? void 0 : _a.inc({ mode, forced: String(forced) });
        (_b = this.bufferFlushDuration) === null || _b === void 0 ? void 0 : _b.observe({ mode }, durationMs / 1000);
        (_c = this.bufferItemsFlushed) === null || _c === void 0 ? void 0 : _c.inc({ mode }, itemsCount);
    }
    /**
     * Record buffer overflow event
     */
    recordBufferOverflow() {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.bufferOverflowTotal) === null || _a === void 0 ? void 0 : _a.inc();
    }
    /**
     * Update buffer cache size
     */
    updateBufferCacheSize(size) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.bufferCacheSize) === null || _a === void 0 ? void 0 : _a.set(size);
    }
    /**
     * Record buffer cache cleanup
     */
    recordBufferCacheCleanup() {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.bufferCacheCleanupTotal) === null || _a === void 0 ? void 0 : _a.inc();
    }
    /**
     * Update adaptive flush metrics
     */
    updateAdaptiveMetrics(mode, timeoutMs, eventRate, avgBufferSize, isHealthy) {
        var _a, _b, _c, _d;
        if (!this.config.enabled)
            return;
        (_a = this.adaptiveTimeoutSeconds) === null || _a === void 0 ? void 0 : _a.set({ mode }, timeoutMs / 1000);
        (_b = this.adaptiveEventRate) === null || _b === void 0 ? void 0 : _b.set(eventRate);
        (_c = this.adaptiveBufferSizeAvg) === null || _c === void 0 ? void 0 : _c.set(avgBufferSize);
        (_d = this.adaptiveHealthStatus) === null || _d === void 0 ? void 0 : _d.set(isHealthy ? 1 : 0);
    }
    /**
     * Record adaptive circuit breaker trip
     */
    recordAdaptiveCircuitBreakerTrip() {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.adaptiveCircuitBreakerTrips) === null || _a === void 0 ? void 0 : _a.inc();
    }
    /**
     * Update connection state
     */
    updateConnectionState(connectionId, jid, state) {
        var _a;
        if (!this.config.enabled)
            return;
        const stateValue = state === 'disconnected' ? 0 : state === 'connecting' ? 1 : 2;
        (_a = this.connectionState) === null || _a === void 0 ? void 0 : _a.set({ connection_id: connectionId, jid }, stateValue);
    }
    /**
     * Record connection error
     */
    recordConnectionError(errorType) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.connectionErrorsTotal) === null || _a === void 0 ? void 0 : _a.inc({ error_type: errorType });
    }
    /**
     * Record reconnection attempt
     */
    recordReconnectionAttempt(connectionId) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.reconnectionAttemptsTotal) === null || _a === void 0 ? void 0 : _a.inc({ connection_id: connectionId });
    }
    /**
     * Update WebSocket listeners count
     */
    updateWebSocketListeners(connectionId, count) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.websocketListenersTotal) === null || _a === void 0 ? void 0 : _a.set({ connection_id: connectionId }, count);
    }
    /**
     * Record message received
     */
    recordMessageReceived(messageType) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.messagesReceivedTotal) === null || _a === void 0 ? void 0 : _a.inc({ message_type: messageType });
    }
    /**
     * Record message sent
     */
    recordMessageSent(messageType, success) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.messagesSentTotal) === null || _a === void 0 ? void 0 : _a.inc({ message_type: messageType, success: String(success) });
    }
    /**
     * Record message retry
     */
    recordMessageRetry(retryReason) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.messagesRetryTotal) === null || _a === void 0 ? void 0 : _a.inc({ retry_reason: retryReason });
    }
    /**
     * Record message processing duration
     */
    recordMessageProcessingDuration(messageType, durationMs) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.messagesProcessingDuration) === null || _a === void 0 ? void 0 : _a.observe({ message_type: messageType }, durationMs / 1000);
    }
    /**
     * Update cache size
     */
    updateCacheSize(cacheName, size) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.cacheSize) === null || _a === void 0 ? void 0 : _a.set({ cache_name: cacheName }, size);
    }
    /**
     * Record cache eviction
     */
    recordCacheEviction(cacheName) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.cacheEvictionsTotal) === null || _a === void 0 ? void 0 : _a.inc({ cache_name: cacheName });
    }
    /**
     * Update cache hit rate
     */
    updateCacheHitRate(cacheName, hitRate) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.cacheHitRate) === null || _a === void 0 ? void 0 : _a.set({ cache_name: cacheName }, hitRate);
    }
    /**
     * Update active connections count
     */
    updateActiveConnections(count) {
        var _a;
        if (!this.config.enabled)
            return;
        (_a = this.activeConnections) === null || _a === void 0 ? void 0 : _a.set(count);
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
exports.BaileysPrometheusMetrics = BaileysPrometheusMetrics;
// Singleton instance
let prometheusInstance = null;
/**
 * Initialize Prometheus metrics singleton
 */
function initPrometheus(logger) {
    if (!prometheusInstance) {
        prometheusInstance = new BaileysPrometheusMetrics(logger);
    }
    return prometheusInstance;
}
/**
 * Get Prometheus metrics singleton instance
 */
function getPrometheus() {
    return prometheusInstance;
}
