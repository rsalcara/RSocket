import NodeCache from '@cacheable/node-cache'
import { DEFAULT_CACHE_TTLS, DEFAULT_CACHE_MAX_KEYS } from '../Defaults'

/**
 * Global caches shared across all socket instances
 *
 * CRITICAL: Memory leak prevention (Issue #3)
 * - Before: No maxKeys limit → unbounded growth → OOM crashes
 * - After: Strict limits with LRU eviction
 *
 * With 100 tenants × 100 links each = 10,000 keys (at limit)
 * LRU eviction ensures only most recent links are kept
 */
const caches = {
	lidCache: new NodeCache({
		stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES, // 5 minutes
		checkperiod: DEFAULT_CACHE_TTLS.USER_DEVICES,
		maxKeys: DEFAULT_CACHE_MAX_KEYS.LID_GLOBAL, // 10,000 keys
		deleteOnExpire: true, // Free memory when expired
		useClones: false // Performance optimization
	})
}

export default caches
