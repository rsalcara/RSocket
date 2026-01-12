import type { SocketConfig } from '../Types'

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
export function getBackoffDelay(attempt: number, config: SocketConfig): number {
	// Input validation: ensure attempt is non-negative
	const safeAttempt = Math.max(0, attempt)

	// Defensive: ensure retryBackoffDelays exists and has at least one element
	const delays = config.retryBackoffDelays
	if(!delays || delays.length === 0) {
		// Fallback to a sensible default if config is invalid
		return 1000
	}

	// Get base delay: use array element or last element if attempt exceeds length
	const delayIndex = Math.min(safeAttempt, delays.length - 1)
	const baseDelay = delays[delayIndex]

	// Validate base delay is positive
	if(baseDelay <= 0) {
		// Skip jitter if base delay is invalid
		return Math.max(0, baseDelay)
	}

	// Calculate jitter factor: clamp between 0 and 1 for safety
	const jitterFactor = Math.max(0, Math.min(1, config.retryJitterFactor || 0))

	// Calculate random jitter: adds 0 to (baseDelay * jitterFactor) milliseconds
	// Math.random() returns [0, 1), giving us [0, maxJitter) range
	const maxJitter = baseDelay * jitterFactor
	const jitter = maxJitter * Math.random()

	// Return base delay + jitter (always positive due to validations above)
	return Math.floor(baseDelay + jitter)
}

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
export function validateRetryConfig(config: SocketConfig): {
	valid: boolean
	errors: string[]
	warnings: string[]
} {
	const errors: string[] = []
	const warnings: string[] = []

	// Validate retryBackoffDelays
	if(!config.retryBackoffDelays || !Array.isArray(config.retryBackoffDelays)) {
		errors.push('retryBackoffDelays must be an array')
	} else if(config.retryBackoffDelays.length === 0) {
		errors.push('retryBackoffDelays must contain at least one delay value')
	} else {
		// Validate all delays are positive numbers
		config.retryBackoffDelays.forEach((delay, index) => {
			if(typeof delay !== 'number' || delay <= 0) {
				errors.push(`retryBackoffDelays[${index}] must be a positive number, got: ${delay}`)
			}
		})

		// Check if delays are in ascending order (warning only)
		for(let i = 1; i < config.retryBackoffDelays.length; i++) {
			if(config.retryBackoffDelays[i] < config.retryBackoffDelays[i - 1]) {
				warnings.push(
					`retryBackoffDelays[${i}] (${config.retryBackoffDelays[i]}ms) is less than ` +
					`retryBackoffDelays[${i - 1}] (${config.retryBackoffDelays[i - 1]}ms). ` +
					`Delays should generally be in ascending order for exponential backoff.`
				)
			}
		}
	}

	// Validate retryJitterFactor
	if(typeof config.retryJitterFactor !== 'number') {
		errors.push('retryJitterFactor must be a number')
	} else if(config.retryJitterFactor < 0 || config.retryJitterFactor > 1) {
		errors.push(`retryJitterFactor must be between 0 and 1, got: ${config.retryJitterFactor}`)
	}

	// Cross-validate with maxMsgRetryCount (warning only)
	if(
		config.maxMsgRetryCount &&
		config.retryBackoffDelays &&
		config.maxMsgRetryCount > config.retryBackoffDelays.length
	) {
		warnings.push(
			`maxMsgRetryCount (${config.maxMsgRetryCount}) exceeds retryBackoffDelays length ` +
			`(${config.retryBackoffDelays.length}). The last delay value will be reused for ` +
			`remaining retries.`
		)
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	}
}
