# Environment Variables Reference

Complete reference for all RBaileys environment variables and configuration options.

## 📋 Quick Reference

### Core Logging Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BAILEYS_LOG` | boolean | `true` | Enable/disable all Baileys logging |
| `USE_STRUCTURED_LOGS` | boolean | `false` | Enable Pino structured JSON logging |
| `BAILEYS_LOG_LEVEL` | string | `info` | Minimum log level: trace\|debug\|info\|warn\|error\|fatal |
| `LOG_LEVEL` | string | `info` | Global log level (fallback for BAILEYS_LOG_LEVEL) |
| `LOG_FORMAT` | string | `json` | Output format: json\|pretty |

### Event Buffer Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BAILEYS_BUFFER_MAX_CACHE` | number | `10000` | Maximum items in history cache before LRU cleanup |
| `BAILEYS_BUFFER_MAX_ITEMS` | number | `1000` | Maximum items in buffer before force flush |
| `BAILEYS_BUFFER_TIMEOUT_MS` | number | `5000` | Auto-flush timeout in milliseconds |
| `BAILEYS_BUFFER_AUTO_FLUSH` | boolean | `true` | Enable automatic timeout-based flushing |

### Legacy Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BAILEYS_OPT` | boolean | `false` | Legacy optimization flag (deprecated, no effect) |
| `LOGGER_INFO` | boolean | `true` | Enable info logs (legacy, prefer BAILEYS_LOG_LEVEL) |
| `LOGGER_WARN` | boolean | `true` | Enable warning logs (legacy) |
| `LOGGER_ERROR` | boolean | `true` | Enable error logs (legacy) |
| `LOGGER_DEBUG` | boolean | `false` | Enable debug logs (legacy) |

---

## 🎯 Configuration Scenarios

### Scenario 1: Production (Recommended)

**Optimal for production environments with structured logging and APM integration.**

```bash
BAILEYS_LOG=true
USE_STRUCTURED_LOGS=true
BAILEYS_LOG_LEVEL=info
LOG_FORMAT=json
```

**Output:**
```json
{"level":30,"time":1736653200,"component":"baileys","event":"open","msg":"✅ Connected to WhatsApp successfully"}
```

**Benefits:**
- ✅ Structured JSON logs (queryable)
- ✅ APM-ready (Datadog, New Relic, Elastic)
- ✅ Optimal performance (async I/O)
- ✅ Production-grade observability

---

### Scenario 2: Development (Readable)

**Pretty-printed logs for local development and debugging.**

```bash
BAILEYS_LOG=true
USE_STRUCTURED_LOGS=true
BAILEYS_LOG_LEVEL=debug
LOG_FORMAT=pretty
```

**Output:**
```
[2026-01-12 10:30:45] INFO (baileys): ✅ Connected to WhatsApp successfully
  component: "baileys"
  event: "open"
```

**Benefits:**
- ✅ Human-readable colored output
- ✅ Detailed debug information
- ✅ Easy to follow in terminal

---

### Scenario 3: Legacy (Console.log)

**Backward compatible with existing setups.**

```bash
BAILEYS_LOG=true
# USE_STRUCTURED_LOGS not set or false
```

**Output:**
```
[BAILEYS] ✅ Connected to WhatsApp successfully
[BAILEYS] 📤 Message sent: 3EB0... → 5515...
```

**Benefits:**
- ✅ No changes needed
- ✅ Simple text output
- ✅ Works everywhere

---

### Scenario 4: Disabled (Silent)

**No logging output.**

```bash
BAILEYS_LOG=false
```

**Use when:**
- Testing without noise
- Embedded systems with limited I/O
- Custom logging implementation

---

## 🔧 Checking Your Configuration

### Using the Config Checker

```bash
# Check current configuration
npm run config:check

# Example output:
🔍 BAILEYS CONFIGURATION CHECKER

System Information:
● Node.js Version:      v20.0.0
● AsyncLocalStorage:    Available ✓

Core Logging Configuration:
● BAILEYS_LOG              true
● USE_STRUCTURED_LOGS      true
○ BAILEYS_LOG_LEVEL        info            (default)

Configuration Analysis:
✓ Structured logging ENABLED
  Format: json, Level: info
```

---

## 📊 Log Levels Explained

### Available Levels (from most to least verbose)

| Level | Numeric | When to Use | Example |
|-------|---------|-------------|---------|
| `trace` | 10 | Very detailed debugging | Function entry/exit |
| `debug` | 20 | Detailed debugging | Variable values, flow |
| `info` | 30 | **Production default** | Important events |
| `warn` | 40 | Potential issues | Deprecated features |
| `error` | 50 | Errors | Exceptions, failures |
| `fatal` | 60 | Critical failures | App crash |

### Choosing the Right Level

**Development:**
```bash
BAILEYS_LOG_LEVEL=debug  # See detailed information
```

**Staging:**
```bash
BAILEYS_LOG_LEVEL=info   # Important events only
```

**Production:**
```bash
BAILEYS_LOG_LEVEL=info   # Standard (recommended)
# or
BAILEYS_LOG_LEVEL=warn   # Quieter (only issues)
```

---

## 🎨 Output Formats

### JSON Format (Production)

```bash
LOG_FORMAT=json
```

**Output:**
```json
{"level":30,"time":1736653200,"component":"baileys","messageId":"3EB0...","msg":"Message sent"}
```

**Advantages:**
- ✅ Machine-readable
- ✅ Easy to parse/query
- ✅ APM integration
- ✅ Structured data

**Best for:**
- Production environments
- Log aggregation systems
- Automated analysis

---

### Pretty Format (Development)

```bash
LOG_FORMAT=pretty
```

**Output:**
```
[2026-01-12 10:30:45] INFO (baileys):
  component: "baileys"
  messageId: "3EB0..."
  msg: "Message sent"
```

**Advantages:**
- ✅ Human-readable
- ✅ Colored output
- ✅ Indented structure
- ✅ Easy debugging

**Best for:**
- Local development
- Terminal debugging
- Log review

---

## 🔍 Environment Variable Priority

When multiple variables are set, RBaileys uses this priority:

### Log Level Priority

1. `BAILEYS_LOG_LEVEL` (most specific)
2. `LOG_LEVEL` (global fallback)
3. `info` (default)

**Example:**
```bash
LOG_LEVEL=debug
BAILEYS_LOG_LEVEL=warn  # This wins
# Result: warn level used
```

### Logging Mode Priority

1. `USE_STRUCTURED_LOGS=true` → Pino structured logging
2. `USE_STRUCTURED_LOGS=false` or not set → console.log
3. `BAILEYS_LOG=false` → No logging

---

## 🚀 Migration Guide

### From Console.log to Structured Logging

**Step 1: Enable (No Breaking Changes)**
```bash
# Add to .env
USE_STRUCTURED_LOGS=true
```

**Step 2: Restart Application**
```bash
# Your restart command
pm2 restart app
# or
systemctl restart app
# or
docker-compose restart
```

**Step 3: Verify**
```bash
# Check logs are now JSON
tail -f logs/app.log
# Should see: {"level":30,"time":...}
```

**Step 4: Optimize (Optional)**
```bash
# Production settings
BAILEYS_LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 📦 Framework-Specific Setup

### Express.js

```javascript
// app.js
require('dotenv').config()

import makeWASocket from '@whiskeysockets/baileys'
import pino from 'pino'

// Create app logger
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

// Create socket with structured logging
const sock = makeWASocket({
  auth: state,
  logger: logger.child({ component: 'whatsapp' })
})
```

### NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true
    })
  ]
})
export class AppModule {}
```

### Docker

```dockerfile
# Dockerfile
FROM node:20

# Set environment variables
ENV BAILEYS_LOG=true \
    USE_STRUCTURED_LOGS=true \
    BAILEYS_LOG_LEVEL=info \
    LOG_FORMAT=json

# ... rest of Dockerfile
```

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - BAILEYS_LOG=true
      - USE_STRUCTURED_LOGS=true
      - BAILEYS_LOG_LEVEL=info
      - LOG_FORMAT=json
```

---

## 🐛 Troubleshooting

### Problem: No logs appearing

**Check:**
```bash
# Is logging enabled?
echo $BAILEYS_LOG  # Should be 'true' or empty

# Run config checker
npm run config:check
```

**Solution:**
```bash
BAILEYS_LOG=true
```

---

### Problem: Too many logs

**Check:**
```bash
echo $BAILEYS_LOG_LEVEL  # Might be 'debug' or 'trace'
```

**Solution:**
```bash
BAILEYS_LOG_LEVEL=info  # or 'warn'
```

---

### Problem: Logs not in JSON format

**Check:**
```bash
echo $USE_STRUCTURED_LOGS  # Should be 'true'
echo $LOG_FORMAT  # Should be 'json'
```

**Solution:**
```bash
USE_STRUCTURED_LOGS=true
LOG_FORMAT=json
```

---

### Problem: AsyncLocalStorage errors

**Check Node.js version:**
```bash
node --version  # Should be ≥20.0.0
```

**Solution:**
```bash
# Upgrade Node.js
nvm install 20
nvm use 20
```

---

## 📚 See Also

- [Logging & Tracing Guide](LOGGING_AND_TRACING.md) - Complete guide with examples
- [Retry Configuration](RETRY_CONFIGURATION.md) - Retry backoff settings
- [Release Process](RELEASE_PROCESS.md) - CI/CD and release workflow

---

## 🆘 Support

- **Config Checker:** Run `npm run config:check` for instant validation
- **Issues:** https://github.com/rsalcara/RSocket/issues
- **Documentation:** All docs in `docs/` folder
