import { DEFAULT_CONNECTION_CONFIG } from '../Defaults'
import type { SocketConfig, UserFacingSocketConfig } from '../Types'
import { fetchLatestWaWebVersionCached, clearWaVersionCache, getCachedWaVersion } from '../Utils/generics'
import { makeBusinessSocket } from './business'

/**
 * Creates the base socket configuration with common setup
 */
const createSocketConfig = (config: UserFacingSocketConfig): SocketConfig => {
	const newConfig = {
		...DEFAULT_CONNECTION_CONFIG,
		...config
	}

	// If the user hasn't provided their own history sync function,
	// let's create a default one that respects the syncFullHistory flag.
	if (config.shouldSyncHistoryMessage === undefined) {
		newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory
	}

	return newConfig
}

/**
 * Creates a WhatsApp socket connection (synchronous version).
 * Uses the version specified in config or the default hardcoded version.
 *
 * For automatic version fetching, use makeWASocketAsync instead.
 */
const makeWASocket = (config: UserFacingSocketConfig) => {
	return makeBusinessSocket(createSocketConfig(config))
}

/**
 * Creates a WhatsApp socket connection with optional automatic version fetching.
 *
 * When `fetchLatestVersion` is true in config, this function will:
 * 1. Fetch the latest WhatsApp Web version from WhatsApp's servers
 * 2. Cache the version for `versionCacheTTLMs` (default: 1 hour)
 * 3. Use the fetched version for the connection
 *
 * If fetching fails, it falls back to the hardcoded default version.
 *
 * @example
 * // Auto-fetch latest version
 * const sock = await makeWASocketAsync({
 *   auth: state,
 *   fetchLatestVersion: true
 * })
 *
 * @example
 * // Auto-fetch with custom cache TTL (30 minutes)
 * const sock = await makeWASocketAsync({
 *   auth: state,
 *   fetchLatestVersion: true,
 *   versionCacheTTLMs: 30 * 60 * 1000
 * })
 */
export const makeWASocketAsync = async (config: UserFacingSocketConfig) => {
	const newConfig = createSocketConfig(config)

	// Auto-fetch latest version if enabled
	if (config.fetchLatestVersion) {
		const cacheTTL = config.versionCacheTTLMs ?? 60 * 60 * 1000 // default 1 hour
		const result = await fetchLatestWaWebVersionCached(cacheTTL, config.options)

		if (result.isLatest) {
			newConfig.version = result.version
			newConfig.logger?.info(
				{ version: result.version.join('.'), fromCache: result.fromCache },
				'Using auto-fetched WhatsApp Web version'
			)
		} else {
			newConfig.logger?.warn(
				{ error: result.error, fallbackVersion: newConfig.version.join('.') },
				'Failed to fetch latest version, using default'
			)
		}
	}

	return makeBusinessSocket(newConfig)
}

// Re-export version cache utilities for advanced use cases
export { clearWaVersionCache, getCachedWaVersion }

export default makeWASocket
