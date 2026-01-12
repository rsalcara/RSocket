# JID Normalization - Preventing Duplicate Tickets

## 🎯 Problem Overview

When using WhatsApp with Baileys, the same contact can appear with different JID (Jabber ID) formats, causing **duplicate tickets/contacts** in customer service systems:

```
Same person, different JIDs:
  207421150646274@lid             ← Newsletter/Channel response
  207421150646274@s.whatsapp.net  ← Regular message
```

**Result**: System treats these as 2 different contacts → 2 separate tickets opened! 😢

## 📚 Background: What is @lid?

In 2023, WhatsApp introduced `@lid` (Local Identifier) to protect user privacy in large groups and newsletters. The problem:

- **Privacy**: `@lid` hides the real phone number in certain contexts
- **Mapping Issue**: There's no reliable way to convert `@lid` back to the original `@s.whatsapp.net` format
- **Duplicate Detection**: Systems can't recognize it's the same person

**Sources**:
- [Baileys Issue #1718](https://github.com/WhiskeySockets/Baileys/issues/1718) - Problem with @lid remoteJid
- [EvolutionAPI Issue #1872](https://github.com/EvolutionAPI/evolution-api/issues/1872) - Receives LID event instead of JID

## 🛠️ Solution: JID Normalization

RBaileys now provides **JID normalization utilities** that standardize all JID formats to prevent duplicates.

### Core Functions

#### 1. `normalizeJid(jid)` - Standardize JIDs

Converts all JID variations to a consistent format:

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'

normalizeJid('5511999999999@lid')              // → '5511999999999@s.whatsapp.net'
normalizeJid('5511999999999@s.whatsapp.net')   // → '5511999999999@s.whatsapp.net'
normalizeJid('5511999999999@c.us')             // → '5511999999999@s.whatsapp.net'
normalizeJid('120363XXX@g.us')                 // → '120363XXX@g.us' (preserved)
```

**Rule**: Individual contacts → `@s.whatsapp.net`, Groups/Broadcasts → preserved as-is

#### 2. `areJidsEqual(jid1, jid2)` - Compare JIDs

Check if two JIDs represent the same contact:

```typescript
import { areJidsEqual } from '@whiskeysockets/baileys'

areJidsEqual('5511999999999@lid', '5511999999999@s.whatsapp.net')  // → true ✅
areJidsEqual('5511999999999@lid', '5511888888888@lid')             // → false
```

#### 3. `extractPhoneNumber(jid)` - Get Phone Number

Extract just the phone number, regardless of domain:

```typescript
import { extractPhoneNumber } from '@whiskeysockets/baileys'

extractPhoneNumber('5511999999999@lid')              // → '5511999999999'
extractPhoneNumber('5511999999999@s.whatsapp.net')   // → '5511999999999'
```

#### 4. `getJidType(jid)` - Identify JID Type

Determine the type of JID:

```typescript
import { getJidType } from '@whiskeysockets/baileys'

getJidType('5511999999999@s.whatsapp.net')  // → 'individual'
getJidType('5511999999999@lid')              // → 'individual'
getJidType('120363XXX@g.us')                 // → 'group'
getJidType('status@broadcast')                // → 'broadcast'
getJidType('120363XXX@newsletter')           // → 'newsletter'
```

#### 5. `isIndividualJid(jid)` - Check if Individual

Quick check for individual contacts:

```typescript
import { isIndividualJid } from '@whiskeysockets/baileys'

isIndividualJid('5511999999999@lid')     // → true
isIndividualJid('120363XXX@g.us')        // → false
```

#### 6. `validateJid(jid)` - Validate Format

Validate JID format and get detailed errors:

```typescript
import { validateJid } from '@whiskeysockets/baileys'

validateJid('5511999999999@s.whatsapp.net')
// → { valid: true }

validateJid('invalid')
// → { valid: false, error: 'Missing @ separator' }

validateJid('')
// → { valid: false, error: 'JID is empty' }
```

## 🔧 Integration Guide

### For Ticket Systems (Whaticket, Z-PRO, etc.)

**Problem**: Creating duplicate tickets for the same contact

**Solution**: Normalize JIDs before creating/searching tickets

#### Example: Ticket Creation

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'

// Before (creates duplicates):
async function createOrUpdateTicket(messageJid: string) {
  let ticket = await Ticket.findOne({ where: { contactJid: messageJid } })
  if (!ticket) {
    ticket = await Ticket.create({ contactJid: messageJid })
  }
  return ticket
}

// After (prevents duplicates):
async function createOrUpdateTicket(messageJid: string) {
  const normalizedJid = normalizeJid(messageJid)  // ← ADD THIS

  let ticket = await Ticket.findOne({ where: { contactJid: normalizedJid } })
  if (!ticket) {
    ticket = await Ticket.create({ contactJid: normalizedJid })
  }
  return ticket
}
```

#### Example: Contact Deduplication

```typescript
import { normalizeJid, extractPhoneNumber } from '@whiskeysockets/baileys'

// Normalize all existing contacts (run once):
async function deduplicateContacts() {
  const contacts = await Contact.findAll()

  for (const contact of contacts) {
    const normalized = normalizeJid(contact.jid)

    if (contact.jid !== normalized) {
      // Check if normalized version already exists
      const existing = await Contact.findOne({ where: { jid: normalized } })

      if (existing) {
        // Merge tickets from old contact to existing
        await Ticket.update(
          { contactId: existing.id },
          { where: { contactId: contact.id } }
        )
        // Delete duplicate contact
        await contact.destroy()
        console.log(`Merged duplicate: ${contact.jid} → ${normalized}`)
      } else {
        // Just update the JID
        contact.jid = normalized
        await contact.save()
        console.log(`Normalized: ${contact.jid} → ${normalized}`)
      }
    }
  }
}
```

#### Example: Message Handler

```typescript
import { normalizeJid, isIndividualJid, getJidType } from '@whiskeysockets/baileys'

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const messageJid = msg.key.remoteJid

    // Skip non-individual messages
    if (!isIndividualJid(messageJid)) {
      console.log(`Skipping ${getJidType(messageJid)} message: ${messageJid}`)
      continue
    }

    // Normalize before processing
    const contactJid = normalizeJid(messageJid)

    // Find or create contact with normalized JID
    const contact = await findOrCreateContact(contactJid)

    // Find or create ticket with normalized JID
    const ticket = await findOrCreateTicket(contactJid, contact.id)

    // Process message...
    await handleMessage(msg, ticket)
  }
})
```

### Database Migration Script

If you already have duplicate contacts/tickets, run this migration:

```typescript
import { normalizeJid, areJidsEqual } from '@whiskeysockets/baileys'

async function migrateExistingData() {
  console.log('🔄 Starting JID normalization migration...')

  // 1. Normalize all contacts
  const contacts = await Contact.findAll()
  const contactMap = new Map<string, number>() // normalized JID → primary contact ID

  for (const contact of contacts) {
    const normalized = normalizeJid(contact.jid)

    if (contactMap.has(normalized)) {
      // Duplicate found
      const primaryId = contactMap.get(normalized)!

      // Transfer all tickets to primary contact
      await Ticket.update(
        { contactId: primaryId },
        { where: { contactId: contact.id } }
      )

      // Transfer all messages to primary contact
      await Message.update(
        { contactId: primaryId },
        { where: { contactId: contact.id } }
      )

      // Delete duplicate
      await contact.destroy()
      console.log(`✅ Merged duplicate contact: ${contact.jid} → ${normalized}`)
    } else {
      // First occurrence - update JID and mark as primary
      if (contact.jid !== normalized) {
        contact.jid = normalized
        await contact.save()
        console.log(`📝 Normalized contact: ${contact.jid} → ${normalized}`)
      }
      contactMap.set(normalized, contact.id)
    }
  }

  // 2. Normalize all tickets
  const tickets = await Ticket.findAll()

  for (const ticket of tickets) {
    if (ticket.contactJid) {
      const normalized = normalizeJid(ticket.contactJid)
      if (ticket.contactJid !== normalized) {
        ticket.contactJid = normalized
        await ticket.save()
        console.log(`🎫 Normalized ticket JID: ${ticket.id}`)
      }
    }
  }

  console.log('✅ Migration completed!')
}
```

### Real-Time Prevention

Add JID normalization to your message handler:

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'

// Middleware to normalize all incoming JIDs
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    // Normalize remoteJid before any processing
    if (msg.key.remoteJid) {
      msg.key.remoteJid = normalizeJid(msg.key.remoteJid)
    }

    // Normalize participant (for group messages)
    if (msg.key.participant) {
      msg.key.participant = normalizeJid(msg.key.participant)
    }

    // Now process normally - all JIDs are normalized
    await yourMessageHandler(msg)
  }
})
```

## 📊 Expected Results

### Before Normalization
```
Contacts Table:
  ID  | JID                              | Name
  ----+----------------------------------+---------
  1   | 207421150646274@s.whatsapp.net  | Renato
  2   | 207421150646274@lid              | Renato  ← DUPLICATE!

Tickets Table:
  ID  | Contact ID | Status  | Messages
  ----+------------+---------+----------
  #16 | 1          | ABERTO  | "Olá"
  #17 | 2          | ABERTO  | "Oi"     ← DUPLICATE TICKET!
```

### After Normalization
```
Contacts Table:
  ID  | JID                              | Name
  ----+----------------------------------+---------
  1   | 207421150646274@s.whatsapp.net  | Renato  ✅ ÚNICO

Tickets Table:
  ID  | Contact ID | Status     | Messages
  ----+------------+------------+----------
  #16 | 1          | RESOLVIDO  | "Olá"
  #17 | 1          | RESOLVIDO  | "Oi"     ✅ MESMO CONTATO
```

## 🔍 Identifying the Problem

Check your logs for this pattern:

```
warn: CheckIsValidContact 2 | invalidNumber, trying @lid
[BAILEYS] 📤 Message sent: 3EB00AB → 207421150646274@lid
```

If you see `@lid` in your logs and have duplicate tickets, you need JID normalization! ✅

## 🚀 Quick Fix for Z-PRO / Whaticket

### Step 1: Update Baileys

```bash
npm install @whiskeysockets/baileys@git+ssh://git@github.com/rsalcara/RSocket.git#main --save
```

### Step 2: Add Normalization to Contact Service

Find your contact service file (usually `backend/src/services/ContactService.ts` or similar):

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'

// Update all contact lookups:
const findOrCreateContact = async (jid: string, name?: string) => {
  const normalizedJid = normalizeJid(jid)  // ← ADD THIS LINE

  let contact = await Contact.findOne({ where: { jid: normalizedJid } })

  if (!contact) {
    contact = await Contact.create({ jid: normalizedJid, name })
  }

  return contact
}
```

### Step 3: Add Normalization to Ticket Service

Find your ticket service file:

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'

const createOrUpdateTicket = async (contactJid: string, queueId?: number) => {
  const normalizedJid = normalizeJid(contactJid)  // ← ADD THIS LINE

  let ticket = await Ticket.findOne({
    where: {
      contactJid: normalizedJid,
      status: ['open', 'pending']
    }
  })

  if (!ticket) {
    ticket = await Ticket.create({
      contactJid: normalizedJid,
      queueId,
      status: 'open'
    })
  }

  return ticket
}
```

### Step 4: Run Migration (Optional)

If you already have duplicates, create and run `scripts/migrate-jids.ts`:

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'
import Contact from '../models/Contact'
import Ticket from '../models/Ticket'
import Message from '../models/Message'

async function migrate() {
  // ... (use migration script from above)
}

migrate()
  .then(() => console.log('✅ Migration complete'))
  .catch(err => console.error('❌ Migration failed:', err))
```

### Step 5: Restart Application

```bash
pm2 restart zpro-backend
pm2 logs zpro-backend --lines 50
```

## ⚠️ Important Notes

### 1. Groups vs Individual Contacts

JID normalization only affects **individual contacts**. Groups, broadcasts, and newsletters are **preserved**:

```typescript
normalizeJid('120363XXX@g.us')       // → '120363XXX@g.us' (unchanged)
normalizeJid('status@broadcast')      // → 'status@broadcast' (unchanged)
normalizeJid('120363XXX@newsletter')  // → '120363XXX@newsletter' (unchanged)
```

### 2. Database Constraints

If your database has unique constraints on `jid`, the migration script will handle duplicates by merging them. Make sure you have backups before running migrations!

### 3. Performance

JID normalization is **O(1)** and has minimal performance impact:
- String split operations
- Simple comparisons
- No external API calls
- No database queries

### 4. Backward Compatibility

The normalization functions are **non-breaking**:
- If you pass an already-normalized JID, it returns unchanged
- If you pass an invalid JID, it returns as-is (doesn't throw)
- Works with all WhatsApp JID formats (including legacy `@c.us`)

## 🧪 Testing

### Unit Tests

```typescript
import { normalizeJid, areJidsEqual, extractPhoneNumber } from '@whiskeysockets/baileys'

describe('JID Normalization', () => {
  test('normalizes @lid to @s.whatsapp.net', () => {
    expect(normalizeJid('5511999999999@lid')).toBe('5511999999999@s.whatsapp.net')
  })

  test('preserves group JIDs', () => {
    expect(normalizeJid('120363XXX@g.us')).toBe('120363XXX@g.us')
  })

  test('compares different formats correctly', () => {
    expect(areJidsEqual('5511999999999@lid', '5511999999999@s.whatsapp.net')).toBe(true)
  })

  test('extracts phone number from any format', () => {
    expect(extractPhoneNumber('5511999999999@lid')).toBe('5511999999999')
    expect(extractPhoneNumber('5511999999999@s.whatsapp.net')).toBe('5511999999999')
  })
})
```

### Integration Test

```typescript
// Test with real Baileys instance
const sock = makeWASocket({ ... })

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const jid = msg.key.remoteJid
    console.log(`Original JID: ${jid}`)
    console.log(`Normalized JID: ${normalizeJid(jid)}`)
    console.log(`Type: ${getJidType(jid)}`)
  }
})
```

## 📖 Related Documentation

- [Baileys Issue #1718 - @lid Problem](https://github.com/WhiskeySockets/Baileys/issues/1718)
- [EvolutionAPI Issue #1872 - LID Events](https://github.com/EvolutionAPI/evolution-api/issues/1872)
- [WhatsApp LID Update Documentation](https://developers.facebook.com/docs/whatsapp/)
- [Z-PRO Documentation](https://zpro.passaportezdg.com.br/)
- [Whaticket Community](https://github.com/canove/whaticket-community)

## 🆘 Troubleshooting

### Problem: Still seeing duplicate tickets after normalization

**Solution**: Run the database migration script to clean up existing duplicates. New normalization only affects new messages.

### Problem: Error "Cannot find module jid-utils"

**Solution**: Make sure you're using the latest version of RBaileys:
```bash
npm install @whiskeysockets/baileys@git+ssh://git@github.com/rsalcara/RSocket.git#main
```

### Problem: Groups showing as individual contacts

**Check**: Make sure you're using `isIndividualJid()` to filter:
```typescript
if (isIndividualJid(jid)) {
  // Handle individual contact
} else {
  // Handle group/broadcast
}
```

### Problem: Normalized JIDs not matching database

**Cause**: Database might have mixed formats

**Solution**: Run migration script to standardize existing data

## 💡 Best Practices

1. **Always normalize on input**: Normalize JIDs as soon as you receive them
2. **Store normalized format**: Always store `@s.whatsapp.net` format in database
3. **Use comparison functions**: Use `areJidsEqual()` instead of `===` for comparing JIDs
4. **Validate before processing**: Use `validateJid()` to catch malformed JIDs early
5. **Backup before migration**: Always backup database before running migration scripts
6. **Test with small dataset**: Test migration on a small subset first
7. **Monitor logs**: Watch for `@lid` patterns in logs to identify affected contacts

## 📦 Summary

| Function | Purpose | Example |
|----------|---------|---------|
| `normalizeJid()` | Standardize JID format | `@lid` → `@s.whatsapp.net` |
| `areJidsEqual()` | Compare JIDs safely | Returns `true` for same contact |
| `extractPhoneNumber()` | Get phone number | Remove domain suffix |
| `getJidType()` | Identify JID type | `'individual'`, `'group'`, etc. |
| `isIndividualJid()` | Check if individual | Filter out groups/broadcasts |
| `validateJid()` | Validate format | Catch malformed JIDs |

🎉 **Result**: No more duplicate tickets from the same contact!

---

**Need Help?**

- [RBaileys Issues](https://github.com/rsalcara/RSocket/issues)
- [Baileys Community](https://github.com/WhiskeySockets/Baileys/discussions)
- [Z-PRO Support](https://zpro.passaportezdg.com.br/)
