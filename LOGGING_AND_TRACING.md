# Structured Logging & Distributed Tracing Guide

## 📋 Overview

RBaileys now includes modern, production-ready **structured logging** and **distributed tracing** capabilities powered by:

- **Pino** - High-performance JSON logger (async, non-blocking)
- **AsyncLocalStorage** - Automatic correlation ID propagation
- **Backward compatible** - Existing code continues to work unchanged

## 🎯 **Why Upgrade?**

### Problems with console.log

| Issue | Impact | Example |
|-------|--------|---------|
| **Not Structured** | Can't query/parse logs | `console.log('User sent message:', msgId)` |
| **No Log Levels** | Can't filter debug vs error | All logs treated equally |
| **Blocks Event Loop** | Performance degradation | Synchronous I/O during logs |
| **No Correlation** | Can't trace async flows | Logs are disconnected |
| **APM Incompatible** | No Datadog/NewRelic integration | Manual log parsing required |

### Benefits of Structured Logging

| Feature | Benefit | Example Output |
|---------|---------|----------------|
| **JSON Format** | Queryable, parseable | `{"level":30,"msg":"Message sent","messageId":"123"}` |
| **Log Levels** | Filter by severity | `debug`, `info`, `warn`, `error` |
| **Async Logging** | Non-blocking | Doesn't slow down app |
| **Correlation IDs** | End-to-end tracing | All logs for same message share `traceId` |
| **APM Ready** | Direct integration | Datadog, New Relic, Elastic work out of box |

---

## 🚀 **Quick Start**

### Enable Structured Logging (Zero Code Changes)

```bash
# In .env or environment
USE_STRUCTURED_LOGS=true
BAILEYS_LOG=true
BAILEYS_LOG_LEVEL=info
```

That's it! All existing `baileys-logger` functions now output structured JSON logs.

---

## 📚 **Complete Guide**

### 1. Basic Structured Logging

#### Option A: Using Adapter (Easiest - Backward Compatible)

```typescript
import { legacyLoggerAdapter } from '@whiskeysockets/baileys'

// Existing code works unchanged
legacyLoggerAdapter.logConnection('open', 'my-session')
// Output (if USE_STRUCTURED_LOGS=true):
// {"level":30,"time":1234567890,"component":"baileys","event":"open","sessionName":"my-session","msg":"✅ Connected to WhatsApp successfully"}
```

#### Option B: Using Structured Logger Directly (Recommended for New Code)

```typescript
import pino from 'pino'
import { createBaileysLogger } from '@whiskeysockets/baileys'

const baseLogger = pino({ level: 'info' })
const logger = createBaileysLogger({ baseLogger })

logger.logConnection('open', { sessionName: 'my-session' })
logger.logMessage('sent', { messageId: '123', to: 'user@s.whatsapp.net' })
logger.logError('send_message', new Error('Network timeout'), { messageId: '123' })
```

---

### 2. Distributed Tracing with Correlation IDs

Track messages through entire async pipeline with automatic context propagation.

#### Basic Trace

```typescript
import { withTrace, getTraceContext } from '@whiskeysockets/baileys'

// Start trace for message processing
await withTrace(
  {
    operation: 'process_message',
    messageId: msg.key.id,
    jid: msg.key.remoteJid
  },
  async () => {
    await decryptMessage(msg)
    // All async operations inside share same trace context
    await saveToDatabase(msg)
    await sendAck(msg)
  }
)

// Inside any nested function, get trace context
function decryptMessage(msg) {
  const ctx = getTraceContext()
  logger.info({ ...ctx, action: 'decrypt' }, 'Decrypting message')
  // Output includes: traceId, messageId, jid, operation automatically
}
```

#### Nested Traces (Parent-Child Relationship)

```typescript
await withTrace({ operation: 'handle_webhook' }, async () => {
  // Parent trace

  await withTrace({ operation: 'decrypt_message' }, async () => {
    // Child trace - has parentTraceId pointing to parent
    await decryptMessage()
  })

  await withTrace({ operation: 'store_message' }, async () => {
    // Another child trace
    await storeMessage()
  })
})

// Output:
// Parent: { traceId: "abc-123", operation: "handle_webhook" }
// Child 1: { traceId: "def-456", parentTraceId: "abc-123", operation: "decrypt_message" }
// Child 2: { traceId: "ghi-789", parentTraceId: "abc-123", operation: "store_message" }
```

---

### 3. Integration Examples

#### With Express/HTTP Servers

```typescript
import express from 'express'
import { withTrace, extractTraceIdFromHeaders } from '@whiskeysockets/baileys'

app.use(async (req, res, next) => {
  // Extract trace ID from incoming request (if exists)
  const traceId = extractTraceIdFromHeaders(req.headers)

  // Wrap request handling in trace context
  await withTrace(
    {
      traceId, // Reuse if exists, generate if not
      operation: 'http_request',
      metadata: {
        method: req.method,
        path: req.path,
        ip: req.ip
      }
    },
    async () => {
      next()
    }
  )
})

// Now all logs in request handlers include trace ID
app.post('/send-message', async (req, res) => {
  const ctx = getTraceContext()
  logger.info({ ...ctx, body: req.body }, 'Sending message')
  // Output: { traceId: "...", operation: "http_request", method: "POST", ... }
})
```

#### With Baileys Socket

```typescript
import makeWASocket from '@whiskeysockets/baileys'
import pino from 'pino'
import { createBaileysLogger, withTrace } from '@whiskeysockets/baileys'

// Create structured logger
const baseLogger = pino({ level: 'info' })
const logger = createBaileysLogger({ baseLogger })

const sock = makeWASocket({
  auth: state,
  // Use regular Pino logger for socket internals
  logger: baseLogger
})

// Wrap message handlers in trace context
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    await withTrace(
      {
        operation: 'message_received',
        messageId: msg.key.id,
        jid: msg.key.remoteJid,
        socketId: sock.user?.id
      },
      async () => {
        logger.logMessage('received', {
          messageId: msg.key.id,
          from: msg.key.remoteJid
        })
        await processMessage(msg)
      }
    )
  }
})
```

---

### 4. Multi-Tenant Tracing

Track operations per tenant in multi-tenant environments.

```typescript
const tenants = ['tenant-1', 'tenant-2', 'tenant-3']

for (const tenantId of tenants) {
  await withTrace(
    {
      operation: 'process_tenant_messages',
      tenantId,
      socketId: getSockForTenant(tenantId).user?.id
    },
    async () => {
      const messages = await fetchMessages(tenantId)
      for (const msg of messages) {
        // Each message has own trace, but all share tenantId
        await withTrace(
          { operation: 'process_message', messageId: msg.id },
          async () => {
            await processMessage(msg)
          }
        )
      }
    }
  )
}

// Logs are queryable by tenantId:
// { traceId: "...", tenantId: "tenant-1", operation: "process_message", ... }
```

---

### 5. Performance Timing

Measure operation duration with automatic trace metadata.

```typescript
import { withTrace, timeOperation } from '@whiskeysockets/baileys'

await withTrace({ operation: 'send_message' }, async () => {
  // Time specific operations
  const [encrypted, encryptDuration] = await timeOperation('encrypt', async () => {
    return await encryptMessage(msg)
  })

  const [sent, sendDuration] = await timeOperation('send', async () => {
    return await sendToWhatsApp(encrypted)
  })

  logger.info({
    encryptDuration,
    sendDuration,
    totalDuration: encryptDuration + sendDuration
  }, 'Message sent with timing')

  // Trace context automatically includes:
  // { encrypt_duration_ms: 15, send_duration_ms: 230 }
})
```

---

## 🔧 **Configuration**

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `USE_STRUCTURED_LOGS` | `true|false` | `false` | Enable Pino backend |
| `BAILEYS_LOG` | `true|false` | `true` | Enable Baileys logs |
| `BAILEYS_LOG_LEVEL` | `trace|debug|info|warn|error|fatal` | `info` | Minimum log level |
| `LOG_FORMAT` | `json|pretty` | `json` | Output format |

### Programmatic Configuration

```typescript
import pino from 'pino'
import { setStructuredLogger } from '@whiskeysockets/baileys'

// Custom Pino configuration
const logger = pino({
  level: 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  // Send logs to Datadog
  transport: {
    target: 'pino-datadog',
    options: {
      apiKey: process.env.DATADOG_API_KEY,
      service: 'baileys-app',
      source: 'nodejs'
    }
  }
})

// Use this logger for all Baileys logging
setStructuredLogger(logger)
```

---

## 📊 **APM Integration**

### Datadog

```typescript
import pino from 'pino'

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-datadog',
    options: {
      apiKey: process.env.DD_API_KEY,
      service: 'whatsapp-service',
      source: 'nodejs',
      tags: ['env:production', 'version:1.0.0']
    }
  }
})
```

Query logs in Datadog:
```
service:whatsapp-service operation:send_message status:error
```

### New Relic

```typescript
import pino from 'pino'
import pinoNewRelic from 'pino-new-relic'

const logger = pino({
  transport: pinoNewRelic({
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    appName: 'WhatsApp Service'
  })
})
```

### Elastic (ELK Stack)

```typescript
import pino from 'pino'
import pinoElastic from 'pino-elasticsearch'

const logger = pino({
  transport: pinoElastic({
    node: process.env.ELASTICSEARCH_URL,
    index: 'baileys-logs'
  })
})
```

Query in Kibana:
```
traceId:"abc-123" AND operation:"process_message"
```

---

## 🔍 **Troubleshooting & Debugging**

### Finding All Logs for a Specific Message

```bash
# With structured logs (easy)
grep '"messageId":"3EB06B3D4677CD1BDBBC64"' logs.json | jq

# Output: All operations for that message
{
  "traceId": "abc-123",
  "messageId": "3EB06B3D...",
  "operation": "decrypt",
  "msg": "Decrypting message"
}
{
  "traceId": "abc-123",
  "messageId": "3EB06B3D...",
  "operation": "store",
  "msg": "Storing message"
}
```

### Tracing Async Operations

```typescript
// Problem: Lost context in setTimeout/Promise chains
setTimeout(() => {
  logger.info('Delayed operation')
  // ❌ Trace context is lost!
}, 1000)

// Solution: Wrap in withTrace
await withTrace({ operation: 'parent' }, async () => {
  setTimeout(() => {
    const ctx = getTraceContext()
    logger.info({ ...ctx }, 'Delayed operation')
    // ✅ Trace context preserved!
  }, 1000)
})
```

### Performance Impact

Structured logging is **async and non-blocking**:

| Method | Time | Blocks? |
|--------|------|---------|
| `console.log()` | ~1-5ms | ✅ Yes (sync I/O) |
| `logger.info()` | ~0.1-0.5ms | ❌ No (async) |

**Result:** 10x faster + doesn't block event loop

---

## 📈 **Migration Path**

### Phase 1: Enable (Immediate - No Code Changes)

```bash
# .env
USE_STRUCTURED_LOGS=true
BAILEYS_LOG=true
```

**Result:** Existing console.log calls now output JSON

### Phase 2: Adopt Tracing (Incremental - High Value)

Add trace context to critical paths:

```typescript
// Before
async function sendMessage(msg) {
  logger.logMessage('sent', { messageId: msg.id })
  await send(msg)
}

// After
async function sendMessage(msg) {
  await withTrace(
    { operation: 'send_message', messageId: msg.id },
    async () => {
      logger.logMessage('sent', { messageId: msg.id })
      await send(msg)
    }
  )
}
```

**Impact:** End-to-end tracing for critical operations

### Phase 3: Full Migration (Long-term)

Replace direct logger imports:

```typescript
// Before
import { logMessage } from '@whiskeysockets/baileys/Utils/baileys-logger'

// After
import { createBaileysLogger } from '@whiskeysockets/baileys'
const logger = createBaileysLogger({ baseLogger: pino() })
```

---

## 🎯 **Best Practices**

### ✅ DO

- Use structured logging for all new code
- Add trace context to async operations
- Include relevant metadata in logs
- Use appropriate log levels (debug vs error)
- Query logs by traceId for debugging

### ❌ DON'T

- Use console.log in new code
- Log sensitive data (passwords, tokens, etc.)
- Over-log (trace level in production)
- Forget to add trace context in async chains

---

## 📚 **API Reference**

See inline documentation in:
- `src/Utils/trace-context.ts` - Tracing API
- `src/Utils/structured-logger.ts` - Structured logging API
- `src/Utils/logger-adapter.ts` - Migration adapter

---

## 🆘 **Support**

- **Issues:** https://github.com/rsalcara/RSocket/issues
- **Docs:** This file + inline JSDoc comments
- **Examples:** See examples above

---

## 📊 **Summary**

| Feature | Before | After |
|---------|--------|-------|
| Log Format | Plain text | JSON (structured) |
| Performance | Blocking (sync) | Non-blocking (async) |
| Correlation | Manual | Automatic (traceId) |
| APM Integration | Manual parsing | Native support |
| Querying | grep/awk | jq / Datadog / Kibana |
| Async Tracking | Lost context | Preserved automatically |

**Upgrade today for better observability and easier debugging!** 🚀
