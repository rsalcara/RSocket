import { EventEmitter } from 'events'
import { URL } from 'url'
import { SocketConfig } from '../../Types'

/**
 * Abstract base class for socket clients (WebSocket, TCP, etc.)
 *
 * IMPORTANT: Memory leak prevention
 * - Uses reasonable max listeners limit (30) instead of unlimited (0)
 * - Subclasses must implement proper cleanup in close() method
 * - All implementations must remove listeners on close to prevent leaks
 */
export abstract class AbstractSocketClient extends EventEmitter {
	abstract get isOpen(): boolean
	abstract get isClosed(): boolean
	abstract get isClosing(): boolean
	abstract get isConnecting(): boolean

	constructor(
		public url: URL,
		public config: SocketConfig
	) {
		super()

		/**
		 * Set reasonable max listeners limit for the EventEmitter
		 *
		 * Default calculation (30 listeners):
		 * - 8 WebSocket events forwarded from underlying socket
		 * - ~10 Baileys internal listeners (connection, messages, etc.)
		 * - ~12 additional slots for user-added handlers
		 *
		 * CRITICAL: Never use setMaxListeners(0) unless you know what you're doing
		 * - 0 = UNLIMITED listeners = guaranteed memory leak on reconnections
		 * - With limit, Node.js will warn if we exceed (helps debugging)
		 *
		 * Override via config.maxSocketClientListeners if needed for your use case
		 */
		const maxListeners = config.maxSocketClientListeners ?? 30

		if (maxListeners === 0) {
			config.logger?.warn(
				{ maxListeners },
				'⚠️  WARNING: setMaxListeners(0) allows UNLIMITED listeners - potential memory leak! Set a reasonable limit instead.'
			)
		}

		this.setMaxListeners(maxListeners)
	}

	abstract connect(): Promise<void>
	abstract close(): Promise<void>
	abstract send(str: Uint8Array | string, cb?: (err?: Error) => void): boolean
}
