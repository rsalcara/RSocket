# RBaileys Documentation

Complete documentation for RBaileys - Enhanced Baileys WhatsApp library with production-grade features.

## 📚 Documentation Index

### Core Features

#### [Logging & Tracing](LOGGING_AND_TRACING.md)
**Production-grade structured logging and distributed tracing**

- Structured JSON logging with Pino
- Distributed tracing with AsyncLocalStorage
- Automatic correlation IDs
- APM integration (Datadog, New Relic, Elastic)
- Backward compatible with existing code

**Key Topics:**
- Quick start guide
- Trace context API
- Multi-tenant tracing
- Performance optimization
- Migration path

---

#### [Retry Configuration](RETRY_CONFIGURATION.md)
**Configurable retry backoff with exponential delays and jitter**

- Exponential backoff algorithm
- Randomized jitter to prevent thundering herd
- Configurable delays per environment
- Multi-tenant optimization

**Key Topics:**
- Why jitter matters
- Configuration options
- Scenario-specific tuning
- Troubleshooting guide

---

#### [Release Process](RELEASE_PROCESS.md)
**CI/CD validation and lib/ synchronization**

- Automated src/lib synchronization
- Pre-release validation
- GitHub Actions workflows
- Pre-commit hooks (optional)

**Key Topics:**
- 4-layer protection system
- Development workflow
- Release procedures
- Troubleshooting

---

## 🚀 Quick Start

### Installation

```bash
# From GitHub (latest)
npm install @whiskeysockets/baileys@git+ssh://git@github.com/rsalcara/RSocket.git#main

# From npm (when published)
npm install @whiskeysockets/baileys
```

### Basic Usage

```typescript
import makeWASocket from '@whiskeysockets/baileys'

const sock = makeWASocket({
  auth: state,
  // All features use safe defaults - no config needed!
})
```

### Enable Structured Logging

```bash
# In .env
USE_STRUCTURED_LOGS=true
BAILEYS_LOG_LEVEL=info
```

### Enable Retry Backoff Customization

```typescript
const sock = makeWASocket({
  auth: state,
  // Customize for your network
  retryBackoffDelays: [2000, 5000, 10000, 30000],
  retryJitterFactor: 0.25
})
```

---

## 📊 Feature Comparison

| Feature | Standard Baileys | RBaileys | Documentation |
|---------|------------------|----------|---------------|
| **Structured Logging** | ❌ console.log only | ✅ Pino JSON logs | [LOGGING_AND_TRACING.md](LOGGING_AND_TRACING.md) |
| **Distributed Tracing** | ❌ No correlation | ✅ AsyncLocalStorage | [LOGGING_AND_TRACING.md](LOGGING_AND_TRACING.md) |
| **Retry Backoff** | ⚠️ Hardcoded | ✅ Configurable + Jitter | [RETRY_CONFIGURATION.md](RETRY_CONFIGURATION.md) |
| **CI/CD Validation** | ❌ Manual | ✅ Automated | [RELEASE_PROCESS.md](RELEASE_PROCESS.md) |
| **APM Integration** | ❌ No | ✅ Native support | [LOGGING_AND_TRACING.md](LOGGING_AND_TRACING.md) |
| **Cache Limits** | ⚠️ Unbounded | ✅ Memory-safe | Core library |
| **Circuit Breaker** | ❌ No | ✅ PreKey protection | Core library |
| **Event Buffering** | ❌ Basic | ✅ Advanced | Core library |

---

## 🎯 Common Use Cases

### Use Case 1: Production Deployment

**Goal:** Maximum observability and reliability

```typescript
// Enable all production features
const sock = makeWASocket({
  auth: state,
  // Structured logging
  logger: pino({ level: 'info' }),
  // Retry optimization
  retryBackoffDelays: [1000, 2000, 5000, 10000, 20000],
  retryJitterFactor: 0.15,
  // Cache limits (prevent memory leaks)
  cacheMaxKeys: {
    userDevices: 5000,
    msgRetry: 10000
  }
})

// Enable structured logging
process.env.USE_STRUCTURED_LOGS = 'true'
```

**Documentation:**
- [Logging & Tracing Guide](LOGGING_AND_TRACING.md)
- [Retry Configuration](RETRY_CONFIGURATION.md)

---

### Use Case 2: Multi-Tenant Environment

**Goal:** Isolate logs and traces per tenant

```typescript
import { withTrace } from '@whiskeysockets/baileys'

for (const tenant of tenants) {
  const sock = makeWASocket({
    auth: await getTenantAuth(tenant.id),
    // Higher jitter for many concurrent sockets
    retryJitterFactor: 0.25
  })

  // Trace all operations per tenant
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      await withTrace(
        {
          tenantId: tenant.id,
          socketId: sock.user?.id,
          messageId: msg.key.id
        },
        async () => {
          await processMessage(msg)
        }
      )
    }
  })
}
```

**Documentation:**
- [Multi-Tenant Tracing](LOGGING_AND_TRACING.md#multi-tenant-tracing)
- [Retry for High Concurrency](RETRY_CONFIGURATION.md#multi-tenant-extremo-500-sockets)

---

### Use Case 3: Debugging Production Issues

**Goal:** Trace message flow end-to-end

```bash
# Query logs by trace ID
grep '"traceId":"abc-123-def-456"' logs.json | jq

# Query logs by message ID
grep '"messageId":"3EB06B3D4677CD1BDBBC64"' logs.json | jq

# Query errors for specific tenant
jq 'select(.level == 50 and .tenantId == "tenant-123")' logs.json
```

**Documentation:**
- [Troubleshooting Guide](LOGGING_AND_TRACING.md#troubleshooting--debugging)

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `USE_STRUCTURED_LOGS` | `true\|false` | `false` | Enable Pino logging |
| `BAILEYS_LOG` | `true\|false` | `true` | Enable Baileys logs |
| `BAILEYS_LOG_LEVEL` | `trace\|debug\|info\|warn\|error` | `info` | Log level |
| `LOG_FORMAT` | `json\|pretty` | `json` | Output format |

### Socket Configuration

```typescript
interface SocketConfig {
  // Retry configuration
  retryBackoffDelays: number[]       // Default: [1000, 2000, 5000, 10000, 20000]
  retryJitterFactor: number          // Default: 0.15
  maxMsgRetryCount: number           // Default: 5

  // Cache limits (memory leak prevention)
  cacheMaxKeys?: {
    userDevices?: number             // Default: 5000
    msgRetry?: number                // Default: 10000
    callOffer?: number               // Default: 500
    signalStore?: number             // Default: 10000
  }

  // Existing configs...
  logger: Logger
  auth: AuthenticationState
  // ... etc
}
```

---

## 📖 Additional Resources

### External Documentation

- [Original Baileys Docs](https://github.com/WhiskeySockets/Baileys)
- [Pino Logger](https://getpino.io/)
- [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)

### APM Integration Guides

- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [New Relic APM](https://docs.newrelic.com/docs/apm/)
- [Elastic APM](https://www.elastic.co/guide/en/apm/get-started/current/index.html)

---

## 🆘 Support

- **Issues:** https://github.com/rsalcara/RSocket/issues
- **Discussions:** https://github.com/rsalcara/RSocket/discussions
- **Original Baileys:** https://github.com/WhiskeySockets/Baileys

---

## 📝 Contributing

See [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for:
- Development workflow
- Release procedures
- CI/CD pipeline details

---

## 📊 Documentation Stats

| Document | Lines | Topics | Last Updated |
|----------|-------|--------|--------------|
| [LOGGING_AND_TRACING.md](LOGGING_AND_TRACING.md) | 534 | 8 | 2026-01-12 |
| [RETRY_CONFIGURATION.md](RETRY_CONFIGURATION.md) | 386 | 7 | 2026-01-12 |
| [RELEASE_PROCESS.md](RELEASE_PROCESS.md) | 386 | 9 | 2026-01-12 |
| **Total** | **1,306** | **24** | |

---

**Happy coding with RBaileys!** 🚀
