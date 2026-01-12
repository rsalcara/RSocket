"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractSocketClient = void 0;
const events_1 = require("events");
/**
 * Abstract base class for socket clients (WebSocket, TCP, etc.)
 *
 * IMPORTANT: Memory leak prevention
 * - Uses reasonable max listeners limit (30) instead of unlimited (0)
 * - Subclasses must implement proper cleanup in close() method
 * - All implementations must remove listeners on close to prevent leaks
 */
class AbstractSocketClient extends events_1.EventEmitter {
    constructor(url, config) {
        var _a, _b;
        super();
        this.url = url;
        this.config = config;
        /**
         * Set reasonable max listeners limit for the EventEmitter
         *
         * Default calculation (40 listeners):
         * - 8 WebSocket events forwarded from underlying socket
         * - ~10 Baileys internal listeners (connection, messages, etc.)
         * - ~15 additional slots for user-added handlers
         * - ~7 buffer for multi-tenant environments
         *
         * CRITICAL: Never use setMaxListeners(0) unless you know what you're doing
         * - 0 = UNLIMITED listeners = guaranteed memory leak on reconnections
         * - With limit, Node.js will warn if we exceed (helps debugging)
         *
         * Override via config.maxSocketClientListeners if needed for your use case
         */
        const maxListeners = (_a = config.maxSocketClientListeners) !== null && _a !== void 0 ? _a : 40;
        if (maxListeners === 0) {
            (_b = config.logger) === null || _b === void 0 ? void 0 : _b.warn({ maxListeners }, '⚠️  WARNING: setMaxListeners(0) allows UNLIMITED listeners - potential memory leak! Set a reasonable limit instead.');
        }
        this.setMaxListeners(maxListeners);
    }
}
exports.AbstractSocketClient = AbstractSocketClient;
