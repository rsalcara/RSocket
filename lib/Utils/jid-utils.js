"use strict";
/**
 * JID Utilities for WhatsApp Contact Normalization
 *
 * Provides functions to normalize WhatsApp JIDs (Jabber IDs) to prevent
 * duplicate contacts/tickets when the same user appears with different
 * JID formats (@lid vs @s.whatsapp.net).
 *
 * @module jid-utils
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPhoneNumber = extractPhoneNumber;
exports.normalizeJid = normalizeJid;
exports.areJidsEqual = areJidsEqual;
exports.getJidType = getJidType;
exports.isIndividualJid = isIndividualJid;
exports.validateJid = validateJid;
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
function extractPhoneNumber(jid) {
    if (!jid || typeof jid !== 'string') {
        return jid;
    }
    // Split at @ to get the user part
    const parts = jid.split('@');
    if (parts.length < 2) {
        return jid;
    }
    const [userPart] = parts;
    // Remove any additional suffixes (e.g., :XX for device IDs)
    return userPart.split(':')[0];
}
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
function normalizeJid(jid, preferLegacyFormat = false) {
    if (!jid || typeof jid !== 'string') {
        return jid;
    }
    // Special cases that should not be normalized
    const preservedDomains = [
        '@g.us', // Groups
        '@broadcast', // Broadcast lists
        '@newsletter', // Newsletter/Channels
    ];
    for (const domain of preservedDomains) {
        if (jid.endsWith(domain)) {
            return jid;
        }
    }
    // Extract phone number
    const phoneNumber = extractPhoneNumber(jid);
    // Check if it's already in the correct format
    const currentDomain = jid.substring(phoneNumber.length);
    // List of individual contact domains that should be normalized
    const contactDomains = ['@lid', '@s.whatsapp.net', '@c.us'];
    if (!contactDomains.some(domain => currentDomain.startsWith(domain))) {
        // Unknown domain, return as-is
        return jid;
    }
    // Normalize to standard format
    const standardDomain = preferLegacyFormat ? '@c.us' : '@s.whatsapp.net';
    return `${phoneNumber}${standardDomain}`;
}
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
function areJidsEqual(jid1, jid2) {
    if (!jid1 || !jid2) {
        return jid1 === jid2;
    }
    // Normalize both and compare
    return normalizeJid(jid1) === normalizeJid(jid2);
}
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
function getJidType(jid) {
    if (!jid || typeof jid !== 'string') {
        return 'unknown';
    }
    if (jid.endsWith('@g.us')) {
        return 'group';
    }
    if (jid.endsWith('@broadcast')) {
        return 'broadcast';
    }
    if (jid.endsWith('@newsletter')) {
        return 'newsletter';
    }
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || jid.endsWith('@lid')) {
        return 'individual';
    }
    return 'unknown';
}
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
function isIndividualJid(jid) {
    return getJidType(jid) === 'individual';
}
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
function validateJid(jid) {
    if (!jid || typeof jid !== 'string') {
        return { valid: false, error: 'JID is empty or not a string' };
    }
    if (!jid.includes('@')) {
        return { valid: false, error: 'Missing @ separator' };
    }
    const [userPart, domain] = jid.split('@');
    if (!userPart || userPart.length === 0) {
        return { valid: false, error: 'User part is empty' };
    }
    if (!domain || domain.length === 0) {
        return { valid: false, error: 'Domain part is empty' };
    }
    // Check for known valid domains
    const validDomains = [
        's.whatsapp.net',
        'c.us',
        'lid',
        'g.us',
        'broadcast',
        'newsletter'
    ];
    // Remove device ID suffix if present (e.g., :0)
    const cleanDomain = domain.split(':')[0];
    if (!validDomains.includes(cleanDomain)) {
        return { valid: false, error: `Unknown domain: ${cleanDomain}` };
    }
    return { valid: true };
}
