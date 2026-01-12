import NodeCache from '@cacheable/node-cache';
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
declare const caches: {
    lidCache: NodeCache;
};
export default caches;
