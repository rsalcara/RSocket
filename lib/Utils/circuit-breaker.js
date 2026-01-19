"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
exports.createPreKeyCircuitBreaker = createPreKeyCircuitBreaker;
const baileys_logger_1 = require("./baileys-logger");
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
class CircuitBreaker {
    constructor(config) {
        this.state = 'CLOSED';
        this.failures = [];
        this.successes = 0;
        this.openedAt = 0;
        this.config = {
            shouldCountError: () => true,
            logger: undefined,
            ...config
        };
    }
    /**
     * Check if circuit breaker allows execution
     */
    canExecute() {
        this.cleanOldFailures();
        switch (this.state) {
            case 'CLOSED':
                return true;
            case 'OPEN':
                // Check if timeout has passed
                if (Date.now() - this.openedAt >= this.config.openTimeout) {
                    this.transitionTo('HALF_OPEN');
                    return true;
                }
                return false;
            case 'HALF_OPEN':
                return true;
            default:
                return false;
        }
    }
    /**
     * Record successful execution
     */
    recordSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            this.config.logger?.debug({ successes: this.successes, threshold: this.config.successThreshold }, 'Circuit breaker success recorded');
            // BAILEYS_LOG
            if ((0, baileys_logger_1.isBaileysLogEnabled)()) {
                console.log(`[BAILEYS] ✅ Circuit Breaker success: ${this.successes}/${this.config.successThreshold}`);
            }
            if (this.successes >= this.config.successThreshold) {
                this.transitionTo('CLOSED');
            }
        }
        else if (this.state === 'CLOSED') {
            // In closed state, keep cleaning up old failures
            this.cleanOldFailures();
        }
    }
    /**
     * Record failed execution
     */
    recordFailure(error) {
        // Check if this error should be counted
        if (!this.config.shouldCountError(error)) {
            this.config.logger?.debug({ error: error.message }, 'Circuit breaker ignoring error (filtered out)');
            return;
        }
        const now = Date.now();
        this.failures.push({
            timestamp: now,
            error: error.message
        });
        this.config.logger?.debug({ failureCount: this.failures.length, error: error.message }, 'Circuit breaker failure recorded');
        // BAILEYS_LOG
        if ((0, baileys_logger_1.isBaileysLogEnabled)()) {
            console.log(`[BAILEYS] ❌ Circuit Breaker failure: ${this.failures.length}/${this.config.failureThreshold} - ${error.message}`);
        }
        if (this.state === 'HALF_OPEN') {
            // In half-open, any failure reopens the circuit
            this.transitionTo('OPEN');
        }
        else if (this.state === 'CLOSED') {
            this.cleanOldFailures();
            // Check if we've hit the threshold
            if (this.failures.length >= this.config.failureThreshold) {
                this.transitionTo('OPEN');
            }
        }
    }
    /**
     * Get current circuit breaker state
     */
    getState() {
        return this.state;
    }
    /**
     * Get statistics about circuit breaker
     */
    getStats() {
        return {
            state: this.state,
            failures: this.failures.length,
            successes: this.successes,
            openedAt: this.openedAt,
            timeUntilHalfOpen: this.state === 'OPEN'
                ? Math.max(0, this.config.openTimeout - (Date.now() - this.openedAt))
                : 0
        };
    }
    /**
     * Manually reset circuit breaker to CLOSED state
     */
    reset() {
        this.transitionTo('CLOSED');
    }
    /**
     * Remove failures outside the time window
     */
    cleanOldFailures() {
        const now = Date.now();
        const cutoff = now - this.config.failureWindow;
        this.failures = this.failures.filter(f => f.timestamp > cutoff);
    }
    /**
     * Transition to a new state
     */
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        switch (newState) {
            case 'OPEN':
                this.openedAt = Date.now();
                this.successes = 0;
                this.config.logger?.warn({
                    oldState,
                    failures: this.failures.length,
                    openTimeout: this.config.openTimeout
                }, 'Circuit breaker opened - blocking requests');
                // BAILEYS_LOG
                if ((0, baileys_logger_1.isBaileysLogEnabled)()) {
                    console.log(`[BAILEYS] 🔴 Circuit Breaker OPENED - Blocking requests`, {
                        failures: this.failures.length,
                        waitTime: `${this.config.openTimeout / 1000}s`
                    });
                }
                break;
            case 'HALF_OPEN':
                this.successes = 0;
                this.config.logger?.info({ oldState }, 'Circuit breaker half-open - testing recovery');
                // BAILEYS_LOG
                if ((0, baileys_logger_1.isBaileysLogEnabled)()) {
                    console.log(`[BAILEYS] 🟡 Circuit Breaker HALF-OPEN - Testing recovery`);
                }
                break;
            case 'CLOSED':
                this.failures = [];
                this.successes = 0;
                this.openedAt = 0;
                this.config.logger?.info({ oldState }, 'Circuit breaker closed - normal operation resumed');
                // BAILEYS_LOG
                if ((0, baileys_logger_1.isBaileysLogEnabled)()) {
                    console.log(`[BAILEYS] 🟢 Circuit Breaker CLOSED - Normal operation resumed`);
                }
                break;
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Create a PreKey-specific circuit breaker with sensible defaults
 */
function createPreKeyCircuitBreaker(logger) {
    return new CircuitBreaker({
        failureThreshold: 5, // 5 failures
        failureWindow: 60 * 1000, // within 60 seconds
        openTimeout: 30 * 1000, // wait 30 seconds before retry
        successThreshold: 2, // need 2 successes to close
        logger,
        shouldCountError: (error) => {
            // Only count PreKey-related errors
            const msg = error.message?.toLowerCase() || '';
            return (msg.includes('prekey') ||
                msg.includes('pre-key') ||
                msg.includes('key used already') ||
                msg.includes('never filled') ||
                msg.includes('session') ||
                msg.includes('decrypt'));
        }
    });
}
//# sourceMappingURL=circuit-breaker.js.map