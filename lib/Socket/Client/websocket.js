"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const Defaults_1 = require("../../Defaults");
const types_1 = require("./types");
/**
 * WebSocket Client with proper listener management to prevent memory leaks
 *
 * IMPORTANT: This class implements strict listener lifecycle management:
 * - Limited max listeners (prevents unbounded growth)
 * - Listener reference tracking (enables proper cleanup)
 * - Complete cleanup on close (prevents orphaned listeners)
 */
class WebSocketClient extends types_1.AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
        /**
         * Store listener references for proper cleanup
         * Key: event name, Value: listener function
         */
        this.eventListeners = new Map();
    }
    get isOpen() {
        var _a;
        return ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN;
    }
    get isClosed() {
        var _a;
        return this.socket === null || ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.CLOSED;
    }
    get isClosing() {
        var _a;
        return this.socket === null || ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.CLOSING;
    }
    get isConnecting() {
        var _a;
        return ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.CONNECTING;
    }
    async connect() {
        var _a, _b, _c;
        // Prevent duplicate connections
        if (this.socket) {
            return;
        }
        this.socket = new ws_1.default(this.url, {
            origin: Defaults_1.DEFAULT_ORIGIN,
            headers: (_a = this.config.options) === null || _a === void 0 ? void 0 : _a.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent
        });
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
        const maxWebSocketListeners = (_b = this.config.maxWebSocketListeners) !== null && _b !== void 0 ? _b : 20;
        if (maxWebSocketListeners === 0) {
            (_c = this.config.logger) === null || _c === void 0 ? void 0 : _c.warn({ maxWebSocketListeners }, '⚠️  WARNING: WebSocket setMaxListeners(0) allows UNLIMITED listeners - potential memory leak! Set a reasonable limit instead.');
        }
        this.socket.setMaxListeners(maxWebSocketListeners);
        // Define all WebSocket events that need to be forwarded
        const events = [
            'close',
            'error',
            'upgrade',
            'message',
            'open',
            'ping',
            'pong',
            'unexpected-response'
        ];
        // Register listeners and store references for cleanup
        for (const event of events) {
            // Create named function (better for debugging than arrow function)
            const listener = (...args) => this.emit(event, ...args);
            // Store reference for later removal
            this.eventListeners.set(event, listener);
            // Attach to socket
            this.socket.on(event, listener);
        }
    }
    async close() {
        if (!this.socket) {
            return;
        }
        /**
         * CRITICAL: Clean up ALL listeners before closing socket
         * This prevents memory leaks from orphaned listeners accumulating on reconnections
         */
        // Remove listeners using stored references (most precise method)
        for (const [event, listener] of this.eventListeners.entries()) {
            this.socket.removeListener(event, listener);
        }
        // Clear the reference map
        this.eventListeners.clear();
        // Remove any remaining listeners as safety measure
        this.socket.removeAllListeners();
        // Close the WebSocket connection
        this.socket.close();
        // Clear socket reference
        this.socket = null;
    }
    send(str, cb) {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.send(str, cb);
        return Boolean(this.socket);
    }
}
exports.WebSocketClient = WebSocketClient;
