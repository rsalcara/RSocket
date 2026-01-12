import type { SocketConfig } from '../Types';
/**
 * Calculates the backoff delay with exponential backoff and optional jitter for retry logic.
 *
 * This function implements a robust retry mechanism to prevent "thundering herd" problems
 * in multi-tenant or high-concurrency scenarios. It combines exponential backoff with
 * randomized jitter to distribute retry attempts across time.
 *
 * ## Why Jitter Matters:
 * Without jitter, all failed requests retry at exactly the same time, causing:
 * - Server overload spikes (thundering herd)
 * - Cascading failures
 * - Poor resource utilization
 *
 * With jitter, retries are spread out randomly, resulting in:
 * - Smooth load distribution
 * - Better server stability
 * - Improved success rates under high load
 *
 * ## Use Cases:
 * - Message decryption retry after key errors
 * - Network request failures
 * - Any operation that might fail temporarily and needs retry logic
 *
 * @param attempt - The current retry attempt number (0-indexed). Must be >= 0.
 * @param config - Socket configuration containing retry settings
 * @param config.retryBackoffDelays - Array of base delays in ms for each retry attempt
 * @param config.retryJitterFactor - Jitter factor (0-1) to add randomness
 *
 * @returns The calculated delay in milliseconds with jitter applied
 *
 * @example
 * ```typescript
 * // Basic usage with default config
 * const delay1 = getBackoffDelay(0, config) // ~1000ms (1000 + 0-150ms jitter)
 * const delay2 = getBackoffDelay(1, config) // ~2000ms (2000 + 0-300ms jitter)
 * const delay5 = getBackoffDelay(4, config) // ~20000ms (20000 + 0-3000ms jitter)
 *
 * // Exceeding array length uses last element
 * const delay10 = getBackoffDelay(10, config) // ~20000ms (uses last element)
 * ```
 *
 * @example
 * ```typescript
 * // Custom config for unstable network
 * const customConfig = {
 *   ...config,
 *   retryBackoffDelays: [2000, 5000, 10000, 30000, 60000],
 *   retryJitterFactor: 0.25  // 25% jitter for better distribution
 * }
 * const delay = getBackoffDelay(2, customConfig) // ~10000-12500ms
 * ```
 *
 * @example
 * ```typescript
 * // Multi-tenant scenario with high jitter
 * const multiTenantConfig = {
 *   ...config,
 *   retryJitterFactor: 0.3  // 30% jitter to prevent coordinated retries
 * }
 * ```
 *
 * ## Algorithm:
 * 1. Select base delay from array (or last element if attempt exceeds array length)
 * 2. Calculate jitter: baseDelay * jitterFactor * random(0,1)
 * 3. Return: baseDelay + jitter
 *
 * ## Performance:
 * - Time Complexity: O(1)
 * - Space Complexity: O(1)
 * - No allocations, pure computation
 */
export declare function getBackoffDelay(attempt: number, config: SocketConfig): number;
/**
 * Validates retry configuration parameters and returns validation errors if any.
 *
 * This function performs comprehensive validation of retry-related configuration
 * to catch misconfigurations early and provide clear error messages.
 *
 * ## Validation Rules:
 * 1. retryBackoffDelays must be a non-empty array
 * 2. All delays must be positive numbers
 * 3. Delays should be in ascending order (warning, not error)
 * 4. retryJitterFactor must be between 0 and 1
 * 5. maxMsgRetryCount should not exceed retryBackoffDelays length (warning)
 *
 * @param config - Socket configuration to validate
 * @returns Object with { valid: boolean, errors: string[], warnings: string[] }
 *
 * @example
 * ```typescript
 * const result = validateRetryConfig(config)
 * if (!result.valid) {
 *   console.error('Invalid retry config:', result.errors)
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Config warnings:', result.warnings)
 * }
 * ```
 */
export declare function validateRetryConfig(config: SocketConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
