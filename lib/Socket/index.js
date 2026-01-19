"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedWaVersion = exports.clearWaVersionCache = exports.makeWASocketAsync = void 0;
const Defaults_1 = require("../Defaults");
const generics_1 = require("../Utils/generics");
Object.defineProperty(exports, "clearWaVersionCache", { enumerable: true, get: function () { return generics_1.clearWaVersionCache; } });
Object.defineProperty(exports, "getCachedWaVersion", { enumerable: true, get: function () { return generics_1.getCachedWaVersion; } });
const business_1 = require("./business");
/**
 * Creates the base socket configuration with common setup
 */
const createSocketConfig = (config) => {
    const newConfig = {
        ...Defaults_1.DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    // If the user hasn't provided their own history sync function,
    // let's create a default one that respects the syncFullHistory flag.
    if (config.shouldSyncHistoryMessage === undefined) {
        newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory;
    }
    return newConfig;
};
/**
 * Creates a WhatsApp socket connection (synchronous version).
 * Uses the version specified in config or the default hardcoded version.
 *
 * For automatic version fetching, use makeWASocketAsync instead.
 */
const makeWASocket = (config) => {
    return (0, business_1.makeBusinessSocket)(createSocketConfig(config));
};
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
const makeWASocketAsync = async (config) => {
    const newConfig = createSocketConfig(config);
    // Auto-fetch latest version if enabled
    if (config.fetchLatestVersion) {
        const cacheTTL = config.versionCacheTTLMs ?? 60 * 60 * 1000; // default 1 hour
        const result = await (0, generics_1.fetchLatestWaWebVersionCached)(cacheTTL, config.options);
        if (result.isLatest) {
            newConfig.version = result.version;
            newConfig.logger?.info({ version: result.version.join('.'), fromCache: result.fromCache }, 'Using auto-fetched WhatsApp Web version');
        }
        else {
            newConfig.logger?.warn({ error: result.error, fallbackVersion: newConfig.version.join('.') }, 'Failed to fetch latest version, using default');
        }
    }
    return (0, business_1.makeBusinessSocket)(newConfig);
};
exports.makeWASocketAsync = makeWASocketAsync;
exports.default = makeWASocket;
//# sourceMappingURL=index.js.map