# 📊 Event Buffer - Exemplos Práticos de Logs

## 🎬 Cenários Reais

### Cenário 1: Operação Normal - Recebendo Mensagens

```bash
# Terminal com BAILEYS_LOG=true

[BAILEYS] 📦 Event buffering started

# Standard logger (nível debug) - a cada 100 eventos
{"level":"debug","msg":"buffering events","itemsBuffered":100,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":200,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":300,"event":"chats.update"}

# Flush automático após processamento
[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 234 }

{"level":"trace","msg":"released buffered events","conditionalChatUpdatesLeft":0,"historyCacheSize":234,"flushCount":1,"forced":false}
```

**O que aconteceu:**
✅ Buffer iniciado
✅ 300 eventos bufferizados
✅ Flush executado com sucesso
✅ Cache com 234 itens

---

### Cenário 2: Auto-Flush por Timeout (Processamento Lento)

```bash
[BAILEYS] 📦 Event buffering started

{"level":"debug","msg":"buffering events","itemsBuffered":100,"event":"messages.upsert"}

# 5 segundos depois, sem flush manual
[BAILEYS] ⏰ Buffer auto-flush triggered by timeout

{"level":"warn","msg":"auto-flushing buffer due to timeout","timeoutMs":5000,"itemsBuffered":156}

[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 156 }
```

**O que aconteceu:**
⚠️  Processamento lento detectado
⚠️  Auto-flush ativado após 5 segundos
✅ Buffer forçado a fazer flush

**Ação recomendada:**
- Verificar se handlers estão lentos
- Otimizar processamento de eventos
- Considerar aumentar `AUTO_FLUSH_TIMEOUT_MS` se normal para sua aplicação

---

### Cenário 3: Buffer Overflow (Alto Volume)

```bash
[BAILEYS] 📦 Event buffering started

{"level":"debug","msg":"buffering events","itemsBuffered":100,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":200,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":300,"event":"contacts.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":400,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":500,"event":"chats.update"}
{"level":"debug","msg":"buffering events","itemsBuffered":600,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":700,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":800,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":900,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":1000,"event":"messages.upsert"}

# Próximo evento causa overflow
[BAILEYS] ⚠️  Buffer overflow detected - Force flushing { itemsBuffered: 1001, maxItems: 1000 }

{"level":"warn","msg":"buffer overflow detected, force flushing","itemsBuffered":1001,"maxItems":1000,"event":"messages.upsert"}

[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 1567 }
```

**O que aconteceu:**
⚠️  Volume muito alto de eventos
⚠️  Limite de 1000 itens atingido
✅ Flush forçado para prevenir vazamento de memória

**Ação recomendada:**
- Normal em picos de mensagens (grupos grandes, sync inicial)
- Se frequente, aumentar `MAX_BUFFER_ITEMS` para 2000 ou 3000
- Monitorar uso de memória

---

### Cenário 4: Cache Cleanup (Histórico Grande)

```bash
# Após muitas operações, cache cresce
[BAILEYS] 🔄 Event buffer flushed { flushCount: 50, historyCacheSize: 9856 }
[BAILEYS] 🔄 Event buffer flushed { flushCount: 51, historyCacheSize: 9923 }
[BAILEYS] 🔄 Event buffer flushed { flushCount: 52, historyCacheSize: 10045 }

# Cache ultrapassou 10.000 itens
[BAILEYS] 🧹 History cache cleaned { removed: 2009, remaining: 8036 }

{"level":"debug","msg":"cleaned history cache","removed":2009,"remaining":8036,"maxSize":10000}

[BAILEYS] 🔄 Event buffer flushed { flushCount: 53, historyCacheSize: 8036 }
```

**O que aconteceu:**
✅ Cache cresceu além do limite (10.000)
✅ Limpeza automática removeu 20% dos itens mais antigos
✅ Cache agora com 8.036 itens

**Ação recomendada:**
- Comportamento normal e saudável
- Se muito frequente, considere aumentar `MAX_HISTORY_CACHE_SIZE`

---

### Cenário 5: Métricas Periódicas (Monitoramento)

```bash
# A cada 10 flushes, métricas são logadas
[BAILEYS] 🔄 Event buffer flushed { flushCount: 8, historyCacheSize: 456 }
[BAILEYS] 🔄 Event buffer flushed { flushCount: 9, historyCacheSize: 523 }

# Décimo flush - métricas completas
[BAILEYS] 🔄 Event buffer flushed { flushCount: 10, historyCacheSize: 612 }

[BAILEYS] 📊 Buffer Metrics {
  itemsBuffered: 0,
  flushCount: 10,
  historyCacheSize: 612,
  buffersInProgress: 1
}

{"level":"trace","msg":"released buffered events","conditionalChatUpdatesLeft":0,"historyCacheSize":612,"flushCount":10,"forced":false}
```

**O que aconteceu:**
✅ Sistema funcionando normalmente
✅ Métricas periódicas para monitoramento
✅ 10 flushes bem-sucedidos

---

### Cenário 6: Sync Inicial (Histórico Completo)

```bash
# WhatsApp sincronizando histórico completo
[BAILEYS] 📦 Event buffering started

{"level":"debug","msg":"buffering events","itemsBuffered":100,"event":"messaging-history.set"}
{"level":"debug","msg":"buffering events","itemsBuffered":200,"event":"messaging-history.set"}
{"level":"debug","msg":"buffering events","itemsBuffered":300,"event":"contacts.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":400,"event":"chats.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":500,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":600,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":700,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":800,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":900,"event":"messages.upsert"}

# Flush normal antes de overflow
[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 4523 }

# Continua sincronizando...
{"level":"debug","msg":"buffering events","itemsBuffered":100,"event":"messages.upsert"}
{"level":"debug","msg":"buffering events","itemsBuffered":200,"event":"messages.upsert"}

[BAILEYS] 🔄 Event buffer flushed { flushCount: 2, historyCacheSize: 6234 }

# Cache crescendo...
[BAILEYS] 🔄 Event buffer flushed { flushCount: 3, historyCacheSize: 8456 }
[BAILEYS] 🔄 Event buffer flushed { flushCount: 4, historyCacheSize: 10234 }

# Limpeza automática
[BAILEYS] 🧹 History cache cleaned { removed: 2046, remaining: 8188 }
```

**O que aconteceu:**
✅ Sync inicial processado corretamente
✅ Múltiplos flushes para gerenciar volume
✅ Cache limpo automaticamente quando necessário

---

## 🎯 Como Interpretar

### 🟢 Tudo Normal
```
📦 → 🔄 → 🔄 → 🔄 (flushes regulares)
```

### 🟡 Atenção
```
📦 → ⏰ (timeout frequente)
Ação: Otimizar handlers
```

### 🟠 Cuidado
```
📦 → ⚠️ → 🔄 (overflow ocasional)
Ação: Monitorar, normal em picos
```

### 🔴 Problema
```
📦 → ⚠️ → ⚠️ → ⚠️ (overflow constante)
Ação: Aumentar MAX_BUFFER_ITEMS ou otimizar processamento
```

---

## 📈 Métricas Importantes

### itemsBuffered
- **0**: Buffer vazio (após flush)
- **< 500**: Volume normal
- **500-1000**: Volume alto, ok
- **> 1000**: Overflow, flush forçado

### flushCount
- Cresce continuamente
- Use para medir throughput
- A cada 10, métricas completas são logadas

### historyCacheSize
- **< 5000**: Operação leve
- **5000-10000**: Normal em uso constante
- **> 10000**: Limpeza automática ativada

### buffersInProgress
- **0**: Sem buffering ativo
- **1**: Buffering normal
- **> 1**: Múltiplos buffers aninhados (raro)

---

## 🔧 Ajuste de Logs para Produção

### Menos Verbose
```typescript
// event-buffer.ts

// Aumentar limite de logs de debug
if (bufferMetrics.itemsBuffered % 500 === 0) {  // era 100
  logger.debug(...)
}

// Logs de métricas a cada 50 flushes
if (bufferMetrics.flushCount % 50 === 0) {  // era 10
  logBufferMetrics(...)
}
```

### Mais Verbose (Debug)
```typescript
// Logar todo evento bufferizado
logger.trace({ event, itemsBuffered }, 'event buffered')

// Logar todo flush
logger.info('buffer flushed')
```

---

## 📊 Dashboard Sugerido (Grafana/CloudWatch)

**Métricas para monitorar:**

1. **Buffer Flush Rate**
   - Query: Count `buffer flushed` per minute
   - Alert: < 1/min (sistema parado) ou > 100/min (muito alto)

2. **Buffer Overflow Count**
   - Query: Count `buffer overflow` per hour
   - Alert: > 10/hour (ajustar MAX_BUFFER_ITEMS)

3. **Auto-Flush Timeout Count**
   - Query: Count `auto-flush timeout` per hour
   - Alert: > 5/hour (processamento lento)

4. **History Cache Size**
   - Query: Avg `historyCacheSize` from metrics
   - Alert: Constant > 9000 (pode precisar de mais memória)

5. **Items Buffered Peak**
   - Query: Max `itemsBuffered` before flush
   - Alert: Constant near 1000 (aumentar limite)

---

## 🎓 Exemplos de Queries (Logs Estruturados)

### Contar Overflows na Última Hora
```json
{
  "query": {
    "match": {
      "msg": "buffer overflow detected"
    }
  },
  "range": {
    "time": {
      "gte": "now-1h"
    }
  }
}
```

### Média de Items Buffered
```json
{
  "aggs": {
    "avg_buffered": {
      "avg": {
        "field": "itemsBuffered"
      }
    }
  }
}
```

### Timeouts por Dia
```json
{
  "query": {
    "match": {
      "msg": "auto-flushing buffer due to timeout"
    }
  },
  "range": {
    "time": {
      "gte": "now-24h"
    }
  }
}
```
