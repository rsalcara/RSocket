# Event Buffer Logging System

## 📋 Overview

Sistema completo de logging para o Event Buffer do Baileys, com dois níveis de monitoração:
- **Standard Logger** (Pino): Logs estruturados para produção
- **BAILEYS_LOG**: Logs simplificados para desenvolvimento/debug

---

## 🎯 Níveis de Log Implementados

### 1. **TRACE** - Eventos de baixo nível
```typescript
logger.trace({ buffersInProgress }, 'event buffering started')
logger.trace({
  conditionalChatUpdatesLeft,
  historyCacheSize,
  flushCount,
  forced
}, 'released buffered events')
```

**Quando aparece:**
- Início do buffering
- Cada flush de buffer (normal)

---

### 2. **DEBUG** - Informações de desenvolvimento
```typescript
logger.debug({ itemsBuffered, event }, 'buffering events')
logger.debug({ removed, remaining, maxSize }, 'cleaned history cache')
```

**Quando aparece:**
- A cada 100 itens bufferizados
- Quando o cache de histórico é limpo

---

### 3. **WARN** - Avisos importantes
```typescript
logger.warn({
  timeoutMs,
  itemsBuffered
}, 'auto-flushing buffer due to timeout')

logger.warn({
  itemsBuffered,
  maxItems,
  event
}, 'buffer overflow detected, force flushing')
```

**Quando aparece:**
- Auto-flush por timeout (5 segundos)
- Buffer overflow (> 1000 itens)

---

## 🔍 BAILEYS_LOG Logging

### Ativação
```bash
# .env file
BAILEYS_LOG=true
```

### Eventos Monitorados

#### 📦 Buffer Start
```javascript
[BAILEYS] 📦 Event buffering started
```

#### 🔄 Buffer Flush
```javascript
[BAILEYS] 🔄 Event buffer flushed {
  flushCount: 15,
  historyCacheSize: 234
}
```

#### ⏰ Buffer Timeout
```javascript
[BAILEYS] ⏰ Buffer auto-flush triggered by timeout
```

#### ⚠️  Buffer Overflow
```javascript
[BAILEYS] ⚠️  Buffer overflow detected - Force flushing {
  itemsBuffered: 1001,
  maxItems: 1000
}
```

#### 🧹 Cache Cleanup
```javascript
[BAILEYS] 🧹 History cache cleaned {
  removed: 2000,
  remaining: 8000
}
```

#### 📊 Buffer Metrics (a cada 10 flushes)
```javascript
[BAILEYS] 📊 Buffer Metrics {
  itemsBuffered: 0,
  flushCount: 10,
  historyCacheSize: 5432,
  buffersInProgress: 1
}
```

---

## 📊 Métricas Coletadas

O buffer mantém métricas em tempo real:

```typescript
bufferMetrics = {
  itemsBuffered: 0,      // Itens atualmente no buffer
  flushCount: 0,         // Total de flushes executados
  historyCacheSize: 0    // Tamanho atual do cache de histórico
}
```

---

## 🎓 Exemplos de Uso

### Monitoramento em Produção (Pino Logger)

```typescript
// Log level: trace
{
  "level": 10,
  "time": 1234567890,
  "msg": "event buffering started",
  "buffersInProgress": 1
}

// Log level: warn
{
  "level": 40,
  "time": 1234567890,
  "msg": "buffer overflow detected, force flushing",
  "itemsBuffered": 1001,
  "maxItems": 1000,
  "event": "messages.upsert"
}
```

### Debug em Desenvolvimento (BAILEYS_LOG)

```bash
# Terminal output
[BAILEYS] 📦 Event buffering started
[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 234 }
[BAILEYS] ⏰ Buffer auto-flush triggered by timeout
[BAILEYS] 📊 Buffer Metrics { itemsBuffered: 0, flushCount: 10, ... }
```

---

## 🔧 Configuração de Logs

### Ajustar Frequência de Logs

```typescript
// src/Utils/event-buffer.ts

// Log a cada X itens bufferizados
if (bufferMetrics.itemsBuffered % 100 === 0) {  // Mude 100 para outro valor
  logger.debug({ itemsBuffered, event }, 'buffering events')
}

// Log de métricas a cada X flushes
if (bufferMetrics.flushCount % 10 === 0) {  // Mude 10 para outro valor
  logBufferMetrics({ ... })
}
```

### Desabilitar BAILEYS_LOG

```bash
# .env
BAILEYS_LOG=false
# ou simplesmente remova a variável
```

---

## 📈 Interpretando os Logs

### Cenário Normal
```
[BAILEYS] 📦 Event buffering started
[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 50 }
[BAILEYS] 🔄 Event buffer flushed { flushCount: 2, historyCacheSize: 120 }
```
✅ Buffer funcionando corretamente, flushes regulares

### Alto Volume de Mensagens
```
[BAILEYS] 📦 Event buffering started
[DEBUG] buffering events { itemsBuffered: 100, event: 'messages.upsert' }
[DEBUG] buffering events { itemsBuffered: 200, event: 'messages.upsert' }
[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 450 }
```
✅ Volume alto mas gerenciado

### Timeout (Processamento Lento)
```
[BAILEYS] 📦 Event buffering started
[BAILEYS] ⏰ Buffer auto-flush triggered by timeout
[WARN] auto-flushing buffer due to timeout { timeoutMs: 5000, itemsBuffered: 234 }
```
⚠️  Processamento está lento, considere otimizar handlers

### Overflow (Muitos Eventos)
```
[BAILEYS] 📦 Event buffering started
[DEBUG] buffering events { itemsBuffered: 100, ... }
[DEBUG] buffering events { itemsBuffered: 200, ... }
...
[BAILEYS] ⚠️  Buffer overflow detected - Force flushing { itemsBuffered: 1001, maxItems: 1000 }
```
⚠️  Volume muito alto, considere aumentar `MAX_BUFFER_ITEMS`

### Cache Cleanup
```
[BAILEYS] 🧹 History cache cleaned { removed: 2000, remaining: 8000 }
```
✅ Cache cresceu demais e foi limpo automaticamente

---

## 🛠️ Troubleshooting

### Logs não aparecem

**BAILEYS_LOG:**
```bash
# Verifique se a variável está configurada
echo $BAILEYS_LOG  # Linux/Mac
echo %BAILEYS_LOG%  # Windows

# Configure corretamente
export BAILEYS_LOG=true  # Linux/Mac
set BAILEYS_LOG=true     # Windows CMD
$env:BAILEYS_LOG="true"  # Windows PowerShell
```

**Standard Logger:**
```typescript
// Verifique o nível de log configurado
const logger = P({ level: 'trace' })  // Deve ser 'trace' para ver todos os logs
```

### Muitos logs

```typescript
// Reduza a frequência
if (bufferMetrics.itemsBuffered % 500 === 0) {  // Era 100, agora 500
  logger.debug(...)
}

// Ou desabilite BAILEYS_LOG
process.env.BAILEYS_LOG = 'false'
```

---

## 📚 Arquivos Modificados

1. **src/Utils/baileys-logger.ts**
   - `logEventBuffer()` - Logs de operações do buffer
   - `logBufferMetrics()` - Logs de métricas periódicas

2. **src/Utils/event-buffer.ts**
   - Imports de `logEventBuffer` e `logBufferMetrics`
   - Logs em `buffer()`, `flush()`, `cleanHistoryCache()`, `emit()`

---

## 🎯 Benefícios

1. ✅ **Visibilidade Total** - Veja exatamente o que o buffer está fazendo
2. ✅ **Debug Simplificado** - BAILEYS_LOG para desenvolvimento rápido
3. ✅ **Produção Ready** - Logs estruturados (Pino) para monitoramento
4. ✅ **Performance Tracking** - Métricas a cada 10 flushes
5. ✅ **Alertas Proativos** - Warnings para overflow e timeouts

---

## 📞 Suporte

Para questões sobre logging:
- Verifique os logs no console (BAILEYS_LOG=true)
- Analise os logs estruturados (Pino) em produção
- Ajuste `BUFFER_CONFIG` se necessário
