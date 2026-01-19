import { EventEmitter } from 'events';
import { URL } from 'url';
import { SocketConfig } from '../../Types';
/**
 * Abstract base class for socket clients (WebSocket, TCP, etc.)
 *
 * IMPORTANT: Memory leak prevention
 * - Uses reasonable max listeners limit (30) instead of unlimited (0)
 * - Subclasses must implement proper cleanup in close() method
 * - All implementations must remove listeners on close to prevent leaks
 */
export declare abstract class AbstractSocketClient extends EventEmitter {
    url: URL;
    config: SocketConfig;
    abstract get isOpen(): boolean;
    abstract get isClosed(): boolean;
    abstract get isClosing(): boolean;
    abstract get isConnecting(): boolean;
    constructor(url: URL, config: SocketConfig);
    abstract connect(): Promise<void>;
    abstract close(): Promise<void>;
    abstract send(str: Uint8Array | string, cb?: (err?: Error) => void): boolean;
}
//# sourceMappingURL=types.d.ts.map