export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerConfig {
    /** Number of failures before opening the circuit */
    failureThreshold: number;
    /** Time window in ms to count failures */
    failureWindow: number;
    /** Time in ms to wait before attempting half-open */
    openTimeout: number;
    /** Number of successful calls needed to close from half-open */
    successThreshold: number;
    /** Optional error filter - only count errors that match this predicate */
    shouldCountError?: (error: Error) => boolean;
    /** Logger instance */
    logger?: any;
}
/**
 * Circuit Breaker implementation for PreKey error protection
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Too many failures, block all requests
 * - HALF_OPEN: Testing if system recovered, allow limited requests
 *
 * Flow:
 * CLOSED → [failures >= threshold] → OPEN → [timeout] → HALF_OPEN
 *                                                           ↓
 *                               [success >= threshold] ←   ↓   → [failure]
 *                                          ↓                     ↓
 *                                       CLOSED                 OPEN
 */
export declare class CircuitBreaker {
    private state;
    private failures;
    private successes;
    private openedAt;
    private readonly config;
    constructor(config: CircuitBreakerConfig);
    /**
     * Check if circuit breaker allows execution
     */
    canExecute(): boolean;
    /**
     * Record successful execution
     */
    recordSuccess(): void;
    /**
     * Record failed execution
     */
    recordFailure(error: Error): void;
    /**
     * Get current circuit breaker state
     */
    getState(): CircuitBreakerState;
    /**
     * Get statistics about circuit breaker
     */
    getStats(): {
        state: CircuitBreakerState;
        failures: number;
        successes: number;
        openedAt: number;
        timeUntilHalfOpen: number;
    };
    /**
     * Manually reset circuit breaker to CLOSED state
     */
    reset(): void;
    /**
     * Remove failures outside the time window
     */
    private cleanOldFailures;
    /**
     * Transition to a new state
     */
    private transitionTo;
}
/**
 * Create a PreKey-specific circuit breaker with sensible defaults
 */
export declare function createPreKeyCircuitBreaker(logger?: any): CircuitBreaker;
