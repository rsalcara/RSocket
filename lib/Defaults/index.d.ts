import { proto } from '../../WAProto';
import type { MediaType, SocketConfig } from '../Types';
export declare const UNAUTHORIZED_CODES: number[];
export declare const DEFAULT_ORIGIN = "https://web.whatsapp.com";
export declare const CALL_VIDEO_PREFIX = "https://call.whatsapp.com/video/";
export declare const CALL_AUDIO_PREFIX = "https://call.whatsapp.com/voice/";
export declare const DEF_CALLBACK_PREFIX = "CB:";
export declare const DEF_TAG_PREFIX = "TAG:";
export declare const PHONE_CONNECTION_CB = "CB:Pong";
export declare const WA_ADV_ACCOUNT_SIG_PREFIX: any;
export declare const WA_ADV_DEVICE_SIG_PREFIX: any;
export declare const WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX: any;
export declare const WA_ADV_HOSTED_DEVICE_SIG_PREFIX: any;
export declare const WA_DEFAULT_EPHEMERAL: number;
export declare const NOISE_MODE = "Noise_XX_25519_AESGCM_SHA256\0\0\0\0";
export declare const DICT_VERSION = 3;
export declare const KEY_BUNDLE_TYPE: any;
export declare const NOISE_WA_HEADER: any;
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
export declare const URL_REGEX: RegExp;
export declare const WA_CERT_DETAILS: {
    SERIAL: number;
    ISSUER: string;
    PUBLIC_KEY: any;
};
export declare const PROCESSABLE_HISTORY_TYPES: proto.Message.HistorySyncNotification.HistorySyncType[];
export declare const DEFAULT_CONNECTION_CONFIG: SocketConfig;
export declare const MEDIA_PATH_MAP: {
    [T in MediaType]?: string;
};
export declare const MEDIA_HKDF_KEY_MAPPING: {
    audio: string;
    document: string;
    gif: string;
    image: string;
    ppic: string;
    product: string;
    ptt: string;
    sticker: string;
    video: string;
    'thumbnail-document': string;
    'thumbnail-image': string;
    'thumbnail-video': string;
    'thumbnail-link': string;
    'md-msg-hist': string;
    'md-app-state': string;
    'product-catalog-image': string;
    'payment-bg-image': string;
    ptv: string;
    'biz-cover-photo': string;
};
export declare const MEDIA_KEYS: MediaType[];
export declare const MIN_PREKEY_COUNT = 5;
export declare const INITIAL_PREKEY_COUNT = 812;
/** Minimum interval between pre-key uploads (in milliseconds) */
export declare const MIN_UPLOAD_INTERVAL = 5000;
/** Timeout for pre-key upload operations (in milliseconds) */
export declare const UPLOAD_TIMEOUT = 30000;
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
export declare const DEFAULT_CACHE_TTLS: {
    SIGNAL_STORE: number;
    MSG_RETRY: number;
    CALL_OFFER: number;
    USER_DEVICES: number;
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
export declare const DEFAULT_CACHE_MAX_KEYS: {
    SIGNAL_STORE: number;
    MSG_RETRY: number;
    CALL_OFFER: number;
    USER_DEVICES: number;
    PLACEHOLDER_RESEND: number;
    LID_PER_SOCKET: number;
    LID_GLOBAL: number;
};
//# sourceMappingURL=index.d.ts.map