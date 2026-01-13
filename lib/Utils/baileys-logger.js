"use strict";
/**
 * Baileys Logger Utility
 *
 * Provides controlled logging that can be enabled/disabled via BAILEYS_LOG environment variable.
 * When enabled, logs appear with [BAILEYS] prefix for easy filtering.
 *
 * Usage in zpro-backend:
 *   Set BAILEYS_LOG=true in .env file to enable detailed Baileys logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBaileysLogEnabled = isBaileysLogEnabled;
exports.baileysLog = baileysLog;
exports.logConnection = logConnection;
exports.logDisconnect = logDisconnect;
exports.logQRGenerated = logQRGenerated;
exports.logAuth = logAuth;
exports.logMessage = logMessage;
exports.logPreKeys = logPreKeys;
exports.logSession = logSession;
exports.logError = logError;
exports.logInfo = logInfo;
exports.logEventBuffer = logEventBuffer;
exports.logBufferMetrics = logBufferMetrics;
exports.logCacheMemory = logCacheMemory;
exports.logSocketCacheMetrics = logSocketCacheMetrics;
/**
 * Check if Baileys logging is enabled
 */
function isBaileysLogEnabled() {
    return process.env.BAILEYS_LOG === 'true';
}
/**
 * Log message if BAILEYS_LOG is enabled
 * @param message - Message to log (with emoji prefix recommended)
 * @param data - Optional data object to include
 */
function baileysLog(message, data) {
    if (isBaileysLogEnabled()) {
        if (data !== undefined) {
            console.log(`[BAILEYS] ${message}`, data);
        }
        else {
            console.log(`[BAILEYS] ${message}`);
        }
    }
}
/**
 * Log connection event
 */
function logConnection(event, sessionName) {
    if (!isBaileysLogEnabled())
        return;
    const session = sessionName ? ` [${sessionName}]` : '';
    switch (event) {
        case 'connecting':
            console.log(`[BAILEYS]${session} 🔌 Connecting to WhatsApp...`);
            break;
        case 'open':
            console.log(`[BAILEYS]${session} ✅ Connected to WhatsApp successfully`);
            break;
        case 'close':
            console.log(`[BAILEYS]${session} 🔴 Disconnected from WhatsApp`);
            break;
    }
}
/**
 * Log disconnection with reason
 */
function logDisconnect(reason, sessionName) {
    if (!isBaileysLogEnabled())
        return;
    const session = sessionName ? ` [${sessionName}]` : '';
    console.log(`[BAILEYS]${session} 🔴 Disconnected - Reason: ${reason}`);
}
/**
 * Log QR code generation
 */
function logQRGenerated(sessionName) {
    if (!isBaileysLogEnabled())
        return;
    const session = sessionName ? ` [${sessionName}]` : '';
    console.log(`[BAILEYS]${session} 📱 QR Code generated for pairing`);
}
/**
 * Log authentication events
 */
function logAuth(event, sessionName) {
    if (!isBaileysLogEnabled())
        return;
    const session = sessionName ? ` [${sessionName}]` : '';
    switch (event) {
        case 'success':
            console.log(`[BAILEYS]${session} ✅ Authentication successful`);
            break;
        case 'saved':
            console.log(`[BAILEYS]${session} 🔑 Credentials saved`);
            break;
        case 'cleared':
            console.log(`[BAILEYS]${session} ⚠️  Auth state cleared`);
            break;
    }
}
/**
 * Log message events
 */
function logMessage(event, details) {
    if (!isBaileysLogEnabled())
        return;
    switch (event) {
        case 'sent':
            console.log(`[BAILEYS] 📤 Message sent: ${details.messageId} → ${details.to}`);
            break;
        case 'received':
            if (details.messageId) {
                console.log(`[BAILEYS] 📥 Message received: ${details.messageId} ← ${details.from}`);
            }
            else {
                console.log(`[BAILEYS] 📥 Message received from ${details.from}`);
            }
            break;
        case 'decrypt_failed':
            console.log(`[BAILEYS] ⚠️  Message decrypt failed - Retry ${details.retryCount}/${details.maxRetries}`);
            break;
    }
}
/**
 * Log PreKey events
 */
function logPreKeys(event, count) {
    if (!isBaileysLogEnabled())
        return;
    switch (event) {
        case 'uploaded':
            console.log(`[BAILEYS] 🔐 PreKeys uploaded: ${count} keys`);
            break;
        case 'low':
            console.log(`[BAILEYS] ⚠️  PreKey count low: ${count} (uploading more...)`);
            break;
        case 'refreshed':
            console.log(`[BAILEYS] 🔄 PreKeys refreshed`);
            break;
    }
}
/**
 * Log session establishment
 */
function logSession(contact, forced = false) {
    if (!isBaileysLogEnabled())
        return;
    const forceStr = forced ? ' (forced)' : '';
    console.log(`[BAILEYS] 🤝 Session established with ${contact}${forceStr}`);
}
/**
 * Log error events
 */
function logError(context, error) {
    if (!isBaileysLogEnabled())
        return;
    const errorMsg = typeof error === 'string' ? error : error.message;
    console.log(`[BAILEYS] ❌ Error in ${context}: ${errorMsg}`);
}
/**
 * Log general info
 */
function logInfo(message, data) {
    if (!isBaileysLogEnabled())
        return;
    if (data !== undefined) {
        console.log(`[BAILEYS] ℹ️  ${message}`, data);
    }
    else {
        console.log(`[BAILEYS] ℹ️  ${message}`);
    }
}
/**
 * Log event buffer operations
 */
function logEventBuffer(event, details) {
    if (!isBaileysLogEnabled())
        return;
    switch (event) {
        case 'buffer_start':
            console.log(`[BAILEYS] 📦 Event buffering started`);
            break;
        case 'buffer_flush':
            const flushDetails = {
                flushCount: details === null || details === void 0 ? void 0 : details.flushCount,
                historyCacheSize: details === null || details === void 0 ? void 0 : details.historyCacheSize
            };
            if (details === null || details === void 0 ? void 0 : details.adaptiveMode) {
                flushDetails.mode = details.adaptiveMode;
            }
            if (details === null || details === void 0 ? void 0 : details.flushDuration) {
                flushDetails.duration = `${details.flushDuration}ms`;
            }
            console.log(`[BAILEYS] 🔄 Event buffer flushed`, flushDetails);
            break;
        case 'buffer_overflow':
            console.log(`[BAILEYS] ⚠️  Buffer overflow detected - Force flushing`, {
                itemsBuffered: details === null || details === void 0 ? void 0 : details.itemsBuffered,
                maxItems: details === null || details === void 0 ? void 0 : details.maxItems
            });
            break;
        case 'buffer_timeout':
            const timeoutDetails = {};
            if (details === null || details === void 0 ? void 0 : details.mode) {
                timeoutDetails.mode = details.mode;
            }
            if (details === null || details === void 0 ? void 0 : details.timeoutMs) {
                timeoutDetails.timeout = `${details.timeoutMs}ms`;
            }
            console.log(`[BAILEYS] ⏰ Buffer auto-flush triggered by timeout`, timeoutDetails);
            break;
        case 'adaptive_flush_enabled':
            console.log(`[BAILEYS] 🧠 Adaptive flush enabled`, {
                minTimeout: `${details === null || details === void 0 ? void 0 : details.minTimeout}ms`,
                maxTimeout: `${details === null || details === void 0 ? void 0 : details.maxTimeout}ms`
            });
            break;
        case 'cache_cleanup':
            console.log(`[BAILEYS] 🧹 History cache cleaned`, {
                removed: details === null || details === void 0 ? void 0 : details.removed,
                remaining: details === null || details === void 0 ? void 0 : details.remaining
            });
            break;
    }
}
/**
 * Log event buffer metrics (periodic monitoring)
 */
function logBufferMetrics(metrics) {
    if (!isBaileysLogEnabled())
        return;
    console.log(`[BAILEYS] 📊 Buffer Metrics`, metrics);
}
/**
 * Log cache memory operations and metrics
 *
 * Memory leak prevention (Issue #3):
 * Monitors cache memory usage and warns when approaching limits
 */
function logCacheMemory(event, details) {
    if (!isBaileysLogEnabled())
        return;
    const { cacheName, size, maxKeys, evictedKeys, utilizationPct, ttl } = details;
    switch (event) {
        case 'init':
            console.log(`[BAILEYS] 💾 Cache initialized: ${cacheName}`, {
                maxKeys,
                ttl: ttl ? `${ttl}s` : 'N/A'
            });
            break;
        case 'limit_reached':
            console.log(`[BAILEYS] ⚠️  Cache limit reached: ${cacheName}`, {
                size,
                maxKeys,
                utilizationPct: `${utilizationPct}%`
            });
            break;
        case 'eviction':
            console.log(`[BAILEYS] 🗑️  Cache eviction: ${cacheName}`, {
                evictedKeys,
                remaining: size
            });
            break;
        case 'metrics':
            console.log(`[BAILEYS] 📊 Cache metrics: ${cacheName}`, {
                size,
                maxKeys,
                utilizationPct: `${utilizationPct === null || utilizationPct === void 0 ? void 0 : utilizationPct.toFixed(1)}%`
            });
            break;
    }
}
/**
 * Log aggregate cache metrics for all caches in a socket
 */
function logSocketCacheMetrics(metrics) {
    if (!isBaileysLogEnabled())
        return;
    console.log(`[BAILEYS] 📊 Socket Cache Summary`, {
        totalKeys: metrics.totalKeys,
        totalMaxKeys: metrics.totalMaxKeys,
        avgUtilization: `${metrics.avgUtilization.toFixed(1)}%`,
        caches: {
            userDevices: `${metrics.userDevicesCache.size}/${metrics.userDevicesCache.maxKeys}`,
            lid: `${metrics.lidCache.size}/${metrics.lidCache.maxKeys}`,
            msgRetry: `${metrics.msgRetryCache.size}/${metrics.msgRetryCache.maxKeys}`,
            callOffer: `${metrics.callOfferCache.size}/${metrics.callOfferCache.maxKeys}`,
            placeholder: `${metrics.placeholderResendCache.size}/${metrics.placeholderResendCache.maxKeys}`,
            signal: `${metrics.signalStore.size}/${metrics.signalStore.maxKeys}`
        }
    });
}
