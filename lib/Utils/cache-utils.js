"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cache_1 = __importDefault(require("@cacheable/node-cache"));
const Defaults_1 = require("../Defaults");
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
    lidCache: new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.USER_DEVICES, // 5 minutes
        checkperiod: Defaults_1.DEFAULT_CACHE_TTLS.USER_DEVICES,
        maxKeys: Defaults_1.DEFAULT_CACHE_MAX_KEYS.LID_GLOBAL, // 10,000 keys
        deleteOnExpire: true, // Free memory when expired
        useClones: false // Performance optimization
    })
};
exports.default = caches;
