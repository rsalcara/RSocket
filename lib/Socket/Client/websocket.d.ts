import WebSocket from 'ws';
import { AbstractSocketClient } from './types.js';
/**
 * WebSocket Client with proper listener management to prevent memory leaks
 *
 * IMPORTANT: This class implements strict listener lifecycle management:
 * - Limited max listeners (prevents unbounded growth)
 * - Listener reference tracking (enables proper cleanup)
 * - Complete cleanup on close (prevents orphaned listeners)
 * - Prometheus metrics for connection monitoring
 */
export declare class WebSocketClient extends AbstractSocketClient {
    protected socket: WebSocket | null;
    /**
     * Store listener references for proper cleanup
     * Key: event name, Value: listener function
     */
    private eventListeners;
    /**
     * Track connection start time for metrics
     */
    private connectionStartTime;
    get isOpen(): boolean;
    get isClosed(): boolean;
    get isClosing(): boolean;
    get isConnecting(): boolean;
    connect(): Promise<void>;
    close(): Promise<void>;
    send(str: string | Uint8Array, cb?: (err?: Error) => void): boolean;
}
//# sourceMappingURL=websocket.d.ts.map