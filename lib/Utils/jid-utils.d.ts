/**
 * JID Utilities for WhatsApp Contact Normalization
 *
 * Provides functions to normalize WhatsApp JIDs (Jabber IDs) to prevent
 * duplicate contacts/tickets when the same user appears with different
 * JID formats (@lid vs @s.whatsapp.net).
 *
 * @module jid-utils
 */
/**
 * Extracts the phone number from a WhatsApp JID, regardless of format.
 *
 * Handles multiple JID formats:
 * - Regular: 5511999999999@s.whatsapp.net
 * - LID (Local ID): 5511999999999@lid
 * - Newsletter: 120363XXX@newsletter
 * - Groups: 120363XXX@g.us
 * - Broadcast: status@broadcast
 *
 * @param jid - The WhatsApp JID to extract from
 * @returns The phone number without domain, or the original JID if not a standard format
 *
 * @example
 * ```typescript
 * extractPhoneNumber('5511999999999@s.whatsapp.net') // '5511999999999'
 * extractPhoneNumber('5511999999999@lid')            // '5511999999999'
 * extractPhoneNumber('120363XXX@g.us')               // '120363XXX'
 * ```
 */
export declare function extractPhoneNumber(jid: string): string;
/**
 * Normalizes a WhatsApp JID to a consistent format for deduplication.
 *
 * This function converts all JID variations (@lid, @s.whatsapp.net, etc.)
 * to a standard format to ensure the same contact is always identified
 * consistently, preventing duplicate tickets/contacts.
 *
 * Normalization rules:
 * - Individual contacts: phoneNumber@s.whatsapp.net (preferred) or phoneNumber@c.us (legacy)
 * - @lid is converted to @s.whatsapp.net
 * - Groups and broadcasts are preserved as-is
 * - Newsletter is preserved as-is
 *
 * @param jid - The WhatsApp JID to normalize
 * @param preferLegacyFormat - If true, uses @c.us instead of @s.whatsapp.net (default: false)
 * @returns Normalized JID in consistent format
 *
 * @example
 * ```typescript
 * normalizeJid('5511999999999@lid')              // '5511999999999@s.whatsapp.net'
 * normalizeJid('5511999999999@s.whatsapp.net')   // '5511999999999@s.whatsapp.net'
 * normalizeJid('5511999999999@c.us')             // '5511999999999@s.whatsapp.net'
 * normalizeJid('120363XXX@g.us')                 // '120363XXX@g.us' (preserved)
 * normalizeJid('status@broadcast')                // 'status@broadcast' (preserved)
 * ```
 */
export declare function normalizeJid(jid: string, preferLegacyFormat?: boolean): string;
/**
 * Checks if two JIDs represent the same contact, even if formats differ.
 *
 * @param jid1 - First JID to compare
 * @param jid2 - Second JID to compare
 * @returns True if both JIDs represent the same contact
 *
 * @example
 * ```typescript
 * areJidsEqual('5511999999999@lid', '5511999999999@s.whatsapp.net')  // true
 * areJidsEqual('5511999999999@lid', '5511888888888@lid')             // false
 * areJidsEqual('120363XXX@g.us', '120363XXX@g.us')                   // true
 * ```
 */
export declare function areJidsEqual(jid1: string, jid2: string): boolean;
/**
 * Gets the JID type based on its format.
 *
 * @param jid - The WhatsApp JID to check
 * @returns The type of JID: 'individual', 'group', 'broadcast', 'newsletter', or 'unknown'
 *
 * @example
 * ```typescript
 * getJidType('5511999999999@s.whatsapp.net')  // 'individual'
 * getJidType('5511999999999@lid')              // 'individual'
 * getJidType('120363XXX@g.us')                 // 'group'
 * getJidType('status@broadcast')                // 'broadcast'
 * getJidType('120363XXX@newsletter')           // 'newsletter'
 * ```
 */
export declare function getJidType(jid: string): 'individual' | 'group' | 'broadcast' | 'newsletter' | 'unknown';
/**
 * Checks if a JID represents an individual contact (not a group, broadcast, or newsletter).
 *
 * @param jid - The WhatsApp JID to check
 * @returns True if JID is an individual contact
 *
 * @example
 * ```typescript
 * isIndividualJid('5511999999999@s.whatsapp.net')  // true
 * isIndividualJid('5511999999999@lid')              // true
 * isIndividualJid('120363XXX@g.us')                 // false
 * ```
 */
export declare function isIndividualJid(jid: string): boolean;
/**
 * Validates if a JID has a valid format.
 *
 * @param jid - The WhatsApp JID to validate
 * @returns Validation result with `valid` flag and optional error message
 *
 * @example
 * ```typescript
 * validateJid('5511999999999@s.whatsapp.net')  // { valid: true }
 * validateJid('invalid')                        // { valid: false, error: 'Missing @ separator' }
 * validateJid('')                               // { valid: false, error: 'JID is empty' }
 * ```
 */
export declare function validateJid(jid: string): {
    valid: boolean;
    error?: string;
};
