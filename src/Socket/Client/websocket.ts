import WebSocket from 'ws'
import { DEFAULT_ORIGIN } from '../../Defaults'
import { getPrometheus } from '../../Utils/prometheus-metrics'
import { AbstractSocketClient } from './types'

/**
 * WebSocket event types that need to be forwarded to the parent EventEmitter
 */
type WebSocketEventType = 'close' | 'error' | 'upgrade' | 'message' | 'open' | 'ping' | 'pong' | 'unexpected-response'

/**
 * WebSocket Client with proper listener management to prevent memory leaks
 *
 * IMPORTANT: This class implements strict listener lifecycle management:
 * - Limited max listeners (prevents unbounded growth)
 * - Listener reference tracking (enables proper cleanup)
 * - Complete cleanup on close (prevents orphaned listeners)
 * - Prometheus metrics for connection monitoring
 */
export class WebSocketClient extends AbstractSocketClient {
	protected socket: WebSocket | null = null

	/**
	 * Store listener references for proper cleanup
	 * Key: event name, Value: listener function
	 */
	private eventListeners = new Map<WebSocketEventType, (...args: any[]) => void>()

	/**
	 * Track connection start time for metrics
	 */
	private connectionStartTime: number = 0

	get isOpen(): boolean {
		return this.socket?.readyState === WebSocket.OPEN
	}
	get isClosed(): boolean {
		return this.socket === null || this.socket?.readyState === WebSocket.CLOSED
	}
	get isClosing(): boolean {
		return this.socket === null || this.socket?.readyState === WebSocket.CLOSING
	}
	get isConnecting(): boolean {
		return this.socket?.readyState === WebSocket.CONNECTING
	}

	async connect(): Promise<void> {
		// Prevent duplicate connections
		if (this.socket) {
			return
		}

		// Track connection start time for metrics
		this.connectionStartTime = Date.now()

		// Prometheus: Track connection attempt
		const prometheus = getPrometheus()
		prometheus?.recordWebSocketConnection('connecting')

		this.socket = new WebSocket(this.url, {
			origin: DEFAULT_ORIGIN,
			headers: this.config.options?.headers as {},
			handshakeTimeout: this.config.connectTimeoutMs,
			timeout: this.config.connectTimeoutMs,
			agent: this.config.agent
		})

		/**
		 * Set reasonable max listeners limit for WebSocket internal events
		 *
		 * Default calculation (20 listeners):
		 * - 8 base WebSocket events (close, error, upgrade, message, open, ping, pong, unexpected-response)
		 * - 10 additional slots for dynamic listeners (user-added handlers)
		 * - 2 buffer for multi-tenant environments
		 *
		 * CRITICAL: Never use setMaxListeners(0) as it disables warnings and allows unbounded growth
		 *
		 * Override via config.maxWebSocketListeners if needed for your use case
		 */
		const maxWebSocketListeners = this.config.maxWebSocketListeners ?? 20

		if (maxWebSocketListeners === 0) {
			this.config.logger?.warn(
				{ maxWebSocketListeners },
				'⚠️  WARNING: WebSocket setMaxListeners(0) allows UNLIMITED listeners - potential memory leak! Set a reasonable limit instead.'
			)
		}

		this.socket.setMaxListeners(maxWebSocketListeners)

		// Define all WebSocket events that need to be forwarded
		const events: WebSocketEventType[] = [
			'close',
			'error',
			'upgrade',
			'message',
			'open',
			'ping',
			'pong',
			'unexpected-response'
		]

		// Register listeners and store references for cleanup
		for (const event of events) {
			// Create named function (better for debugging than arrow function)
			const listener = (...args: any[]) => {
				// Track specific events for metrics
				if (event === 'open') {
					const connectionDuration = Date.now() - this.connectionStartTime
					prometheus?.recordWebSocketConnection('connected')
					prometheus?.recordWebSocketConnectionDuration(connectionDuration)
				} else if (event === 'error') {
					prometheus?.recordWebSocketConnection('error')
				} else if (event === 'close') {
					prometheus?.recordWebSocketConnection('closed')
				}

				this.emit(event, ...args)
			}

			// Store reference for later removal
			this.eventListeners.set(event, listener)

			// Attach to socket
			this.socket.on(event, listener)
		}
	}

	async close(): Promise<void> {
		if (!this.socket) {
			return
		}

		// Prometheus: Track disconnection
		const prometheus = getPrometheus()
		prometheus?.recordWebSocketConnection('closing')

		/**
		 * CRITICAL: Clean up ALL listeners before closing socket
		 * This prevents memory leaks from orphaned listeners accumulating on reconnections
		 */

		// Create promise to wait for close event (from upstream)
		const closePromise = new Promise<void>(resolve => {
			this.socket?.once('close', resolve)
		})

		// Remove listeners using stored references (most precise method)
		for (const [event, listener] of this.eventListeners.entries()) {
			this.socket.removeListener(event, listener)
		}

		// Clear the reference map
		this.eventListeners.clear()

		// Remove any remaining listeners as safety measure
		this.socket.removeAllListeners()

		// Close the WebSocket connection
		this.socket.close()

		// Wait for close event to complete (from upstream)
		await closePromise

		// Clear socket reference
		this.socket = null
	}

	send(str: string | Uint8Array, cb?: (err?: Error) => void): boolean {
		this.socket?.send(str, cb)

		return Boolean(this.socket)
	}
}
