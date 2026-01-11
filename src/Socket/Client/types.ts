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
		 * Calculation:
		 * - 8 WebSocket events forwarded from underlying socket
		 * - ~10 Baileys internal listeners (connection, messages, etc.)
		 * - ~12 additional slots for user-added handlers
		 * Total: 30 listeners
		 *
		 * CRITICAL: Never use setMaxListeners(0)
		 * - 0 = UNLIMITED listeners = guaranteed memory leak on reconnections
		 * - With limit, Node.js will warn if we exceed (helps debugging)
		 */
		this.setMaxListeners(30)
	}

	abstract connect(): Promise<void>
	abstract close(): Promise<void>
	abstract send(str: Uint8Array | string, cb?: (err?: Error) => void): boolean
}
