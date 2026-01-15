import { BaileysEventEmitter, BaileysEventMap } from '../Types';
import { ILogger } from './logger';
/**
 * A map that contains a list of all events that have been triggered
 *
 * Note, this can contain different type of events
 * this can make processing events extremely efficient -- since everything
 * can be done in a single transaction
 */
type BaileysEventData = Partial<BaileysEventMap>;
type BaileysBufferableEventEmitter = BaileysEventEmitter & {
    /** Use to process events in a batch */
    process(handler: (events: BaileysEventData) => void | Promise<void>): () => void;
    /**
     * starts buffering events, call flush() to release them
     * */
    buffer(): void;
    /** buffers all events till the promise completes */
    createBufferedFunction<A extends any[], T>(work: (...args: A) => Promise<T>): (...args: A) => Promise<T>;
    /**
     * flushes all buffered events
     * @param force if true, will flush all data regardless of any pending buffers
     * @returns returns true if the flush actually happened, otherwise false
     */
    flush(force?: boolean): boolean;
    /** is there an ongoing buffer */
    isBuffering(): boolean;
    /**
     * Destroys the buffer and cleans up all resources.
     * Prevents memory leaks and orphaned timers when socket disconnects.
     * This is automatically called when the socket closes.
     */
    destroy(): void;
};
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
export declare const BUFFER_CONFIG: {
    MAX_HISTORY_CACHE_SIZE: number;
    MAX_BUFFER_ITEMS: number;
    AUTO_FLUSH_TIMEOUT_MS: number;
    ENABLE_AUTO_FLUSH: boolean;
    ENABLE_ADAPTIVE_FLUSH: boolean;
    ADAPTIVE_MIN_TIMEOUT_MS: number;
    ADAPTIVE_MAX_TIMEOUT_MS: number;
    ADAPTIVE_LEARNING_RATE: number;
};
export declare const makeEventBuffer: (logger: ILogger) => BaileysBufferableEventEmitter;
export {};
