"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CACHE_MAX_KEYS = exports.DEFAULT_CACHE_TTLS = exports.UPLOAD_TIMEOUT = exports.MIN_UPLOAD_INTERVAL = exports.INITIAL_PREKEY_COUNT = exports.MIN_PREKEY_COUNT = exports.MEDIA_KEYS = exports.MEDIA_HKDF_KEY_MAPPING = exports.MEDIA_PATH_MAP = exports.DEFAULT_CONNECTION_CONFIG = exports.PROCESSABLE_HISTORY_TYPES = exports.WA_CERT_DETAILS = exports.URL_REGEX = exports.NOISE_WA_HEADER = exports.KEY_BUNDLE_TYPE = exports.DICT_VERSION = exports.NOISE_MODE = exports.WA_DEFAULT_EPHEMERAL = exports.WA_ADV_HOSTED_DEVICE_SIG_PREFIX = exports.WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = exports.WA_ADV_DEVICE_SIG_PREFIX = exports.WA_ADV_ACCOUNT_SIG_PREFIX = exports.PHONE_CONNECTION_CB = exports.DEF_TAG_PREFIX = exports.DEF_CALLBACK_PREFIX = exports.CALL_AUDIO_PREFIX = exports.CALL_VIDEO_PREFIX = exports.DEFAULT_ORIGIN = exports.UNAUTHORIZED_CODES = void 0;
const WAProto_1 = require("../../WAProto");
const libsignal_1 = require("../Signal/libsignal");
const generics_1 = require("../Utils/generics");
const logger_1 = __importDefault(require("../Utils/logger"));
const baileys_version_json_1 = __importDefault(require("./baileys-version.json"));
const { version } = baileys_version_json_1.default;
exports.UNAUTHORIZED_CODES = [401, 403, 419];
exports.DEFAULT_ORIGIN = 'https://web.whatsapp.com';
// Call link prefixes for event messages (upstream feature)
exports.CALL_VIDEO_PREFIX = 'https://call.whatsapp.com/video/';
exports.CALL_AUDIO_PREFIX = 'https://call.whatsapp.com/voice/';
exports.DEF_CALLBACK_PREFIX = 'CB:';
exports.DEF_TAG_PREFIX = 'TAG:';
exports.PHONE_CONNECTION_CB = 'CB:Pong';
exports.WA_ADV_ACCOUNT_SIG_PREFIX = Buffer.from([6, 0]);
exports.WA_ADV_DEVICE_SIG_PREFIX = Buffer.from([6, 1]);
exports.WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5]);
exports.WA_ADV_HOSTED_DEVICE_SIG_PREFIX = Buffer.from([6, 6]);
exports.WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
exports.NOISE_MODE = 'Noise_XX_25519_AESGCM_SHA256\0\0\0\0';
exports.DICT_VERSION = 3;
exports.KEY_BUNDLE_TYPE = Buffer.from([5]);
exports.NOISE_WA_HEADER = Buffer.from([87, 65, 6, exports.DICT_VERSION]); // last is "DICT_VERSION"
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
exports.URL_REGEX = /https:\/\/(?![^:@\/\s]+:[^:@\/\s]+@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?/g;
exports.WA_CERT_DETAILS = {
    SERIAL: 0,
    ISSUER: 'WhatsAppLongTerm1',
    PUBLIC_KEY: Buffer.from('142375574d0a587166aae71ebe516437c4a28b73e3695c6ce1f7f9545da8ee6b', 'hex')
};
exports.PROCESSABLE_HISTORY_TYPES = [
    WAProto_1.proto.Message.HistorySyncNotification.HistorySyncType.INITIAL_BOOTSTRAP,
    WAProto_1.proto.Message.HistorySyncNotification.HistorySyncType.PUSH_NAME,
    WAProto_1.proto.Message.HistorySyncNotification.HistorySyncType.RECENT,
    WAProto_1.proto.Message.HistorySyncNotification.HistorySyncType.FULL,
    WAProto_1.proto.Message.HistorySyncNotification.HistorySyncType.ON_DEMAND
];
exports.DEFAULT_CONNECTION_CONFIG = {
    version: version,
    browser: generics_1.Browsers.ubuntu('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 30000,
    logger: logger_1.default.child({ class: 'baileys' }),
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 60000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    retryBackoffDelays: [1000, 2000, 5000, 10000, 20000],
    retryJitterFactor: 0.15,
    fireInitQueries: true,
    auth: undefined,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
    generateHighQualityLinkPreview: false,
    enableAutoSessionRecreation: true,
    enableRecentMessageCache: true,
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: async () => undefined,
    makeSignalRepository: libsignal_1.makeLibSignalRepository,
    // Auto-fetch version settings
    fetchLatestVersion: false,
    versionCacheTTLMs: 60 * 60 * 1000 // 1 hour
};
exports.MEDIA_PATH_MAP = {
    image: '/mms/image',
    video: '/mms/video',
    document: '/mms/document',
    audio: '/mms/audio',
    sticker: '/mms/image',
    'thumbnail-link': '/mms/image',
    'product-catalog-image': '/product/image',
    'md-app-state': '',
    'md-msg-hist': '/mms/md-app-state',
    'biz-cover-photo': '/pps/biz-cover-photo'
};
exports.MEDIA_HKDF_KEY_MAPPING = {
    audio: 'Audio',
    document: 'Document',
    gif: 'Video',
    image: 'Image',
    ppic: '',
    product: 'Image',
    ptt: 'Audio',
    sticker: 'Image',
    video: 'Video',
    'thumbnail-document': 'Document Thumbnail',
    'thumbnail-image': 'Image Thumbnail',
    'thumbnail-video': 'Video Thumbnail',
    'thumbnail-link': 'Link Thumbnail',
    'md-msg-hist': 'History',
    'md-app-state': 'App State',
    'product-catalog-image': '',
    'payment-bg-image': 'Payment Background',
    ptv: 'Video',
    'biz-cover-photo': 'Image'
};
exports.MEDIA_KEYS = Object.keys(exports.MEDIA_PATH_MAP);
exports.MIN_PREKEY_COUNT = 5;
// CRITICAL: This value must match upstream (812) to prevent error 515
// WhatsApp requires a minimum number of pre-keys for session establishment
// Reduced values cause "restart required" (515) errors during connection
exports.INITIAL_PREKEY_COUNT = 812;
/** Minimum interval between pre-key uploads (in milliseconds) */
// Restored to upstream value to ensure timely pre-key uploads
exports.MIN_UPLOAD_INTERVAL = 5000; // 5 seconds (upstream default)
/** Timeout for pre-key upload operations (in milliseconds) */
exports.UPLOAD_TIMEOUT = 30000; // 30 seconds
/**
 * Default TTL (Time-To-Live) and memory limits for internal caches
 *
 * CRITICAL: All caches now have maxKeys limits to prevent unbounded memory growth
 * These values are conservative for production with 50-100+ concurrent tenants
 *
 * Memory leak prevention (Issue #3):
 * - Before: Caches could grow indefinitely → OOM crashes under high load
 * - After: Strict memory limits with automatic eviction (LRU)
 */
exports.DEFAULT_CACHE_TTLS = {
    SIGNAL_STORE: 5 * 60, // 5 minutes
    MSG_RETRY: 60 * 60, // 1 hour
    CALL_OFFER: 5 * 60, // 5 minutes
    USER_DEVICES: 5 * 60 // 5 minutes
};
/**
 * Default maximum keys for internal caches (Memory leak prevention)
 *
 * Conservative limits for multi-tenant production (50-100+ tenants):
 * - Prevents OOM crashes from unbounded cache growth
 * - Uses LRU eviction when limit is reached
 * - Tested under high load scenarios
 *
 * Per-socket caches (multiplied by number of tenants):
 * - SIGNAL_STORE: 10k keys (cryptographic keys)
 * - MSG_RETRY: 10k keys (high message volume)
 * - CALL_OFFER: 500 keys (calls are rare)
 * - USER_DEVICES: 5k keys (devices per user)
 * - PLACEHOLDER_RESEND: 5k keys (temporary placeholders)
 * - LID_PER_SOCKET: 2k keys (link IDs per socket)
 *
 * Global caches (shared across all tenants):
 * - LID_GLOBAL: 10k keys (shared link IDs)
 *
 * Override individual limits via SocketConfig if your use case requires more
 */
exports.DEFAULT_CACHE_MAX_KEYS = {
    SIGNAL_STORE: 10000,
    MSG_RETRY: 10000,
    CALL_OFFER: 500,
    USER_DEVICES: 5000,
    PLACEHOLDER_RESEND: 5000,
    LID_PER_SOCKET: 2000,
    LID_GLOBAL: 10000
};
//# sourceMappingURL=index.js.map