/**
 * Structured Logger with Pino Integration
 *
 * Modern, high-performance structured logging that replaces console.log usage.
 * Provides:
 * - **Structured logs:** JSON format for parsing and querying
 * - **Log levels:** trace, debug, info, warn, error, fatal
 * - **Correlation IDs:** Automatic trace context inclusion
 * - **Performance:** Async logging doesn't block event loop
 * - **APM compatible:** Works with Datadog, New Relic, Elastic, etc.
 *
 * ## Migration from console.log
 *
 * ```typescript
 * // Before
 * console.log('[BAILEYS] Message sent:', messageId)
 *
 * // After
 * logger.info({ messageId }, 'Message sent')
 * // Output: {"level":30,"time":1234567890,"traceId":"...","messageId":"...","msg":"Message sent"}
 * ```
 */

import type { Logger } from 'pino'
import { getTraceContext } from './trace-context'

/**
 * Baileys logger configuration
 */
export interface BaileysLoggerConfig {
	/** Base Pino logger instance */
	baseLogger: Logger

	/** Enable emoji prefixes (default: true) */
	enableEmoji?: boolean

	/** Component name for logs (default: 'baileys') */
	component?: string

	/** Minimum log level (default: from BAILEYS_LOG_LEVEL env or 'info') */
	level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

	/** Include trace context automatically (default: true) */
	includeTraceContext?: boolean
}

/**
 * Check if Baileys logging is enabled
 * Backwards compatible with existing BAILEYS_LOG env var
 */
export function isBaileysLogEnabled(): boolean {
	// If explicitly disabled, respect it
	if(process.env.BAILEYS_LOG === 'false') {
		return false
	}

	// If explicitly enabled, respect it
	if(process.env.BAILEYS_LOG === 'true') {
		return true
	}

	// Default: enabled (structured logging is cheap and valuable)
	return true
}

/**
 * Get log level from environment
 * Priority: BAILEYS_LOG_LEVEL > LOG_LEVEL > 'info'
 */
export function getBaileysLogLevel(): string {
	return process.env.BAILEYS_LOG_LEVEL || process.env.LOG_LEVEL || 'info'
}

/**
 * Emoji mapping for log events (optional visual aid)
 */
const EMOJI_MAP = {
	// Connection events
	connecting: '🔌',
	connected: '✅',
	open: '✅',
	disconnected: '🔴',
	close: '🔴',

	// Message events
	sent: '📤',
	received: '📥',
	decrypt_failed: '⚠️',

	// Auth events
	auth_success: '✅',
	auth_saved: '🔑',
	auth_cleared: '⚠️',
	qr_generated: '📱',

	// PreKey events
	prekeys_uploaded: '🔐',
	prekeys_low: '⚠️',
	prekeys_refreshed: '🔄',

	// Session events
	session_established: '🤝',

	// Buffer events
	buffer_start: '📦',
	buffer_flush: '🔄',
	buffer_overflow: '⚠️',
	buffer_timeout: '⏰',

	// Cache events
	cache_init: '💾',
	cache_limit: '⚠️',
	cache_eviction: '🗑️',
	cache_metrics: '📊',
	cache_cleanup: '🧹',

	// General
	info: 'ℹ️',
	error: '❌',
	success: '✅',
	warning: '⚠️'
}

/**
 * Create a Baileys logger instance
 *
 * @param config - Logger configuration
 * @returns Structured logger with Baileys-specific methods
 *
 * @example
 * ```typescript
 * import pino from 'pino'
 *
 * const baseLogger = pino({ level: 'info' })
 * const logger = createBaileysLogger({ baseLogger })
 *
 * logger.logConnection('open')
 * logger.logMessage('sent', { messageId: '123', to: 'user@s.whatsapp.net' })
 * ```
 */
export function createBaileysLogger(config: BaileysLoggerConfig) {
	const {
		baseLogger,
		enableEmoji = true,
		component = 'baileys',
		level = getBaileysLogLevel() as any,
		includeTraceContext = true
	} = config

	// Create child logger with component binding
	const childLogger = baseLogger.child({ component })

	// Set log level
	childLogger.level = level

	/**
	 * Get emoji prefix for event
	 */
	function getEmoji(event: string): string {
		if(!enableEmoji) return ''
		return EMOJI_MAP[event as keyof typeof EMOJI_MAP] || ''
	}

	/**
	 * Add trace context to log object if available
	 */
	function withTraceContext(obj: any): any {
		if(!includeTraceContext) return obj

		const ctx = getTraceContext()
		if(!ctx) return obj

		return {
			traceId: ctx.traceId,
			parentTraceId: ctx.parentTraceId,
			operation: ctx.operation,
			messageId: ctx.messageId,
			jid: ctx.jid,
			socketId: ctx.socketId,
			tenantId: ctx.tenantId,
			...obj
		}
	}

	/**
	 * Format message with optional emoji
	 */
	function formatMessage(event: string, message: string): string {
		const emoji = getEmoji(event)
		return emoji ? `${emoji} ${message}` : message
	}

	return {
		/**
		 * Raw logger access for custom logging
		 */
		logger: childLogger,

		/**
		 * Check if logging is enabled
		 */
		isEnabled: isBaileysLogEnabled,

		/**
		 * Log connection events
		 */
		logConnection(
			event: 'connecting' | 'open' | 'close',
			data?: { sessionName?: string; reason?: string }
		): void {
			if(!isBaileysLogEnabled()) return

			const logData = withTraceContext({
				event,
				sessionName: data?.sessionName,
				reason: data?.reason
			})

			switch(event) {
			case 'connecting':
				childLogger.info(logData, formatMessage('connecting', 'Connecting to WhatsApp'))
				break
			case 'open':
				childLogger.info(logData, formatMessage('connected', 'Connected to WhatsApp successfully'))
				break
			case 'close':
				childLogger.info(logData, formatMessage('disconnected', 'Disconnected from WhatsApp'))
				break
			}
		},

		/**
		 * Log disconnection with reason
		 */
		logDisconnect(reason: string, data?: { sessionName?: string; code?: number }): void {
			if(!isBaileysLogEnabled()) return

			childLogger.info(
				withTraceContext({
					event: 'disconnect',
					reason,
					sessionName: data?.sessionName,
					code: data?.code
				}),
				formatMessage('disconnected', `Disconnected - Reason: ${reason}`)
			)
		},

		/**
		 * Log QR code generation
		 */
		logQRGenerated(data?: { sessionName?: string }): void {
			if(!isBaileysLogEnabled()) return

			childLogger.info(
				withTraceContext({
					event: 'qr_generated',
					sessionName: data?.sessionName
				}),
				formatMessage('qr_generated', 'QR Code generated for pairing')
			)
		},

		/**
		 * Log authentication events
		 */
		logAuth(
			event: 'success' | 'saved' | 'cleared',
			data?: { sessionName?: string }
		): void {
			if(!isBaileysLogEnabled()) return

			const messages = {
				success: 'Authentication successful',
				saved: 'Credentials saved',
				cleared: 'Auth state cleared'
			}

			childLogger.info(
				withTraceContext({
					event: `auth_${event}`,
					sessionName: data?.sessionName
				}),
				formatMessage(`auth_${event}`, messages[event])
			)
		},

		/**
		 * Log message events with structured data
		 */
		logMessage(
			event: 'sent' | 'received' | 'decrypt_failed',
			details: {
				messageId?: string
				from?: string
				to?: string
				retryCount?: number
				maxRetries?: number
				jid?: string
			}
		): void {
			if(!isBaileysLogEnabled()) return

			const logData = withTraceContext({
				event: `message_${event}`,
				...details
			})

			switch(event) {
			case 'sent':
				childLogger.info(
					logData,
					formatMessage('sent', `Message sent: ${details.messageId} → ${details.to}`)
				)
				break
			case 'received':
				childLogger.debug(
					logData,
					formatMessage('received', `Message received: ${details.messageId || 'unknown'} ← ${details.from}`)
				)
				break
			case 'decrypt_failed':
				childLogger.warn(
					logData,
					formatMessage('decrypt_failed', `Message decrypt failed - Retry ${details.retryCount}/${details.maxRetries}`)
				)
				break
			}
		},

		/**
		 * Log PreKey events
		 */
		logPreKeys(
			event: 'uploaded' | 'low' | 'refreshed',
			data?: { count?: number }
		): void {
			if(!isBaileysLogEnabled()) return

			const messages = {
				uploaded: `PreKeys uploaded: ${data?.count} keys`,
				low: `PreKey count low: ${data?.count} (uploading more...)`,
				refreshed: 'PreKeys refreshed'
			}

			childLogger.info(
				withTraceContext({
					event: `prekeys_${event}`,
					count: data?.count
				}),
				formatMessage(`prekeys_${event}`, messages[event])
			)
		},

		/**
		 * Log session establishment
		 */
		logSession(contact: string, forced: boolean = false): void {
			if(!isBaileysLogEnabled()) return

			childLogger.info(
				withTraceContext({
					event: 'session_established',
					contact,
					forced
				}),
				formatMessage('session_established', `Session established with ${contact}${forced ? ' (forced)' : ''}`)
			)
		},

		/**
		 * Log errors with structured data
		 */
		logError(context: string, error: Error | string, data?: any): void {
			if(!isBaileysLogEnabled()) return

			const errorMsg = typeof error === 'string' ? error : error.message
			const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined

			childLogger.error(
				withTraceContext({
					context,
					error: errorMsg,
					stack: errorStack,
					...data
				}),
				formatMessage('error', `Error in ${context}: ${errorMsg}`)
			)
		},

		/**
		 * Log general info
		 */
		logInfo(message: string, data?: any): void {
			if(!isBaileysLogEnabled()) return

			childLogger.info(
				withTraceContext(data || {}),
				formatMessage('info', message)
			)
		},

		/**
		 * Log event buffer operations
		 */
		logEventBuffer(
			event: 'buffer_start' | 'buffer_flush' | 'buffer_overflow' | 'buffer_timeout' | 'cache_cleanup',
			details?: {
				itemsBuffered?: number
				flushCount?: number
				historyCacheSize?: number
				maxItems?: number
				removed?: number
				remaining?: number
			}
		): void {
			if(!isBaileysLogEnabled()) return

			const messages = {
				buffer_start: 'Event buffering started',
				buffer_flush: 'Event buffer flushed',
				buffer_overflow: 'Buffer overflow detected - Force flushing',
				buffer_timeout: 'Buffer auto-flush triggered by timeout',
				cache_cleanup: 'History cache cleaned'
			}

			const level = event === 'buffer_overflow' ? 'warn' : 'debug'

			childLogger[level](
				withTraceContext({
					event,
					...details
				}),
				formatMessage(event, messages[event])
			)
		},

		/**
		 * Log buffer metrics
		 */
		logBufferMetrics(metrics: {
			itemsBuffered: number
			flushCount: number
			historyCacheSize: number
			buffersInProgress: number
		}): void {
			if(!isBaileysLogEnabled()) return

			childLogger.debug(
				withTraceContext({ event: 'buffer_metrics', ...metrics }),
				formatMessage('cache_metrics', 'Buffer Metrics')
			)
		},

		/**
		 * Log cache memory operations
		 */
		logCacheMemory(
			event: 'init' | 'limit_reached' | 'eviction' | 'metrics',
			details: {
				cacheName: string
				size?: number
				maxKeys?: number
				evictedKeys?: number
				utilizationPct?: number
				ttl?: number
			}
		): void {
			if(!isBaileysLogEnabled()) return

			const messages = {
				init: `Cache initialized: ${details.cacheName}`,
				limit_reached: `Cache limit reached: ${details.cacheName}`,
				eviction: `Cache eviction: ${details.cacheName}`,
				metrics: `Cache metrics: ${details.cacheName}`
			}

			const level = event === 'limit_reached' ? 'warn' : 'debug'

			childLogger[level](
				withTraceContext({
					event: `cache_${event}`,
					...details
				}),
				formatMessage(`cache_${event}`, messages[event])
			)
		},

		/**
		 * Log socket cache metrics summary
		 */
		logSocketCacheMetrics(metrics: {
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
			if(!isBaileysLogEnabled()) return

			childLogger.debug(
				withTraceContext({
					event: 'socket_cache_summary',
					...metrics
				}),
				formatMessage('cache_metrics', 'Socket Cache Summary')
			)
		}
	}
}

/**
 * Type for Baileys logger instance
 */
export type BaileysLogger = ReturnType<typeof createBaileysLogger>
