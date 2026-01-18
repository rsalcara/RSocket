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
export function isBaileysLogEnabled(): boolean {
	return process.env.BAILEYS_LOG === 'true'
}

/**
 * Log message if BAILEYS_LOG is enabled
 * @param message - Message to log (with emoji prefix recommended)
 * @param data - Optional data object to include
 */
export function baileysLog(message: string, data?: any): void {
	if (isBaileysLogEnabled()) {
		if (data !== undefined) {
			console.log(`[BAILEYS] ${message}`, data)
		} else {
			console.log(`[BAILEYS] ${message}`)
		}
	}
}

/**
 * Log connection event
 */
export function logConnection(event: 'connecting' | 'open' | 'close', sessionName?: string): void {
	if (!isBaileysLogEnabled()) return

	const session = sessionName ? ` [${sessionName}]` : ''
	switch (event) {
	case 'connecting':
		console.log(`[BAILEYS]${session} 🔌 Connecting to WhatsApp...`)
		break
	case 'open':
		console.log(`[BAILEYS]${session} ✅ Connected to WhatsApp successfully`)
		break
	case 'close':
		console.log(`[BAILEYS]${session} 🔴 Disconnected from WhatsApp`)
		break
	}
}

/**
 * Log disconnection with reason
 */
export function logDisconnect(reason: string, sessionName?: string): void {
	if (!isBaileysLogEnabled()) return
	const session = sessionName ? ` [${sessionName}]` : ''
	console.log(`[BAILEYS]${session} 🔴 Disconnected - Reason: ${reason}`)
}

/**
 * Log QR code generation
 */
export function logQRGenerated(sessionName?: string): void {
	if (!isBaileysLogEnabled()) return
	const session = sessionName ? ` [${sessionName}]` : ''
	console.log(`[BAILEYS]${session} 📱 QR Code generated for pairing`)
}

/**
 * Log authentication events
 */
export function logAuth(event: 'success' | 'saved' | 'cleared', sessionName?: string): void {
	if (!isBaileysLogEnabled()) return
	const session = sessionName ? ` [${sessionName}]` : ''

	switch (event) {
	case 'success':
		console.log(`[BAILEYS]${session} ✅ Authentication successful`)
		break
	case 'saved':
		console.log(`[BAILEYS]${session} 🔑 Credentials saved`)
		break
	case 'cleared':
		console.log(`[BAILEYS]${session} ⚠️  Auth state cleared`)
		break
	}
}

/**
 * Log message events
 */
export function logMessage(event: 'sent' | 'received' | 'decrypt_failed', details: {
	messageId?: string
	from?: string
	to?: string
	retryCount?: number
	maxRetries?: number
}): void {
	if (!isBaileysLogEnabled()) return

	switch (event) {
	case 'sent':
		console.log(`[BAILEYS] 📤 Message sent: ${details.messageId} → ${details.to}`)
		break
	case 'received':
		if (details.messageId) {
			console.log(`[BAILEYS] 📥 Message received: ${details.messageId} ← ${details.from}`)
		} else {
			console.log(`[BAILEYS] 📥 Message received from ${details.from}`)
		}
		break
	case 'decrypt_failed':
		console.log(`[BAILEYS] ⚠️  Message decrypt failed - Retry ${details.retryCount}/${details.maxRetries}`)
		break
	}
}

/**
 * Log PreKey events
 */
export function logPreKeys(event: 'uploaded' | 'low' | 'refreshed' | 'rotated', count?: number): void {
	if (!isBaileysLogEnabled()) return

	switch (event) {
	case 'uploaded':
		console.log(`[BAILEYS] 🔐 PreKeys uploaded: ${count} keys`)
		break
	case 'low':
		console.log(`[BAILEYS] ⚠️  PreKey count low: ${count} (uploading more...)`)
		break
	case 'refreshed':
		console.log(`[BAILEYS] 🔄 PreKeys refreshed`)
		break
	case 'rotated':
		console.log(`[BAILEYS] 🔄 Signed PreKey rotated`)
		break
	}
}

/**
 * Log session establishment
 */
export function logSession(contact: string, forced: boolean = false): void {
	if (!isBaileysLogEnabled()) return
	const forceStr = forced ? ' (forced)' : ''
	console.log(`[BAILEYS] 🤝 Session established with ${contact}${forceStr}`)
}

/**
 * Log error events
 */
export function logError(context: string, error: Error | string): void {
	if (!isBaileysLogEnabled()) return
	const errorMsg = typeof error === 'string' ? error : error.message
	console.log(`[BAILEYS] ❌ Error in ${context}: ${errorMsg}`)
}

/**
 * Log general info
 */
export function logInfo(message: string, data?: any): void {
	if (!isBaileysLogEnabled()) return
	if (data !== undefined) {
		console.log(`[BAILEYS] ℹ️  ${message}`, data)
	} else {
		console.log(`[BAILEYS] ℹ️  ${message}`)
	}
}

/**
 * Log event buffer operations
 */
export function logEventBuffer(event: 'buffer_start' | 'buffer_flush' | 'buffer_overflow' | 'buffer_timeout' | 'cache_cleanup' | 'adaptive_flush_enabled' | 'buffer_destroyed' | 'type_mismatch_flush', details?: {
	itemsBuffered?: number
	flushCount?: number
	historyCacheSize?: number
	maxItems?: number
	removed?: number
	remaining?: number
	autoFlushed?: boolean
	adaptiveMode?: string
	timeoutMs?: number
	flushDuration?: number
	minTimeout?: number
	maxTimeout?: number
	mode?: string
	// New fields for buffer_destroyed and type_mismatch_flush
	bufferedType?: string
	newType?: string
	messageCount?: number
}): void {
	if (!isBaileysLogEnabled()) return

	switch (event) {
	case 'buffer_start':
		console.log(`[BAILEYS] 📦 Event buffering started`)
		break
	case 'buffer_flush':
		const flushDetails: any = {
			flushCount: details?.flushCount,
			historyCacheSize: details?.historyCacheSize
		}
		if(details?.adaptiveMode) {
			flushDetails.mode = details.adaptiveMode
		}
		if(details?.flushDuration) {
			flushDetails.duration = `${details.flushDuration}ms`
		}
		console.log(`[BAILEYS] 🔄 Event buffer flushed`, flushDetails)
		break
	case 'buffer_overflow':
		console.log(`[BAILEYS] ⚠️  Buffer overflow detected - Force flushing`, {
			itemsBuffered: details?.itemsBuffered,
			maxItems: details?.maxItems
		})
		break
	case 'buffer_timeout':
		const timeoutDetails: any = {}
		if(details?.mode) {
			timeoutDetails.mode = details.mode
		}
		if(details?.timeoutMs) {
			timeoutDetails.timeout = `${details.timeoutMs}ms`
		}
		console.log(`[BAILEYS] ⏰ Buffer auto-flush triggered by timeout`, timeoutDetails)
		break
	case 'adaptive_flush_enabled':
		console.log(`[BAILEYS] 🧠 Adaptive flush enabled`, {
			minTimeout: `${details?.minTimeout}ms`,
			maxTimeout: `${details?.maxTimeout}ms`
		})
		break
	case 'cache_cleanup':
		console.log(`[BAILEYS] 🧹 History cache cleaned`, {
			removed: details?.removed,
			remaining: details?.remaining
		})
		break
	case 'buffer_destroyed':
		console.log(`[BAILEYS] 💀 Event buffer destroyed`, {
			flushCount: details?.flushCount,
			historyCacheSize: details?.historyCacheSize
		})
		break
	case 'type_mismatch_flush':
		console.log(`[BAILEYS] ⚡ Type mismatch flush - emitting buffered messages early`, {
			bufferedType: details?.bufferedType,
			newType: details?.newType,
			messageCount: details?.messageCount
		})
		break
	}
}

/**
 * Log event buffer metrics (periodic monitoring)
 */
export function logBufferMetrics(metrics: {
	itemsBuffered: number
	flushCount: number
	historyCacheSize: number
	buffersInProgress: number
	adaptive?: {
		mode: string
		timeout: number
		eventRate: number
		isHealthy: boolean
	}
}): void {
	if (!isBaileysLogEnabled()) return
	console.log(`[BAILEYS] 📊 Buffer Metrics`, metrics)
}

/**
 * Log cache memory operations and metrics
 *
 * Memory leak prevention (Issue #3):
 * Monitors cache memory usage and warns when approaching limits
 */
export function logCacheMemory(event: 'init' | 'limit_reached' | 'eviction' | 'metrics', details: {
	cacheName: string
	size?: number
	maxKeys?: number
	evictedKeys?: number
	utilizationPct?: number
	ttl?: number
}): void {
	if (!isBaileysLogEnabled()) return

	const { cacheName, size, maxKeys, evictedKeys, utilizationPct, ttl } = details

	switch (event) {
	case 'init':
		console.log(`[BAILEYS] 💾 Cache initialized: ${cacheName}`, {
			maxKeys,
			ttl: ttl ? `${ttl}s` : 'N/A'
		})
		break
	case 'limit_reached':
		console.log(`[BAILEYS] ⚠️  Cache limit reached: ${cacheName}`, {
			size,
			maxKeys,
			utilizationPct: `${utilizationPct}%`
		})
		break
	case 'eviction':
		console.log(`[BAILEYS] 🗑️  Cache eviction: ${cacheName}`, {
			evictedKeys,
			remaining: size
		})
		break
	case 'metrics':
		console.log(`[BAILEYS] 📊 Cache metrics: ${cacheName}`, {
			size,
			maxKeys,
			utilizationPct: `${utilizationPct?.toFixed(1)}%`
		})
		break
	}
}

/**
 * Log aggregate cache metrics for all caches in a socket
 */
export function logSocketCacheMetrics(metrics: {
	userDevicesCache: { size: number; maxKeys: number }
	lidCache: { size: number; maxKeys: number }
	msgRetryCache: { size: number; maxKeys: number }
	callOfferCache: { size: number; maxKeys: number }
	placeholderResendCache: { size: number; maxKeys: number }
	signalStore: { size: number; maxKeys: number }
	totalKeys: number
	totalMaxKeys: number
	avgUtilization: number
}): void {
	if (!isBaileysLogEnabled()) return
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
	})
}
