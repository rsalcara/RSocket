import { proto } from '../../WAProto/index.js';
import { makeLibSignalRepository } from '../Signal/libsignal.js';
import { Browsers } from '../Utils/generics.js';
import logger from '../Utils/logger.js';
import { version } from './baileys-version.json';
export const UNAUTHORIZED_CODES = [401, 403, 419];
export const DEFAULT_ORIGIN = 'https://web.whatsapp.com';
// Call link prefixes for event messages (upstream feature)
export const CALL_VIDEO_PREFIX = 'https://call.whatsapp.com/video/';
export const CALL_AUDIO_PREFIX = 'https://call.whatsapp.com/voice/';
export const DEF_CALLBACK_PREFIX = 'CB:';
export const DEF_TAG_PREFIX = 'TAG:';
export const PHONE_CONNECTION_CB = 'CB:Pong';
export const WA_ADV_ACCOUNT_SIG_PREFIX = Buffer.from([6, 0]);
export const WA_ADV_DEVICE_SIG_PREFIX = Buffer.from([6, 1]);
export const WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5]);
export const WA_ADV_HOSTED_DEVICE_SIG_PREFIX = Buffer.from([6, 6]);
export const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
export const NOISE_MODE = 'Noise_XX_25519_AESGCM_SHA256\0\0\0\0';
export const DICT_VERSION = 3;
export const KEY_BUNDLE_TYPE = Buffer.from([5]);
export const NOISE_WA_HEADER = Buffer.from([87, 65, 6, DICT_VERSION]); // last is "DICT_VERSION"
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
export const URL_REGEX = /https:\/\/(?![^:@\/\s]+:[^:@\/\s]+@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?/g;
export const WA_CERT_DETAILS = {
    SERIAL: 0,
    ISSUER: 'WhatsAppLongTerm1',
    PUBLIC_KEY: Buffer.from('142375574d0a587166aae71ebe516437c4a28b73e3695c6ce1f7f9545da8ee6b', 'hex')
};
export const PROCESSABLE_HISTORY_TYPES = [
    proto.Message.HistorySyncNotification.HistorySyncType.INITIAL_BOOTSTRAP,
    proto.Message.HistorySyncNotification.HistorySyncType.PUSH_NAME,
    proto.Message.HistorySyncNotification.HistorySyncType.RECENT,
    proto.Message.HistorySyncNotification.HistorySyncType.FULL,
    proto.Message.HistorySyncNotification.HistorySyncType.ON_DEMAND
];
export const DEFAULT_CONNECTION_CONFIG = {
    version: version,
    browser: Browsers.ubuntu('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 30000,
    logger: logger.child({ class: 'baileys' }),
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
    makeSignalRepository: makeLibSignalRepository
};
export const MEDIA_PATH_MAP = {
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
export const MEDIA_HKDF_KEY_MAPPING = {
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
export const MEDIA_KEYS = Object.keys(MEDIA_PATH_MAP);
export const MIN_PREKEY_COUNT = 5;
export const INITIAL_PREKEY_COUNT = 30;
/** Minimum interval between pre-key uploads (in milliseconds) */
export const MIN_UPLOAD_INTERVAL = 60000; // 1 minute
/** Timeout for pre-key upload operations (in milliseconds) */
export const UPLOAD_TIMEOUT = 30000; // 30 seconds
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
export const DEFAULT_CACHE_TTLS = {
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
export const DEFAULT_CACHE_MAX_KEYS = {
    SIGNAL_STORE: 10000,
    MSG_RETRY: 10000,
    CALL_OFFER: 500,
    USER_DEVICES: 5000,
    PLACEHOLDER_RESEND: 5000,
    LID_PER_SOCKET: 2000,
    LID_GLOBAL: 10000
};
//# sourceMappingURL=index.js.map