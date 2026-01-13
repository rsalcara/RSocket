import { Counter, Gauge, Histogram } from 'prom-client';
import type { ILogger } from './logger';
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
export declare class BaileysPrometheusMetrics {
    private registry;
    private config;
    private server;
    private logger;
    bufferFlushTotal?: Counter<string>;
    bufferFlushDuration?: Histogram<string>;
    bufferItemsFlushed?: Counter<string>;
    bufferOverflowTotal?: Counter<string>;
    bufferCacheSize?: Gauge<string>;
    bufferCacheCleanupTotal?: Counter<string>;
    adaptiveTimeoutSeconds?: Gauge<string>;
    adaptiveEventRate?: Gauge<string>;
    adaptiveBufferSizeAvg?: Gauge<string>;
    adaptiveCircuitBreakerTrips?: Counter<string>;
    adaptiveHealthStatus?: Gauge<string>;
    connectionState?: Gauge<string>;
    connectionErrorsTotal?: Counter<string>;
    reconnectionAttemptsTotal?: Counter<string>;
    websocketListenersTotal?: Gauge<string>;
    messagesReceivedTotal?: Counter<string>;
    messagesSentTotal?: Counter<string>;
    messagesRetryTotal?: Counter<string>;
    messagesProcessingDuration?: Histogram<string>;
    cacheSize?: Gauge<string>;
    cacheEvictionsTotal?: Counter<string>;
    cacheHitRate?: Gauge<string>;
    activeConnections?: Gauge<string>;
    memoryUsageBytes?: Gauge<string>;
    uptimeSeconds?: Gauge<string>;
    constructor(logger: ILogger);
    /**
     * Load configuration from environment variables
     */
    private loadConfig;
    /**
     * Initialize Prometheus registry
     */
    private initializeRegistry;
    /**
     * Initialize all Prometheus metrics
     */
    private initializeMetrics;
    /**
     * Start HTTP server for /metrics endpoint
     */
    private startServer;
    /**
     * Start periodic system metrics collection
     */
    private startSystemMetricsCollection;
    /**
     * Record buffer flush event
     */
    recordBufferFlush(mode: string, forced: boolean, durationMs: number, itemsCount: number): void;
    /**
     * Record buffer overflow event
     */
    recordBufferOverflow(): void;
    /**
     * Update buffer cache size
     */
    updateBufferCacheSize(size: number): void;
    /**
     * Record buffer cache cleanup
     */
    recordBufferCacheCleanup(): void;
    /**
     * Update adaptive flush metrics
     */
    updateAdaptiveMetrics(mode: string, timeoutMs: number, eventRate: number, avgBufferSize: number, isHealthy: boolean): void;
    /**
     * Record adaptive circuit breaker trip
     */
    recordAdaptiveCircuitBreakerTrip(): void;
    /**
     * Update connection state
     */
    updateConnectionState(connectionId: string, jid: string, state: 'disconnected' | 'connecting' | 'connected'): void;
    /**
     * Record connection error
     */
    recordConnectionError(errorType: string): void;
    /**
     * Record reconnection attempt
     */
    recordReconnectionAttempt(connectionId: string): void;
    /**
     * Update WebSocket listeners count
     */
    updateWebSocketListeners(connectionId: string, count: number): void;
    /**
     * Record message received
     */
    recordMessageReceived(messageType: string): void;
    /**
     * Record message sent
     */
    recordMessageSent(messageType: string, success: boolean): void;
    /**
     * Record message retry
     */
    recordMessageRetry(retryReason: string): void;
    /**
     * Record message processing duration
     */
    recordMessageProcessingDuration(messageType: string, durationMs: number): void;
    /**
     * Update cache size
     */
    updateCacheSize(cacheName: string, size: number): void;
    /**
     * Record cache eviction
     */
    recordCacheEviction(cacheName: string): void;
    /**
     * Update cache hit rate
     */
    updateCacheHitRate(cacheName: string, hitRate: number): void;
    /**
     * Update active connections count
     */
    updateActiveConnections(count: number): void;
    /**
     * Check if Prometheus is enabled
     */
    isEnabled(): boolean;
    /**
     * Get metrics endpoint URL
     */
    getMetricsUrl(): string | null;
    /**
     * Close Prometheus server
     */
    close(): Promise<void>;
}
/**
 * Initialize Prometheus metrics singleton
 */
export declare function initPrometheus(logger: ILogger): BaileysPrometheusMetrics;
/**
 * Get Prometheus metrics singleton instance
 */
export declare function getPrometheus(): BaileysPrometheusMetrics | null;
