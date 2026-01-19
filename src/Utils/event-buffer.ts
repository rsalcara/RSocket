import EventEmitter from 'events'
import { proto } from '../../WAProto'
import type {
	BaileysEvent,
	BaileysEventEmitter,
	BaileysEventMap,
	BufferedEventData,
	Chat,
	ChatUpdate,
	Contact,
	WAMessage,
	WAMessageKey
} from '../Types'
import { WAMessageStatus } from '../Types'
import { trimUndefined } from './generics'
import type { ILogger } from './logger'
import { updateMessageWithReaction, updateMessageWithReceipt } from './messages'
import { isRealMessage, shouldIncrementChatUnread } from './process-message'
import { logEventBuffer, logBufferMetrics } from './baileys-logger'
import { getPrometheus } from './prometheus-metrics'

const BUFFERABLE_EVENT = [
	'messaging-history.set',
	'chats.upsert',
	'chats.update',
	'chats.delete',
	'contacts.upsert',
	'contacts.update',
	'messages.upsert',
	'messages.update',
	'messages.delete',
	'messages.reaction',
	'message-receipt.update',
	'groups.update'
] as const

type BufferableEvent = (typeof BUFFERABLE_EVENT)[number]

/**
 * A map that contains a list of all events that have been triggered
 *
 * Note, this can contain different type of events
 * this can make processing events extremely efficient -- since everything
 * can be done in a single transaction
 */
type BaileysEventData = Partial<BaileysEventMap>

const BUFFERABLE_EVENT_SET = new Set<BaileysEvent>(BUFFERABLE_EVENT)

type BaileysBufferableEventEmitter = BaileysEventEmitter & {
	/** Use to process events in a batch */
	process(handler: (events: BaileysEventData) => void | Promise<void>): () => void
	/**
	 * starts buffering events, call flush() to release them
	 * */
	buffer(): void
	/** buffers all events till the promise completes */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	createBufferedFunction<A extends any[], T>(work: (...args: A) => Promise<T>): (...args: A) => Promise<T>
	/**
	 * flushes all buffered events
	 * @param force if true, will flush all data regardless of any pending buffers
	 * @returns returns true if the flush actually happened, otherwise false
	 */
	flush(force?: boolean): boolean
	/** is there an ongoing buffer */
	isBuffering(): boolean
	/**
	 * Destroys the buffer and cleans up all resources.
	 * Prevents memory leaks and orphaned timers when socket disconnects.
	 * This is automatically called when the socket closes.
	 */
	destroy(): void
}

/**
 * The event buffer logically consolidates different events into a single event
 * making the data processing more efficient.
 * @param ev the baileys event emitter
 */
/**
 * Buffer configuration to prevent memory leaks and optimize performance.
 *
 * These values can be configured via environment variables:
 * - BAILEYS_BUFFER_MAX_CACHE: Maximum items in history cache before cleanup (default: 10000)
 * - BAILEYS_BUFFER_MAX_ITEMS: Maximum items per buffer before force flush (default: 1000)
 * - BAILEYS_BUFFER_TIMEOUT_MS: Auto-flush timeout in milliseconds (default: 5000)
 * - BAILEYS_BUFFER_AUTO_FLUSH: Enable automatic timeout-based flushing (default: true)
 * - BAILEYS_BUFFER_ADAPTIVE_FLUSH: Enable adaptive flush algorithm (default: false)
 * - BAILEYS_BUFFER_ADAPTIVE_MIN_TIMEOUT: Minimum adaptive timeout in ms (default: 1000)
 * - BAILEYS_BUFFER_ADAPTIVE_MAX_TIMEOUT: Maximum adaptive timeout in ms (default: 10000)
 * - BAILEYS_BUFFER_ADAPTIVE_LEARNING_RATE: How aggressively to adapt 0-1 (default: 0.3)
 *
 * If not set, sensible defaults are used.
 *
 * Example (.env file):
 * ```
 * BAILEYS_BUFFER_MAX_CACHE=20000
 * BAILEYS_BUFFER_MAX_ITEMS=2000
 * BAILEYS_BUFFER_TIMEOUT_MS=3000
 * BAILEYS_BUFFER_AUTO_FLUSH=true
 * BAILEYS_BUFFER_ADAPTIVE_FLUSH=true
 * BAILEYS_BUFFER_ADAPTIVE_MIN_TIMEOUT=1000
 * BAILEYS_BUFFER_ADAPTIVE_MAX_TIMEOUT=10000
 * ```
 */
export const BUFFER_CONFIG = {
	MAX_HISTORY_CACHE_SIZE: parseInt(process.env.BAILEYS_BUFFER_MAX_CACHE || '10000'),
	MAX_BUFFER_ITEMS: parseInt(process.env.BAILEYS_BUFFER_MAX_ITEMS || '1000'),
	AUTO_FLUSH_TIMEOUT_MS: parseInt(process.env.BAILEYS_BUFFER_TIMEOUT_MS || '5000'),
	ENABLE_AUTO_FLUSH: process.env.BAILEYS_BUFFER_AUTO_FLUSH !== 'false',
	// Adaptive flush configuration (disabled by default for safety)
	ENABLE_ADAPTIVE_FLUSH: process.env.BAILEYS_BUFFER_ADAPTIVE_FLUSH === 'true',
	ADAPTIVE_MIN_TIMEOUT_MS: parseInt(process.env.BAILEYS_BUFFER_ADAPTIVE_MIN_TIMEOUT || '1000'),
	ADAPTIVE_MAX_TIMEOUT_MS: parseInt(process.env.BAILEYS_BUFFER_ADAPTIVE_MAX_TIMEOUT || '10000'),
	ADAPTIVE_LEARNING_RATE: parseFloat(process.env.BAILEYS_BUFFER_ADAPTIVE_LEARNING_RATE || '0.3')
}

/**
 * Adaptive flush metrics and state
 */
interface AdaptiveFlushMetrics {
	eventRate: number // Events per second
	averageBufferSize: number // Average number of items buffered
	averageFlushDuration: number // Average time to complete a flush (ms)
	lastFlushTimestamp: number // When the last flush occurred
	consecutiveSlowFlushes: number // Count of slow flushes (circuit breaker)
	isHealthy: boolean // Whether adaptive algorithm is functioning well
	calculatedTimeout: number // Current calculated timeout
	mode: 'aggressive' | 'balanced' | 'conservative' | 'disabled'
}

/**
 * Calculate adaptive timeout based on current load and performance metrics
 */
function calculateAdaptiveTimeout(
	metrics: AdaptiveFlushMetrics,
	config: typeof BUFFER_CONFIG
): number {
	// If not healthy or disabled, return fixed timeout
	if(!metrics.isHealthy || !config.ENABLE_ADAPTIVE_FLUSH) {
		return config.AUTO_FLUSH_TIMEOUT_MS
	}

	const {
		eventRate,
		averageBufferSize,
		averageFlushDuration
	} = metrics

	const {
		ADAPTIVE_MIN_TIMEOUT_MS,
		ADAPTIVE_MAX_TIMEOUT_MS,
		ADAPTIVE_LEARNING_RATE,
		MAX_BUFFER_ITEMS
	} = config

	// Calculate load factor (0-1 scale)
	// High load = many events coming in OR buffer filling quickly
	const eventLoadFactor = Math.min(eventRate / 50, 1) // Normalize to 50 events/sec as high load
	const bufferLoadFactor = Math.min(averageBufferSize / (MAX_BUFFER_ITEMS * 0.8), 1) // 80% of max
	const flushLoadFactor = Math.min(averageFlushDuration / 1000, 1) // Normalize to 1 second

	// Combined load factor (weighted average)
	const combinedLoad = (
		eventLoadFactor * 0.5 +      // Event rate is most important
		bufferLoadFactor * 0.3 +      // Buffer size matters
		flushLoadFactor * 0.2         // Flush speed less important
	)

	// Determine operating mode
	let mode: AdaptiveFlushMetrics['mode']
	let targetTimeout: number

	if(combinedLoad < 0.3) {
		// AGGRESSIVE: Low load - flush faster for lower latency
		mode = 'aggressive'
		targetTimeout = ADAPTIVE_MIN_TIMEOUT_MS
	} else if(combinedLoad > 0.7) {
		// CONSERVATIVE: High load - wait longer to consolidate more events
		mode = 'conservative'
		targetTimeout = ADAPTIVE_MAX_TIMEOUT_MS
	} else {
		// BALANCED: Medium load - interpolate between min and max
		mode = 'balanced'
		const normalizedLoad = (combinedLoad - 0.3) / 0.4 // Map 0.3-0.7 to 0-1
		targetTimeout = ADAPTIVE_MIN_TIMEOUT_MS +
			(ADAPTIVE_MAX_TIMEOUT_MS - ADAPTIVE_MIN_TIMEOUT_MS) * normalizedLoad
	}

	// Apply learning rate for smooth transitions (exponential moving average)
	const currentTimeout = metrics.calculatedTimeout || config.AUTO_FLUSH_TIMEOUT_MS
	const newTimeout = currentTimeout * (1 - ADAPTIVE_LEARNING_RATE) +
		targetTimeout * ADAPTIVE_LEARNING_RATE

	// Update mode
	metrics.mode = mode

	// Ensure bounds
	return Math.max(
		ADAPTIVE_MIN_TIMEOUT_MS,
		Math.min(ADAPTIVE_MAX_TIMEOUT_MS, Math.floor(newTimeout))
	)
}

/**
 * Update adaptive flush metrics with new data
 */
function updateAdaptiveMetrics(
	metrics: AdaptiveFlushMetrics,
	itemsBuffered: number,
	flushDurationMs: number,
	config: typeof BUFFER_CONFIG
): void {
	const now = Date.now()
	const timeSinceLastFlush = now - metrics.lastFlushTimestamp

	// Calculate event rate (events per second)
	if(timeSinceLastFlush > 0) {
		const eventsPerMs = itemsBuffered / timeSinceLastFlush
		const eventsPerSec = eventsPerMs * 1000

		// Exponential moving average
		metrics.eventRate = metrics.eventRate * 0.7 + eventsPerSec * 0.3
	}

	// Update average buffer size (exponential moving average)
	metrics.averageBufferSize = metrics.averageBufferSize * 0.7 + itemsBuffered * 0.3

	// Update average flush duration (exponential moving average)
	metrics.averageFlushDuration = metrics.averageFlushDuration * 0.7 + flushDurationMs * 0.3

	// Update timestamp
	metrics.lastFlushTimestamp = now

	// Circuit breaker: detect if flushes are consistently slow (> 2 seconds)
	if(flushDurationMs > 2000) {
		metrics.consecutiveSlowFlushes++
	} else {
		metrics.consecutiveSlowFlushes = 0
	}

	// Mark as unhealthy if too many consecutive slow flushes (circuit breaker)
	if(metrics.consecutiveSlowFlushes >= 5) {
		const wasHealthy = metrics.isHealthy
		metrics.isHealthy = false
		metrics.mode = 'disabled'

		// Record circuit breaker trip in Prometheus (only once)
		if (wasHealthy) {
			const prometheus = getPrometheus()
			if (prometheus) {
				prometheus.recordAdaptiveCircuitBreakerTrip()
			}
		}
	} else if(metrics.consecutiveSlowFlushes === 0 && !metrics.isHealthy) {
		// Recover health after one good flush
		metrics.isHealthy = true
	}

	// Calculate new timeout
	metrics.calculatedTimeout = calculateAdaptiveTimeout(metrics, config)
}

export const makeEventBuffer = (logger: ILogger): BaileysBufferableEventEmitter => {
	const ev = new EventEmitter()
	const historyCache = new Set<string>()
	const historyCacheOrder: string[] = [] // Track insertion order for LRU eviction (PR #2273)

	let data = makeBufferData()
	let buffersInProgress = 0
	let autoFlushTimer: NodeJS.Timeout | null = null
	// FIX: Added flushPendingTimeout to prevent memory leak in createBufferedFunction
	// This ensures we only schedule ONE timeout for debounced flush, not thousands
	let flushPendingTimeout: NodeJS.Timeout | null = null
	let isDestroyed = false
	let bufferMetrics = {
		itemsBuffered: 0,
		flushCount: 0,
		historyCacheSize: 0
	}

	// Adaptive flush metrics (initialized with defaults)
	let adaptiveMetrics: AdaptiveFlushMetrics = {
		eventRate: 0,
		averageBufferSize: 0,
		averageFlushDuration: 0,
		lastFlushTimestamp: Date.now(),
		consecutiveSlowFlushes: 0,
		isHealthy: true,
		calculatedTimeout: BUFFER_CONFIG.AUTO_FLUSH_TIMEOUT_MS,
		mode: BUFFER_CONFIG.ENABLE_ADAPTIVE_FLUSH ? 'balanced' : 'disabled'
	}

	// Log adaptive flush initialization if enabled
	if(BUFFER_CONFIG.ENABLE_ADAPTIVE_FLUSH) {
		logger.info({
			minTimeout: BUFFER_CONFIG.ADAPTIVE_MIN_TIMEOUT_MS,
			maxTimeout: BUFFER_CONFIG.ADAPTIVE_MAX_TIMEOUT_MS,
			learningRate: BUFFER_CONFIG.ADAPTIVE_LEARNING_RATE
		}, 'adaptive flush enabled')
		logEventBuffer('adaptive_flush_enabled', {
			minTimeout: BUFFER_CONFIG.ADAPTIVE_MIN_TIMEOUT_MS,
			maxTimeout: BUFFER_CONFIG.ADAPTIVE_MAX_TIMEOUT_MS
		})
	}

	// take the generic event and fire it as a baileys event
	ev.on('event', (map: BaileysEventData) => {
		for (const event in map) {
			ev.emit(event, map[event as keyof BaileysEventMap])
		}
	})

	function buffer() {
		// Prevent buffering if destroyed
		if (isDestroyed) {
			return
		}

		buffersInProgress += 1

		// Log buffer start (only on first buffer)
		if (buffersInProgress === 1) {
			logger.trace({ buffersInProgress }, 'event buffering started')
			logEventBuffer('buffer_start')
		}

		// Start auto-flush timer when buffering begins
		if (BUFFER_CONFIG.ENABLE_AUTO_FLUSH && !autoFlushTimer && buffersInProgress === 1) {
			// Use adaptive timeout if enabled, otherwise use fixed timeout
			const timeoutMs = BUFFER_CONFIG.ENABLE_ADAPTIVE_FLUSH
				? adaptiveMetrics.calculatedTimeout
				: BUFFER_CONFIG.AUTO_FLUSH_TIMEOUT_MS

			autoFlushTimer = setTimeout(() => {
				logger.warn({
					timeoutMs,
					adaptiveMode: adaptiveMetrics.mode,
					itemsBuffered: bufferMetrics.itemsBuffered
				}, 'auto-flushing buffer due to timeout')
				logEventBuffer('buffer_timeout', {
					timeoutMs,
					mode: adaptiveMetrics.mode
				})
				flush(true)
				autoFlushTimer = null
			}, timeoutMs)

			// Log adaptive timeout adjustment
			if(BUFFER_CONFIG.ENABLE_ADAPTIVE_FLUSH) {
				logger.debug({
					timeout: timeoutMs,
					mode: adaptiveMetrics.mode,
					eventRate: adaptiveMetrics.eventRate.toFixed(2),
					avgBufferSize: adaptiveMetrics.averageBufferSize.toFixed(1),
					avgFlushDuration: adaptiveMetrics.averageFlushDuration.toFixed(1)
				}, 'adaptive timeout calculated')
			}
		}
	}

	function flush(force = false) {
		// Prevent flushing if destroyed
		if (isDestroyed) {
			return false
		}

		// no buffer going on
		if (!buffersInProgress) {
			return false
		}

		if (!force) {
			// reduce the number of buffers in progress
			buffersInProgress -= 1
			// if there are still some buffers going on
			// then we don't flush now
			if (buffersInProgress) {
				return false
			}
		}

		// Clear auto-flush timer
		if (autoFlushTimer) {
			clearTimeout(autoFlushTimer)
			autoFlushTimer = null
		}

		// FIX: Clear flushPendingTimeout to prevent memory leak
		if (flushPendingTimeout) {
			clearTimeout(flushPendingTimeout)
			flushPendingTimeout = null
		}

		// Track flush start time for adaptive metrics
		const flushStartTime = Date.now()
		const itemsBeforeFlush = bufferMetrics.itemsBuffered

		const newData = makeBufferData()
		const chatUpdates = Object.values(data.chatUpdates)
		// gather the remaining conditional events so we re-queue them
		let conditionalChatUpdatesLeft = 0
		for (const update of chatUpdates) {
			if (update.conditional) {
				conditionalChatUpdatesLeft += 1
				newData.chatUpdates[update.id!] = update
				delete data.chatUpdates[update.id!]
			}
		}

		const consolidatedData = consolidateEvents(data)
		if (Object.keys(consolidatedData).length) {
			ev.emit('event', consolidatedData)
		}

		data = newData
		bufferMetrics.flushCount += 1
		bufferMetrics.itemsBuffered = 0

		// Calculate flush duration for adaptive metrics
		const flushDuration = Date.now() - flushStartTime

		// Record Prometheus metrics
		const prometheus = getPrometheus()
		if (prometheus) {
			prometheus.recordBufferFlush(
				adaptiveMetrics.mode,
				force,
				flushDuration,
				itemsBeforeFlush
			)
		}

		// Update adaptive flush metrics if enabled
		if(BUFFER_CONFIG.ENABLE_ADAPTIVE_FLUSH) {
			updateAdaptiveMetrics(
				adaptiveMetrics,
				itemsBeforeFlush,
				flushDuration,
				BUFFER_CONFIG
			)

			// Log adaptive metrics update
			logger.debug({
				mode: adaptiveMetrics.mode,
				calculatedTimeout: adaptiveMetrics.calculatedTimeout,
				eventRate: adaptiveMetrics.eventRate.toFixed(2),
				avgBufferSize: adaptiveMetrics.averageBufferSize.toFixed(1),
				flushDuration,
				isHealthy: adaptiveMetrics.isHealthy
			}, 'adaptive metrics updated')

			// Update Prometheus adaptive metrics
			if (prometheus) {
				prometheus.updateAdaptiveMetrics(
					adaptiveMetrics.mode,
					adaptiveMetrics.calculatedTimeout,
					adaptiveMetrics.eventRate,
					adaptiveMetrics.averageBufferSize,
					adaptiveMetrics.isHealthy
				)
			}
		}

		// Clean history cache if it grows too large (LRU-like behavior)
		cleanHistoryCache()

		// Standard logger trace
		logger.trace({
			conditionalChatUpdatesLeft,
			historyCacheSize: historyCache.size,
			flushCount: bufferMetrics.flushCount,
			forced: force,
			flushDuration
		}, 'released buffered events')

		// BAILEYS_LOG logging
		logEventBuffer('buffer_flush', {
			flushCount: bufferMetrics.flushCount,
			historyCacheSize: historyCache.size,
			adaptiveMode: adaptiveMetrics.mode,
			flushDuration
		})

		// Log metrics periodically (every 10 flushes)
		if (bufferMetrics.flushCount % 10 === 0) {
			const metricsToLog: {
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
			} = {
				itemsBuffered: bufferMetrics.itemsBuffered,
				flushCount: bufferMetrics.flushCount,
				historyCacheSize: bufferMetrics.historyCacheSize,
				buffersInProgress
			}

			// Add adaptive metrics if enabled
			if(BUFFER_CONFIG.ENABLE_ADAPTIVE_FLUSH) {
				metricsToLog.adaptive = {
					mode: adaptiveMetrics.mode,
					timeout: adaptiveMetrics.calculatedTimeout,
					eventRate: parseFloat(adaptiveMetrics.eventRate.toFixed(2)),
					isHealthy: adaptiveMetrics.isHealthy
				}
			}

			logBufferMetrics(metricsToLog)
		}

		// Reset buffers in progress if forced
		if (force) {
			buffersInProgress = 0
		}

		return true
	}

	// LRU eviction thresholds (PR #2273 optimization)
	const CLEANUP_THRESHOLD = Math.floor(BUFFER_CONFIG.MAX_HISTORY_CACHE_SIZE * 0.8) // Start cleanup at 80%
	const CLEANUP_TARGET = Math.floor(BUFFER_CONFIG.MAX_HISTORY_CACHE_SIZE * 0.6) // Reduce to 60% when cleaning

	function cleanHistoryCache() {
		// Aggressive cleanup at 80% capacity using LRU strategy (PR #2273)
		if (historyCache.size >= CLEANUP_THRESHOLD) {
			const removeCount = historyCache.size - CLEANUP_TARGET

			// Standard logger debug
			logger.debug({
				cacheSize: historyCache.size,
				removing: removeCount,
				targetSize: CLEANUP_TARGET,
				maxSize: BUFFER_CONFIG.MAX_HISTORY_CACHE_SIZE
			}, 'History cache cleanup - removing oldest entries (LRU)')

			// BAILEYS_LOG logging
			logEventBuffer('cache_cleanup', {
				removed: removeCount,
				remaining: CLEANUP_TARGET
			})

			// Remove oldest entries using LRU order (PR #2273 optimization)
			for (let i = 0; i < removeCount && historyCacheOrder.length > 0; i++) {
				const oldestKey = historyCacheOrder.shift()!
				historyCache.delete(oldestKey)
			}

			// Record Prometheus metric
			const prometheus = getPrometheus()
			if (prometheus) {
				prometheus.recordBufferCacheCleanup()
			}
		}
		bufferMetrics.historyCacheSize = historyCache.size

		// Update Prometheus cache size metric
		const prometheus = getPrometheus()
		if (prometheus) {
			prometheus.updateBufferCacheSize(historyCache.size)
		}
	}

	/**
	 * Destroys the buffer and cleans up all resources
	 * This prevents memory leaks and orphaned timers when socket disconnects
	 */
	function destroy() {
		if (isDestroyed) {
			logger.debug('destroy() called on already destroyed buffer, skipping')
			return
		}

		const hadPendingFlush = buffersInProgress > 0
		const itemsCount = bufferMetrics.itemsBuffered

		logger.info({
			buffersInProgress,
			itemsBuffered: bufferMetrics.itemsBuffered,
			flushCount: bufferMetrics.flushCount,
			historyCacheSize: bufferMetrics.historyCacheSize,
			hasAutoFlushTimer: !!autoFlushTimer,
			hasFlushPendingTimeout: !!flushPendingTimeout
		}, 'destroying event buffer')
		isDestroyed = true

		// Clear auto-flush timer to prevent orphaned flushes
		if (autoFlushTimer) {
			logger.debug('clearing auto-flush timer to prevent orphaned flushes')
			clearTimeout(autoFlushTimer)
			autoFlushTimer = null
		}

		// FIX: Clear flushPendingTimeout to prevent memory leak
		if (flushPendingTimeout) {
			logger.debug('clearing flushPendingTimeout to prevent memory leak')
			clearTimeout(flushPendingTimeout)
			flushPendingTimeout = null
		}

		// Final flush to ensure no data loss (only if there's buffered data)
		if (buffersInProgress > 0) {
			logger.debug({
				buffersInProgress,
				itemsBuffered: bufferMetrics.itemsBuffered
			}, 'performing final flush before destroying buffer')

			// Temporarily mark as not destroyed to allow final flush
			isDestroyed = false
			flush(true)
			isDestroyed = true

			// Record Prometheus metric for final flush
			const prometheus = getPrometheus()
			if (prometheus) {
				prometheus.recordBufferFinalFlush(itemsCount)
			}
		} else {
			logger.debug('no buffers in progress, skipping final flush')
		}

		// Remove all event listeners to prevent memory leaks
		logger.debug('removing all event listeners to prevent memory leaks')
		ev.removeAllListeners()

		// Reset internal state
		const preResetMetrics = { ...bufferMetrics }
		buffersInProgress = 0
		data = makeBufferData()
		historyCache.clear()
		historyCacheOrder.length = 0 // Clear LRU order tracking (PR #2273)
		bufferMetrics = {
			itemsBuffered: 0,
			flushCount: 0,
			historyCacheSize: 0
		}

		logger.info({
			wasBuffering: hadPendingFlush,
			finalFlushCount: preResetMetrics.flushCount,
			finalHistoryCacheSize: preResetMetrics.historyCacheSize
		}, 'event buffer destroyed successfully')

		// Log to BAILEYS_LOG for tracking
		logEventBuffer('buffer_destroyed', {
			flushCount: preResetMetrics.flushCount,
			historyCacheSize: preResetMetrics.historyCacheSize
		})

		// Record Prometheus metric for buffer destruction
		const prometheus = getPrometheus()
		if (prometheus) {
			prometheus.recordBufferDestroyed('socket_close', hadPendingFlush)
		}
	}

	return {
		process(handler) {
			const listener = async (map: BaileysEventData) => {
				await handler(map)
			}

			ev.on('event', listener)
			return () => {
				ev.off('event', listener)
			}
		},
		emit<T extends BaileysEvent>(event: BaileysEvent, evData: BaileysEventMap[T]) {
			// FIX: Check if this is a messages.upsert with a different type than what's buffered
			// If so, emit the buffered messages first to avoid type overshadowing
			// This prevents loss of message type information during buffering
			if (event === 'messages.upsert' && buffersInProgress) {
				const { type } = evData as BaileysEventMap['messages.upsert']
				const existingUpserts = Object.values(data.messageUpserts)
				if (existingUpserts.length > 0) {
					const bufferedType = existingUpserts[0]?.type
					if (bufferedType && bufferedType !== type) {
						logger.debug({ bufferedType, newType: type }, 'messages.upsert type mismatch, emitting buffered messages')

						// Record Prometheus metric for type mismatch flush
						const prometheus = getPrometheus()
						if (prometheus) {
							prometheus.recordMessageTypeMismatchFlush(bufferedType, type)
						}

						// Emit the buffered messages with their correct type
						ev.emit('event', {
							'messages.upsert': {
								messages: existingUpserts.map(m => m.message),
								type: bufferedType
							}
						})
						// Clear the message upserts from the buffer
						data.messageUpserts = {}

						// Log the type mismatch event
						logEventBuffer('type_mismatch_flush', {
							bufferedType,
							newType: type,
							messageCount: existingUpserts.length
						})
					}
				}
			}

			if (buffersInProgress && BUFFERABLE_EVENT_SET.has(event)) {
				// Check if buffer is getting too large
				bufferMetrics.itemsBuffered += 1

				if (bufferMetrics.itemsBuffered > BUFFER_CONFIG.MAX_BUFFER_ITEMS) {
					// Standard logger warn
					logger.warn({
						itemsBuffered: bufferMetrics.itemsBuffered,
						maxItems: BUFFER_CONFIG.MAX_BUFFER_ITEMS,
						event
					}, 'buffer overflow detected, force flushing')

					// BAILEYS_LOG logging
					logEventBuffer('buffer_overflow', {
						itemsBuffered: bufferMetrics.itemsBuffered,
						maxItems: BUFFER_CONFIG.MAX_BUFFER_ITEMS
					})

					// Record Prometheus metric
					const prometheus = getPrometheus()
					if (prometheus) {
						prometheus.recordBufferOverflow()
					}

					flush(true)
				}

				// Log every 100 buffered items for monitoring
				if (bufferMetrics.itemsBuffered % 100 === 0) {
					logger.debug({
						itemsBuffered: bufferMetrics.itemsBuffered,
						event
					}, 'buffering events')
				}

				append(data, historyCache, historyCacheOrder, event as BufferableEvent, evData, logger)
				return true
			}

			return ev.emit('event', { [event]: evData })
		},
		isBuffering() {
			return buffersInProgress > 0
		},
		buffer,
		flush,
		createBufferedFunction(work) {
			return async (...args) => {
				buffer()
				try {
					const result = await work(...args)
					// FIX: If this is the only buffer, flush after a small delay
					// This allows nested buffers to complete before flushing
					if (buffersInProgress === 1) {
						setTimeout(() => {
							if (buffersInProgress === 1 && !isDestroyed) {
								flush()
							}
						}, 100) // Small delay to allow nested buffers
					}

					return result
				} catch (error) {
					throw error
				} finally {
					buffersInProgress = Math.max(0, buffersInProgress - 1)
					if (buffersInProgress === 0) {
						// FIX: Only schedule ONE timeout, not thousands
						// This prevents memory leak from accumulating timeouts
						if (!flushPendingTimeout && !isDestroyed) {
							flushPendingTimeout = setTimeout(() => {
								flushPendingTimeout = null
								if (!isDestroyed) {
									flush()
								}
							}, 100)
						}
					}
				}
			}
		},
		on: (...args) => ev.on(...args),
		off: (...args) => ev.off(...args),
		removeAllListeners: (...args) => ev.removeAllListeners(...args),
		destroy
	}
}

const makeBufferData = (): BufferedEventData => {
	return {
		historySets: {
			chats: {},
			messages: {},
			contacts: {},
			isLatest: false,
			empty: true
		},
		chatUpserts: {},
		chatUpdates: {},
		chatDeletes: new Set(),
		contactUpserts: {},
		contactUpdates: {},
		messageUpserts: {},
		messageUpdates: {},
		messageReactions: {},
		messageDeletes: {},
		messageReceipts: {},
		groupUpdates: {}
	}
}

function append<E extends BufferableEvent>(
	data: BufferedEventData,
	historyCache: Set<string>,
	historyCacheOrder: string[], // Track insertion order for LRU eviction (PR #2273)
	event: E,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	eventData: any,
	logger: ILogger
) {
	switch (event) {
		case 'messaging-history.set':
			for (const chat of eventData.chats as Chat[]) {
				const id = chat.id || ''
				const existingChat = data.historySets.chats[id]
				if (existingChat) {
					existingChat.endOfHistoryTransferType = chat.endOfHistoryTransferType
				}

				if (!existingChat && !historyCache.has(id)) {
					data.historySets.chats[id] = chat
					historyCache.add(id)
					historyCacheOrder.push(id) // Track insertion order for LRU (PR #2273)

					absorbingChatUpdate(chat)
				}
			}

			for (const contact of eventData.contacts as Contact[]) {
				const existingContact = data.historySets.contacts[contact.id]
				if (existingContact) {
					Object.assign(existingContact, trimUndefined(contact))
				} else {
					const historyContactId = `c:${contact.id}`
					const hasAnyName = contact.notify || contact.name || contact.verifiedName
					if (!historyCache.has(historyContactId) || hasAnyName) {
						data.historySets.contacts[contact.id] = contact
						historyCache.add(historyContactId)
						historyCacheOrder.push(historyContactId) // Track insertion order for LRU (PR #2273)
					}
				}
			}

			for (const message of eventData.messages as WAMessage[]) {
				const key = stringifyMessageKey(message.key)
				const existingMsg = data.historySets.messages[key]
				if (!existingMsg && !historyCache.has(key)) {
					data.historySets.messages[key] = message
					historyCache.add(key)
					historyCacheOrder.push(key) // Track insertion order for LRU (PR #2273)
				}
			}

			data.historySets.empty = false
			data.historySets.syncType = eventData.syncType
			data.historySets.progress = eventData.progress
			data.historySets.peerDataRequestSessionId = eventData.peerDataRequestSessionId
			data.historySets.isLatest = eventData.isLatest || data.historySets.isLatest

			break
		case 'chats.upsert':
			for (const chat of eventData as Chat[]) {
				const id = chat.id || ''
				let upsert = data.chatUpserts[id]
				if (id && !upsert) {
					upsert = data.historySets.chats[id]
					if (upsert) {
						logger.debug({ chatId: id }, 'absorbed chat upsert in chat set')
					}
				}

				if (upsert) {
					upsert = concatChats(upsert, chat)
				} else {
					upsert = chat
					data.chatUpserts[id] = upsert
				}

				absorbingChatUpdate(upsert)

				if (data.chatDeletes.has(id)) {
					data.chatDeletes.delete(id)
				}
			}

			break
		case 'chats.update':
			for (const update of eventData as ChatUpdate[]) {
				const chatId = update.id!
				const conditionMatches = update.conditional ? update.conditional(data) : true
				if (conditionMatches) {
					delete update.conditional

					// if there is an existing upsert, merge the update into it
					const upsert = data.historySets.chats[chatId] || data.chatUpserts[chatId]
					if (upsert) {
						concatChats(upsert, update)
					} else {
						// merge the update into the existing update
						const chatUpdate = data.chatUpdates[chatId] || {}
						data.chatUpdates[chatId] = concatChats(chatUpdate, update)
					}
				} else if (conditionMatches === undefined) {
					// condition yet to be fulfilled
					data.chatUpdates[chatId] = update
				}
				// otherwise -- condition not met, update is invalid

				// if the chat has been updated
				// ignore any existing chat delete
				if (data.chatDeletes.has(chatId)) {
					data.chatDeletes.delete(chatId)
				}
			}

			break
		case 'chats.delete':
			for (const chatId of eventData as string[]) {
				if (!data.chatDeletes.has(chatId)) {
					data.chatDeletes.add(chatId)
				}

				// remove any prior updates & upserts
				if (data.chatUpdates[chatId]) {
					delete data.chatUpdates[chatId]
				}

				if (data.chatUpserts[chatId]) {
					delete data.chatUpserts[chatId]
				}

				if (data.historySets.chats[chatId]) {
					delete data.historySets.chats[chatId]
				}
			}

			break
		case 'contacts.upsert':
			for (const contact of eventData as Contact[]) {
				let upsert = data.contactUpserts[contact.id]
				if (!upsert) {
					upsert = data.historySets.contacts[contact.id]
					if (upsert) {
						logger.debug({ contactId: contact.id }, 'absorbed contact upsert in contact set')
					}
				}

				if (upsert) {
					upsert = Object.assign(upsert, trimUndefined(contact))
				} else {
					upsert = contact
					data.contactUpserts[contact.id] = upsert
				}

				if (data.contactUpdates[contact.id]) {
					upsert = Object.assign(data.contactUpdates[contact.id]!, trimUndefined(contact)) as Contact
					delete data.contactUpdates[contact.id]
				}
			}

			break
		case 'contacts.update':
			const contactUpdates = eventData as BaileysEventMap['contacts.update']
			for (const update of contactUpdates) {
				const id = update.id!
				// merge into prior upsert
				const upsert = data.historySets.contacts[id] || data.contactUpserts[id]
				if (upsert) {
					Object.assign(upsert, update)
				} else {
					// merge into prior update
					const contactUpdate = data.contactUpdates[id] || {}
					data.contactUpdates[id] = Object.assign(contactUpdate, update)
				}
			}

			break
		case 'messages.upsert':
			const { messages, type } = eventData as BaileysEventMap['messages.upsert']
			for (const message of messages) {
				const key = stringifyMessageKey(message.key)
				let existing = data.messageUpserts[key]?.message
				if (!existing) {
					existing = data.historySets.messages[key]
					if (existing) {
						logger.debug({ messageId: key }, 'absorbed message upsert in message set')
					}
				}

				if (existing) {
					message.messageTimestamp = existing.messageTimestamp
				}

				if (data.messageUpdates[key]) {
					logger.debug('absorbed prior message update in message upsert')
					Object.assign(message, data.messageUpdates[key].update)
					delete data.messageUpdates[key]
				}

				if (data.historySets.messages[key]) {
					data.historySets.messages[key] = message
				} else {
					data.messageUpserts[key] = {
						message,
						type: type === 'notify' || data.messageUpserts[key]?.type === 'notify' ? 'notify' : type
					}
				}

				// Log all messages buffered (trace level)
				logger.trace({
					messageId: key,
					fromMe: message.key.fromMe,
					remoteJid: message.key.remoteJid,
					type
				}, 'message buffered')
			}

			break
		case 'messages.update':
			const msgUpdates = eventData as BaileysEventMap['messages.update']
			for (const { key, update } of msgUpdates) {
				const keyStr = stringifyMessageKey(key)
				const existing = data.historySets.messages[keyStr] || data.messageUpserts[keyStr]?.message
				if (existing) {
					Object.assign(existing, update)
					// if the message was received & read by us
					// the chat counter must have been incremented
					// so we need to decrement it
					if (update.status === WAMessageStatus.READ && !key.fromMe) {
						decrementChatReadCounterIfMsgDidUnread(existing)
					}
				} else {
					const msgUpdate = data.messageUpdates[keyStr] || { key, update: {} }
					Object.assign(msgUpdate.update, update)
					data.messageUpdates[keyStr] = msgUpdate
				}
			}

			break
		case 'messages.delete':
			const deleteData = eventData as BaileysEventMap['messages.delete']
			if ('keys' in deleteData) {
				const { keys } = deleteData
				for (const key of keys) {
					const keyStr = stringifyMessageKey(key)
					if (!data.messageDeletes[keyStr]) {
						data.messageDeletes[keyStr] = key
					}

					if (data.messageUpserts[keyStr]) {
						delete data.messageUpserts[keyStr]
					}

					if (data.messageUpdates[keyStr]) {
						delete data.messageUpdates[keyStr]
					}
				}
			} else {
				// TODO: add support
			}

			break
		case 'messages.reaction':
			const reactions = eventData as BaileysEventMap['messages.reaction']
			for (const { key, reaction } of reactions) {
				const keyStr = stringifyMessageKey(key)
				const existing = data.messageUpserts[keyStr]
				if (existing) {
					updateMessageWithReaction(existing.message, reaction)
				} else {
					data.messageReactions[keyStr] = data.messageReactions[keyStr] || { key, reactions: [] }
					updateMessageWithReaction(data.messageReactions[keyStr], reaction)
				}
			}

			break
		case 'message-receipt.update':
			const receipts = eventData as BaileysEventMap['message-receipt.update']
			for (const { key, receipt } of receipts) {
				const keyStr = stringifyMessageKey(key)
				const existing = data.messageUpserts[keyStr]
				if (existing) {
					updateMessageWithReceipt(existing.message, receipt)
				} else {
					data.messageReceipts[keyStr] = data.messageReceipts[keyStr] || { key, userReceipt: [] }
					updateMessageWithReceipt(data.messageReceipts[keyStr], receipt)
				}
			}

			break
		case 'groups.update':
			const groupUpdates = eventData as BaileysEventMap['groups.update']
			for (const update of groupUpdates) {
				const id = update.id!
				const groupUpdate = data.groupUpdates[id] || {}
				if (!data.groupUpdates[id]) {
					data.groupUpdates[id] = Object.assign(groupUpdate, update)
				}
			}

			break
		default:
			throw new Error(`"${event}" cannot be buffered`)
	}

	function absorbingChatUpdate(existing: Chat) {
		const chatId = existing.id || ''
		const update = data.chatUpdates[chatId]
		if (update) {
			const conditionMatches = update.conditional ? update.conditional(data) : true
			if (conditionMatches) {
				delete update.conditional
				logger.debug({ chatId }, 'absorbed chat update in existing chat')
				Object.assign(existing, concatChats(update as Chat, existing))
				delete data.chatUpdates[chatId]
			} else if (conditionMatches === false) {
				logger.debug({ chatId }, 'chat update condition fail, removing')
				delete data.chatUpdates[chatId]
			}
		}
	}

	function decrementChatReadCounterIfMsgDidUnread(message: WAMessage) {
		// decrement chat unread counter
		// if the message has already been marked read by us
		const chatId = message.key.remoteJid!
		const chat = data.chatUpdates[chatId] || data.chatUpserts[chatId]
		if (
			isRealMessage(message) &&
			shouldIncrementChatUnread(message) &&
			typeof chat?.unreadCount === 'number' &&
			chat.unreadCount > 0
		) {
			logger.debug({ chatId: chat.id }, 'decrementing chat counter')
			chat.unreadCount -= 1
			if (chat.unreadCount === 0) {
				delete chat.unreadCount
			}
		}
	}
}

function consolidateEvents(data: BufferedEventData) {
	const map: BaileysEventData = {}

	if (!data.historySets.empty) {
		// Optimized: Cache Object.values() in variables to avoid duplicate calls (PR #2273)
		const historyChats = Object.values(data.historySets.chats)
		const historyMessages = Object.values(data.historySets.messages)
		const historyContacts = Object.values(data.historySets.contacts)
		map['messaging-history.set'] = {
			chats: historyChats,
			messages: historyMessages,
			contacts: historyContacts,
			syncType: data.historySets.syncType,
			progress: data.historySets.progress,
			isLatest: data.historySets.isLatest,
			peerDataRequestSessionId: data.historySets.peerDataRequestSessionId
		}
	}

	const chatUpsertList = Object.values(data.chatUpserts)
	if (chatUpsertList.length) {
		map['chats.upsert'] = chatUpsertList
	}

	const chatUpdateList = Object.values(data.chatUpdates)
	if (chatUpdateList.length) {
		map['chats.update'] = chatUpdateList
	}

	const chatDeleteList = Array.from(data.chatDeletes)
	if (chatDeleteList.length) {
		map['chats.delete'] = chatDeleteList
	}

	const messageUpsertList = Object.values(data.messageUpserts)
	if (messageUpsertList.length) {
		const type = messageUpsertList[0]!.type
		map['messages.upsert'] = {
			messages: messageUpsertList.map(m => m.message),
			type
		}
	}

	const messageUpdateList = Object.values(data.messageUpdates)
	if (messageUpdateList.length) {
		map['messages.update'] = messageUpdateList
	}

	const messageDeleteList = Object.values(data.messageDeletes)
	if (messageDeleteList.length) {
		map['messages.delete'] = { keys: messageDeleteList }
	}

	// Optimized: Direct for...in loop instead of Object.values().flatMap() (PR #2273)
	// Original: O(3N) complexity with 2x flatMap creating 3 temporary arrays
	// Optimized: O(N) complexity with single pass, no temporary arrays
	const messageReactionList: Array<{ key: WAMessageKey; reaction: proto.IReaction }> = []
	for (const id in data.messageReactions) {
		if (!Object.hasOwnProperty.call(data.messageReactions, id)) continue
		const { key, reactions } = data.messageReactions[id]!
		for (let i = 0; i < reactions.length; i++) {
			messageReactionList.push({ key, reaction: reactions[i]! })
		}
	}
	if (messageReactionList.length) {
		map['messages.reaction'] = messageReactionList
	}

	// Optimized: Direct for...in loop instead of Object.values().flatMap() (PR #2273)
	const messageReceiptList: Array<{ key: WAMessageKey; receipt: proto.IUserReceipt }> = []
	for (const id in data.messageReceipts) {
		if (!Object.hasOwnProperty.call(data.messageReceipts, id)) continue
		const { key, userReceipt } = data.messageReceipts[id]!
		for (let i = 0; i < userReceipt.length; i++) {
			messageReceiptList.push({ key, receipt: userReceipt[i]! })
		}
	}
	if (messageReceiptList.length) {
		map['message-receipt.update'] = messageReceiptList
	}

	const contactUpsertList = Object.values(data.contactUpserts)
	if (contactUpsertList.length) {
		map['contacts.upsert'] = contactUpsertList
	}

	const contactUpdateList = Object.values(data.contactUpdates)
	if (contactUpdateList.length) {
		map['contacts.update'] = contactUpdateList
	}

	const groupUpdateList = Object.values(data.groupUpdates)
	if (groupUpdateList.length) {
		map['groups.update'] = groupUpdateList
	}

	return map
}

function concatChats<C extends Partial<Chat>>(a: C, b: Partial<Chat>) {
	if (
		b.unreadCount === null && // neutralize unread counter
		a.unreadCount! < 0
	) {
		a.unreadCount = undefined
		b.unreadCount = undefined
	}

	if (typeof a.unreadCount === 'number' && typeof b.unreadCount === 'number') {
		b = { ...b }
		if (b.unreadCount! >= 0) {
			b.unreadCount = Math.max(b.unreadCount!, 0) + Math.max(a.unreadCount, 0)
		}
	}

	return Object.assign(a, b)
}

const stringifyMessageKey = (key: WAMessageKey) => `${key.remoteJid},${key.id},${key.fromMe ? '1' : '0'}`
