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
		console.log(`[BAILEYS] 📥 Message received from ${details.from}`)
		break
	case 'decrypt_failed':
		console.log(`[BAILEYS] ⚠️  Message decrypt failed - Retry ${details.retryCount}/${details.maxRetries}`)
		break
	}
}

/**
 * Log PreKey events
 */
export function logPreKeys(event: 'uploaded' | 'low' | 'refreshed', count?: number): void {
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
export function logEventBuffer(event: 'buffer_start' | 'buffer_flush' | 'buffer_overflow' | 'buffer_timeout' | 'cache_cleanup', details?: {
	itemsBuffered?: number
	flushCount?: number
	historyCacheSize?: number
	maxItems?: number
	removed?: number
	remaining?: number
	autoFlushed?: boolean
}): void {
	if (!isBaileysLogEnabled()) return

	switch (event) {
	case 'buffer_start':
		console.log(`[BAILEYS] 📦 Event buffering started`)
		break
	case 'buffer_flush':
		console.log(`[BAILEYS] 🔄 Event buffer flushed`, {
			flushCount: details?.flushCount,
			historyCacheSize: details?.historyCacheSize
		})
		break
	case 'buffer_overflow':
		console.log(`[BAILEYS] ⚠️  Buffer overflow detected - Force flushing`, {
			itemsBuffered: details?.itemsBuffered,
			maxItems: details?.maxItems
		})
		break
	case 'buffer_timeout':
		console.log(`[BAILEYS] ⏰ Buffer auto-flush triggered by timeout`)
		break
	case 'cache_cleanup':
		console.log(`[BAILEYS] 🧹 History cache cleaned`, {
			removed: details?.removed,
			remaining: details?.remaining
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
}): void {
	if (!isBaileysLogEnabled()) return
	console.log(`[BAILEYS] 📊 Buffer Metrics`, metrics)
}
