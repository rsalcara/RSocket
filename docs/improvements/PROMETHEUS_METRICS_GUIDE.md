# 📊 Guia Completo de Métricas Prometheus - RBaileys

## 🎯 Visão Geral

Este guia lista **TODAS** as métricas disponíveis no RBaileys para monitoramento com Prometheus e Grafana.

**Prefixo**: Todas as métricas começam com `zpro_baileys_`

---

## 📱 CATEGORIA 1: MENSAGENS WHATSAPP

### `zpro_baileys_messages_received_total` (Counter)
**Descrição**: Total de mensagens recebidas
**Labels**: `message_type` (text, image, video, audio, document, sticker, contact, location, other)
**Query Grafana**:
```promql
# Total acumulado
zpro_baileys_messages_received_total

# Por tipo de mensagem
sum by(message_type) (zpro_baileys_messages_received_total)

# Taxa por minuto
rate(zpro_baileys_messages_received_total[5m]) * 60
```

### `zpro_baileys_messages_sent_total` (Counter)
**Descrição**: Total de mensagens enviadas
**Labels**: `message_type`, `success` (true/false)
**Query Grafana**:
```promql
# Total enviado
zpro_baileys_messages_sent_total{success="true"}

# Taxa de sucesso
rate(zpro_baileys_messages_sent_total{success="true"}[5m]) * 60

# Taxa de falha
rate(zpro_baileys_messages_sent_total{success="false"}[5m]) * 60
```

### `zpro_baileys_messages_retry_total` (Counter)
**Descrição**: Total de tentativas de reenvio de mensagens
**Labels**: `retry_reason`
**Query Grafana**:
```promql
zpro_baileys_messages_retry_total

# Por motivo
sum by(retry_reason) (zpro_baileys_messages_retry_total)
```

### `zpro_baileys_messages_processing_duration_seconds` (Histogram)
**Descrição**: Duração do processamento de mensagens
**Labels**: `message_type`
**Query Grafana**:
```promql
# Percentil 95
histogram_quantile(0.95, rate(zpro_baileys_messages_processing_duration_seconds_bucket[5m]))

# Média
rate(zpro_baileys_messages_processing_duration_seconds_sum[5m]) / rate(zpro_baileys_messages_processing_duration_seconds_count[5m])
```

---

## 🔌 CATEGORIA 2: CONEXÕES WHATSAPP

### `zpro_baileys_active_connections` (Gauge)
**Descrição**: Número de conexões WhatsApp ativas
**Query Grafana**:
```promql
zpro_baileys_active_connections
```

### `zpro_baileys_connection_state` (Gauge)
**Descrição**: Estado da conexão (0=disconnected, 1=connecting, 2=connected)
**Labels**: `connection_id`, `jid`
**Query Grafana**:
```promql
# Ver estado de todas as conexões
zpro_baileys_connection_state

# Contar conexões conectadas
count(zpro_baileys_connection_state == 2)

# Contar conexões desconectadas
count(zpro_baileys_connection_state == 0)
```

### `zpro_baileys_connection_errors_total` (Counter)
**Descrição**: Total de erros de conexão
**Labels**: `error_type` (stream_error, connection_failure, message_processing_error)
**Query Grafana**:
```promql
# Total de erros
zpro_baileys_connection_errors_total

# Por tipo
sum by(error_type) (zpro_baileys_connection_errors_total)

# Taxa de erros por minuto
rate(zpro_baileys_connection_errors_total[5m]) * 60
```

### `zpro_baileys_reconnection_attempts_total` (Counter)
**Descrição**: Total de tentativas de reconexão
**Labels**: `connection_id`
**Query Grafana**:
```promql
zpro_baileys_reconnection_attempts_total

# Por conexão
sum by(connection_id) (zpro_baileys_reconnection_attempts_total)
```

### `zpro_baileys_websocket_listeners_total` (Gauge)
**Descrição**: Número de event listeners no WebSocket
**Labels**: `connection_id`
**Query Grafana**:
```promql
zpro_baileys_websocket_listeners_total
```

---

## 📦 CATEGORIA 3: EVENT BUFFER (PERFORMANCE)

### `zpro_baileys_buffer_flush_total` (Counter)
**Descrição**: Total de flushes do buffer
**Labels**: `mode` (standard, adaptive), `forced` (true/false)
**Query Grafana**:
```promql
# Total de flushes
zpro_baileys_buffer_flush_total

# Taxa por minuto
rate(zpro_baileys_buffer_flush_total[5m]) * 60

# Flushes forçados vs normais
sum by(forced) (zpro_baileys_buffer_flush_total)
```

### `zpro_baileys_buffer_flush_duration_seconds` (Histogram)
**Descrição**: Duração do flush em segundos
**Labels**: `mode`
**Query Grafana**:
```promql
# Percentil 95
histogram_quantile(0.95, rate(zpro_baileys_buffer_flush_duration_seconds_bucket[5m]))

# Percentil 99
histogram_quantile(0.99, rate(zpro_baileys_buffer_flush_duration_seconds_bucket[5m]))

# Média
rate(zpro_baileys_buffer_flush_duration_seconds_sum[5m]) / rate(zpro_baileys_buffer_flush_duration_seconds_count[5m])
```

### `zpro_baileys_buffer_items_flushed_total` (Counter)
**Descrição**: Total de itens processados no flush
**Labels**: `mode`
**Query Grafana**:
```promql
zpro_baileys_buffer_items_flushed_total

# Itens por flush (média)
rate(zpro_baileys_buffer_items_flushed_total[5m]) / rate(zpro_baileys_buffer_flush_total[5m])
```

### `zpro_baileys_buffer_overflow_total` (Counter)
**Descrição**: Total de eventos de overflow do buffer
**Query Grafana**:
```promql
# Total acumulado
zpro_baileys_buffer_overflow_total

# Últimos 5 minutos
increase(zpro_baileys_buffer_overflow_total[5m])
```

### `zpro_baileys_buffer_cache_size` (Gauge)
**Descrição**: Tamanho atual do cache de histórico
**Query Grafana**:
```promql
zpro_baileys_buffer_cache_size
```

### `zpro_baileys_buffer_cache_cleanup_total` (Counter)
**Descrição**: Total de limpezas do cache (LRU evictions)
**Query Grafana**:
```promql
zpro_baileys_buffer_cache_cleanup_total

# Taxa por minuto
rate(zpro_baileys_buffer_cache_cleanup_total[5m]) * 60
```

---

## 🤖 CATEGORIA 4: ALGORITMO ADAPTATIVO

### `zpro_baileys_adaptive_timeout_seconds` (Gauge)
**Descrição**: Timeout adaptativo atual em segundos
**Labels**: `mode`
**Query Grafana**:
```promql
zpro_baileys_adaptive_timeout_seconds
```

### `zpro_baileys_adaptive_event_rate` (Gauge)
**Descrição**: Taxa de eventos por segundo
**Query Grafana**:
```promql
zpro_baileys_adaptive_event_rate
```

### `zpro_baileys_adaptive_buffer_size_avg` (Gauge)
**Descrição**: Tamanho médio do buffer
**Query Grafana**:
```promql
zpro_baileys_adaptive_buffer_size_avg
```

### `zpro_baileys_adaptive_circuit_breaker_trips_total` (Counter)
**Descrição**: Total de disparos do circuit breaker
**Query Grafana**:
```promql
# Total acumulado
zpro_baileys_adaptive_circuit_breaker_trips_total

# Última hora
increase(zpro_baileys_adaptive_circuit_breaker_trips_total[1h])

# Últimos 5 minutos
increase(zpro_baileys_adaptive_circuit_breaker_trips_total[5m])
```

### `zpro_baileys_adaptive_health_status` (Gauge)
**Descrição**: Status de saúde do sistema adaptativo (0=unhealthy, 1=healthy)
**Query Grafana**:
```promql
zpro_baileys_adaptive_health_status
```

---

## 💾 CATEGORIA 5: SISTEMA E RECURSOS

### `zpro_baileys_process_cpu_user_seconds_total` (Counter)
**Descrição**: Tempo de CPU do usuário em segundos
**Query Grafana**:
```promql
# Uso de CPU (%)
rate(zpro_baileys_process_cpu_user_seconds_total[5m]) * 100
```

### `zpro_baileys_process_cpu_system_seconds_total` (Counter)
**Descrição**: Tempo de CPU do sistema em segundos
**Query Grafana**:
```promql
rate(zpro_baileys_process_cpu_system_seconds_total[5m]) * 100
```

### `zpro_baileys_process_cpu_seconds_total` (Counter)
**Descrição**: Tempo total de CPU (user + system)
**Query Grafana**:
```promql
# CPU total em %
rate(zpro_baileys_process_cpu_seconds_total[5m]) * 100
```

### `zpro_baileys_process_resident_memory_bytes` (Gauge)
**Descrição**: Memória residente (RSS) em bytes
**Query Grafana**:
```promql
# Em MB
zpro_baileys_process_resident_memory_bytes / 1024 / 1024

# Em GB
zpro_baileys_process_resident_memory_bytes / 1024 / 1024 / 1024
```

### `zpro_baileys_process_virtual_memory_bytes` (Gauge)
**Descrição**: Memória virtual em bytes
**Query Grafana**:
```promql
zpro_baileys_process_virtual_memory_bytes / 1024 / 1024
```

### `zpro_baileys_process_heap_bytes` (Gauge)
**Descrição**: Tamanho da heap do Node.js em bytes
**Query Grafana**:
```promql
zpro_baileys_process_heap_bytes / 1024 / 1024
```

### `zpro_baileys_process_open_fds` (Gauge)
**Descrição**: Número de file descriptors abertos
**Query Grafana**:
```promql
zpro_baileys_process_open_fds
```

### `zpro_baileys_process_max_fds` (Gauge)
**Descrição**: Número máximo de file descriptors permitidos
**Query Grafana**:
```promql
zpro_baileys_process_max_fds
```

### `zpro_baileys_process_start_time_seconds` (Gauge)
**Descrição**: Timestamp de início do processo (Unix epoch)
**Query Grafana**:
```promql
# Uptime em segundos
time() - zpro_baileys_process_start_time_seconds

# Uptime em horas
(time() - zpro_baileys_process_start_time_seconds) / 3600

# Uptime em dias
(time() - zpro_baileys_process_start_time_seconds) / 86400
```

---

## ⚡ CATEGORIA 6: NODE.JS INTERNALS

### `zpro_baileys_nodejs_eventloop_lag_seconds` (Gauge)
**Descrição**: Latência do Event Loop em segundos
**Query Grafana**:
```promql
# Em milissegundos
zpro_baileys_nodejs_eventloop_lag_seconds * 1000
```

### `zpro_baileys_nodejs_eventloop_lag_min_seconds` (Gauge)
**Descrição**: Latência mínima do Event Loop
**Query Grafana**:
```promql
zpro_baileys_nodejs_eventloop_lag_min_seconds * 1000
```

### `zpro_baileys_nodejs_eventloop_lag_max_seconds` (Gauge)
**Descrição**: Latência máxima do Event Loop
**Query Grafana**:
```promql
zpro_baileys_nodejs_eventloop_lag_max_seconds * 1000
```

### `zpro_baileys_nodejs_eventloop_lag_mean_seconds` (Gauge)
**Descrição**: Latência média do Event Loop
**Query Grafana**:
```promql
zpro_baileys_nodejs_eventloop_lag_mean_seconds * 1000
```

### `zpro_baileys_nodejs_eventloop_lag_p50_seconds` (Gauge)
**Descrição**: Percentil 50 (mediana) do Event Loop
**Query Grafana**:
```promql
zpro_baileys_nodejs_eventloop_lag_p50_seconds * 1000
```

### `zpro_baileys_nodejs_eventloop_lag_p90_seconds` (Gauge)
**Descrição**: Percentil 90 do Event Loop
**Query Grafana**:
```promql
zpro_baileys_nodejs_eventloop_lag_p90_seconds * 1000
```

### `zpro_baileys_nodejs_eventloop_lag_p99_seconds` (Gauge)
**Descrição**: Percentil 99 do Event Loop
**Query Grafana**:
```promql
zpro_baileys_nodejs_eventloop_lag_p99_seconds * 1000
```

### `zpro_baileys_nodejs_active_handles` (Gauge)
**Descrição**: Número de handles ativos no Node.js
**Query Grafana**:
```promql
zpro_baileys_nodejs_active_handles
```

### `zpro_baileys_nodejs_active_requests` (Gauge)
**Descrição**: Número de requisições ativas no Node.js
**Query Grafana**:
```promql
zpro_baileys_nodejs_active_requests
```

### `zpro_baileys_nodejs_version_info` (Gauge)
**Descrição**: Versão do Node.js
**Labels**: `version`
**Query Grafana**:
```promql
zpro_baileys_nodejs_version_info
```

---

## 💰 CATEGORIA 7: CACHE

### `zpro_baileys_cache_size` (Gauge)
**Descrição**: Tamanho atual do cache
**Labels**: `cache_name`
**Query Grafana**:
```promql
zpro_baileys_cache_size

# Por cache específico
zpro_baileys_cache_size{cache_name="messages"}
```

### `zpro_baileys_cache_evictions_total` (Counter)
**Descrição**: Total de evictions do cache (LRU)
**Labels**: `cache_name`
**Query Grafana**:
```promql
zpro_baileys_cache_evictions_total

# Taxa por minuto
rate(zpro_baileys_cache_evictions_total[5m]) * 60
```

### `zpro_baileys_cache_hit_rate` (Gauge)
**Descrição**: Taxa de acerto do cache (0-1)
**Labels**: `cache_name`
**Query Grafana**:
```promql
# Em porcentagem
zpro_baileys_cache_hit_rate * 100
```

---

## 🌐 CATEGORIA 8: HTTP/REDE

### `zpro_baileys_http_requests_total` (Counter)
**Descrição**: Total de requisições HTTP processadas
**Query Grafana**:
```promql
zpro_baileys_http_requests_total

# Taxa por segundo
rate(zpro_baileys_http_requests_total[5m])
```

### `zpro_baileys_memory_usage_bytes` (Gauge)
**Descrição**: Uso de memória em bytes
**Labels**: `type` (heapUsed, heapTotal, external, rss)
**Query Grafana**:
```promql
# Heap usado em MB
zpro_baileys_memory_usage_bytes{type="heapUsed"} / 1024 / 1024

# RSS em MB
zpro_baileys_memory_usage_bytes{type="rss"} / 1024 / 1024
```

### `zpro_baileys_uptime_seconds` (Gauge)
**Descrição**: Tempo de atividade do processo em segundos
**Query Grafana**:
```promql
# Em horas
zpro_baileys_uptime_seconds / 3600

# Em dias
zpro_baileys_uptime_seconds / 86400
```

---

## 📈 EXEMPLOS DE DASHBOARDS

### Painel 1: Taxa de Mensagens por Minuto
```promql
rate(zpro_baileys_messages_received_total[5m]) * 60
```

### Painel 2: Taxa de Sucesso de Envio
```promql
(
  rate(zpro_baileys_messages_sent_total{success="true"}[5m])
  /
  rate(zpro_baileys_messages_sent_total[5m])
) * 100
```

### Painel 3: Uso de Memória (%)
```promql
(zpro_baileys_process_resident_memory_bytes / zpro_baileys_process_heap_bytes) * 100
```

### Painel 4: Event Loop Lag (ms)
```promql
zpro_baileys_nodejs_eventloop_lag_seconds * 1000
```

### Painel 5: Buffer Flush Latency (p95)
```promql
histogram_quantile(0.95, rate(zpro_baileys_buffer_flush_duration_seconds_bucket[5m])) * 1000
```

---

## 🚨 ALERTAS RECOMENDADOS

### 1. Event Loop Lag Alto
```yaml
- alert: HighEventLoopLag
  expr: zpro_baileys_nodejs_eventloop_lag_seconds * 1000 > 100
  for: 5m
  annotations:
    summary: "Event Loop lag muito alto (> 100ms)"
```

### 2. Buffer Overflow
```yaml
- alert: BufferOverflow
  expr: increase(zpro_baileys_buffer_overflow_total[5m]) > 0
  annotations:
    summary: "Buffer overflow detectado"
```

### 3. Circuit Breaker Ativo
```yaml
- alert: CircuitBreakerTripped
  expr: increase(zpro_baileys_adaptive_circuit_breaker_trips_total[5m]) > 0
  annotations:
    summary: "Circuit breaker disparou"
```

### 4. Muitos Erros de Conexão
```yaml
- alert: HighConnectionErrors
  expr: rate(zpro_baileys_connection_errors_total[5m]) > 0.1
  for: 5m
  annotations:
    summary: "Taxa de erros de conexão alta"
```

### 5. Memória Alta
```yaml
- alert: HighMemoryUsage
  expr: zpro_baileys_process_resident_memory_bytes / 1024 / 1024 > 1024
  for: 10m
  annotations:
    summary: "Uso de memória acima de 1GB"
```

---

## 🔍 DEBUGGING

### Ver todas as métricas disponíveis:
```bash
curl -s http://localhost:9092/metrics | grep zpro_baileys
```

### Contar métricas:
```bash
curl -s http://localhost:9092/metrics | grep -c "^zpro_baileys_"
```

### Ver métricas de mensagens:
```bash
curl -s http://localhost:9092/metrics | grep "zpro_baileys_messages"
```

### Ver métricas de conexão:
```bash
curl -s http://localhost:9092/metrics | grep "zpro_baileys_connection"
```

---

## 📚 Referências

- **Prometheus**: https://prometheus.io/docs/
- **PromQL**: https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Grafana**: https://grafana.com/docs/
- **prom-client**: https://github.com/siimon/prom-client

---

**Última atualização**: 2026-01-14
