# 📊 Prometheus Integration - Production Monitoring

## 📋 Visão Geral

A integração Prometheus do RBaileys fornece **métricas de observabilidade de nível empresarial** para monitorar performance, saúde do sistema, e detectar problemas antes que causem falhas.

### 🎯 Características

- ✅ **Zero overhead quando desabilitado** (default: disabled)
- ✅ **Opt-in via environment variables**
- ✅ **30+ métricas de produção** (Counters, Gauges, Histograms)
- ✅ **HTTP servidor standalone** para endpoint `/metrics`
- ✅ **Padrão Prometheus oficial** (biblioteca `prom-client`)
- ✅ **Labels customizados** para multi-tenant
- ✅ **Métricas padrão do Node.js** (memória, CPU, event loop)
- ✅ **Dashboards Grafana prontos**

---

## ⚙️ Configuração

### Variáveis de Ambiente

```bash
# ============================================
# PROMETHEUS CONFIGURATION
# ============================================

# Habilitar exportação Prometheus (default: false)
BAILEYS_PROMETHEUS_ENABLED=true

# Porta do servidor HTTP de métricas (default: 9090)
BAILEYS_PROMETHEUS_PORT=9090

# Path do endpoint de métricas (default: /metrics)
BAILEYS_PROMETHEUS_PATH=/metrics

# Prefix para todas as métricas (default: baileys_)
BAILEYS_PROMETHEUS_PREFIX=baileys_

# Labels customizados (JSON format - opcional)
BAILEYS_PROMETHEUS_LABELS={"environment":"production","service":"zpro","datacenter":"aws-us-east-1"}

# Coletar métricas padrão do Node.js (default: true)
BAILEYS_PROMETHEUS_COLLECT_DEFAULT=true
```

---

## 📊 Métricas Disponíveis

### **Categoria 1: Event Buffer Metrics** (Performance Crítica)

#### `baileys_buffer_flush_total` (Counter)
- **Descrição**: Total de flushes executados
- **Labels**: `mode` (aggressive/balanced/conservative/disabled), `forced` (true/false)
- **Uso**: Monitorar frequência de flushes

**Exemplo PromQL**:
```promql
# Taxa de flushes por minuto
rate(baileys_buffer_flush_total[1m])

# Flushes forçados (overflow)
rate(baileys_buffer_flush_total{forced="true"}[5m])
```

#### `baileys_buffer_flush_duration_seconds` (Histogram)
- **Descrição**: Tempo de execução de cada flush
- **Labels**: `mode`
- **Buckets**: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
- **Uso**: Detectar flushes lentos (> 2s)

**Exemplo PromQL**:
```promql
# P95 flush duration (95% dos flushes completam em X segundos)
histogram_quantile(0.95, rate(baileys_buffer_flush_duration_seconds_bucket[5m]))

# P99 flush duration (99% dos flushes)
histogram_quantile(0.99, rate(baileys_buffer_flush_duration_seconds_bucket[5m]))

# Média de flush duration
rate(baileys_buffer_flush_duration_seconds_sum[5m]) / rate(baileys_buffer_flush_duration_seconds_count[5m])
```

#### `baileys_buffer_items_flushed_total` (Counter)
- **Descrição**: Total de itens processados em flushes
- **Labels**: `mode`
- **Uso**: Medir throughput real de eventos

**Exemplo PromQL**:
```promql
# Itens/segundo sendo processados
rate(baileys_buffer_items_flushed_total[1m])

# Total de itens processados (últimas 24h)
increase(baileys_buffer_items_flushed_total[24h])
```

#### `baileys_buffer_overflow_total` (Counter)
- **Descrição**: Quantidade de vezes que buffer overflow foi acionado
- **Uso**: **CRÍTICO** - Se > 0, precisa ajustar `BAILEYS_BUFFER_MAX_ITEMS`

**Exemplo PromQL**:
```promql
# Alertar se buffer overflow ocorreu
rate(baileys_buffer_overflow_total[5m]) > 0
```

**Alerta Recomendado**:
```yaml
- alert: BufferOverflowDetected
  expr: rate(baileys_buffer_overflow_total[5m]) > 0
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "Buffer overflow detected - increase BAILEYS_BUFFER_MAX_ITEMS"
```

#### `baileys_buffer_cache_size` (Gauge)
- **Descrição**: Tamanho atual do history cache
- **Uso**: Monitorar uso de memória do cache

**Exemplo PromQL**:
```promql
# Utilização do cache (%)
(baileys_buffer_cache_size / 10000) * 100

# Alertar se cache > 90% da capacidade
baileys_buffer_cache_size > 9000
```

#### `baileys_buffer_cache_cleanup_total` (Counter)
- **Descrição**: Quantidade de limpezas LRU executadas
- **Uso**: Se muito alto, precisa aumentar `BAILEYS_BUFFER_MAX_CACHE`

**Exemplo PromQL**:
```promql
# Limpezas por hora
rate(baileys_buffer_cache_cleanup_total[1h]) * 3600
```

---

### **Categoria 2: Adaptive Flush Metrics** (Algoritmo Inteligente)

#### `baileys_adaptive_timeout_seconds` (Gauge)
- **Descrição**: Timeout adaptativo calculado atual
- **Labels**: `mode`
- **Uso**: Visualizar como algoritmo está ajustando dinamicamente

**Exemplo PromQL**:
```promql
# Timeout atual em milissegundos
baileys_adaptive_timeout_seconds * 1000

# Variação do timeout (últimas 10 min)
delta(baileys_adaptive_timeout_seconds[10m])
```

#### `baileys_adaptive_event_rate` (Gauge)
- **Descrição**: Taxa de eventos por segundo (EMA)
- **Uso**: Entender carga do sistema em tempo real

**Exemplo PromQL**:
```promql
# Eventos/segundo atual
baileys_adaptive_event_rate

# Alertar se carga muito alta
baileys_adaptive_event_rate > 50
```

#### `baileys_adaptive_buffer_size_avg` (Gauge)
- **Descrição**: Tamanho médio do buffer (EMA)
- **Uso**: Ver quantos eventos acumulam antes de flush

#### `baileys_adaptive_circuit_breaker_trips_total` (Counter)
- **Descrição**: Quantas vezes o circuit breaker foi acionado
- **Uso**: **CRÍTICO** - Se > 0, sistema está com problemas graves

**Alerta Recomendado**:
```yaml
- alert: AdaptiveCircuitBreakerTripped
  expr: increase(baileys_adaptive_circuit_breaker_trips_total[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Adaptive flush circuit breaker triggered - performance degradation"
```

#### `baileys_adaptive_health_status` (Gauge)
- **Descrição**: Status de saúde (1 = healthy, 0 = unhealthy)
- **Uso**: Alertar quando algoritmo adaptativo falha

**Exemplo PromQL**:
```promql
# Alertar se unhealthy
baileys_adaptive_health_status == 0
```

---

### **Categoria 3: Connection Metrics** (Conectividade)

#### `baileys_connection_state` (Gauge)
- **Descrição**: Estado da conexão (0=disconnected, 1=connecting, 2=connected)
- **Labels**: `connection_id`, `jid`
- **Uso**: Monitorar status de conexões WhatsApp

**Exemplo PromQL**:
```promql
# Total de conexões ativas (state=2)
count(baileys_connection_state == 2)

# Total de conexões com problemas (state!=2)
count(baileys_connection_state != 2)
```

#### `baileys_connection_errors_total` (Counter)
- **Descrição**: Erros de conexão por tipo
- **Labels**: `error_type` (timeout, auth_failure, rate_limit, network_error, etc.)
- **Uso**: Identificar causas de falhas

**Exemplo PromQL**:
```promql
# Taxa de erros por tipo
rate(baileys_connection_errors_total[5m])

# Top 5 tipos de erros
topk(5, sum by (error_type) (rate(baileys_connection_errors_total[1h])))
```

#### `baileys_reconnection_attempts_total` (Counter)
- **Descrição**: Tentativas de reconexão
- **Labels**: `connection_id`
- **Uso**: Detectar instabilidade de rede

**Alerta Recomendado**:
```yaml
- alert: HighReconnectionRate
  expr: rate(baileys_reconnection_attempts_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High reconnection rate detected - network instability"
```

#### `baileys_websocket_listeners_total` (Gauge)
- **Descrição**: Número atual de listeners WebSocket
- **Labels**: `connection_id`
- **Uso**: **CRÍTICO** - Detectar vazamento de listeners (se > 30, problema!)

**Alerta Recomendado**:
```yaml
- alert: WebSocketListenerLeak
  expr: baileys_websocket_listeners_total > 30
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "WebSocket listener leak detected - {{ $value }} listeners"
```

---

### **Categoria 4: Message Metrics** (Mensagens)

#### `baileys_messages_received_total` (Counter)
- **Descrição**: Total de mensagens recebidas
- **Labels**: `message_type` (text, image, audio, video, document, etc.)
- **Uso**: Medir volume de tráfego

**Exemplo PromQL**:
```promql
# Mensagens/segundo
rate(baileys_messages_received_total[1m])

# Total de mensagens por tipo (últimas 24h)
sum by (message_type) (increase(baileys_messages_received_total[24h]))
```

#### `baileys_messages_sent_total` (Counter)
- **Descrição**: Total de mensagens enviadas
- **Labels**: `message_type`, `success` (true/false)
- **Uso**: Taxa de sucesso de envio

**Exemplo PromQL**:
```promql
# Taxa de sucesso de envio (%)
(
  sum(rate(baileys_messages_sent_total{success="true"}[5m]))
  /
  sum(rate(baileys_messages_sent_total[5m]))
) * 100

# Taxa de falhas de envio
rate(baileys_messages_sent_total{success="false"}[5m])
```

#### `baileys_messages_retry_total` (Counter)
- **Descrição**: Total de retries de mensagens
- **Labels**: `retry_reason` (decrypt_failure, timeout, network_error)
- **Uso**: Identificar problemas de envio

**Exemplo PromQL**:
```promql
# Retries por motivo
sum by (retry_reason) (rate(baileys_messages_retry_total[5m]))
```

#### `baileys_messages_processing_duration_seconds` (Histogram)
- **Descrição**: Tempo de processamento de mensagens
- **Labels**: `message_type`
- **Buckets**: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
- **Uso**: Detectar gargalos de performance

**Exemplo PromQL**:
```promql
# P95 processing time
histogram_quantile(0.95, rate(baileys_messages_processing_duration_seconds_bucket[5m]))
```

---

### **Categoria 5: Cache Metrics** (Memória)

#### `baileys_cache_size` (Gauge)
- **Descrição**: Tamanho de cada cache individual
- **Labels**: `cache_name` (signal_store, msg_retry, user_devices, etc.)
- **Uso**: Monitorar uso de memória por cache

**Exemplo PromQL**:
```promql
# Total de memória em caches
sum(baileys_cache_size)

# Top 3 maiores caches
topk(3, baileys_cache_size)
```

#### `baileys_cache_evictions_total` (Counter)
- **Descrição**: Total de evictions LRU por cache
- **Labels**: `cache_name`
- **Uso**: Se muito alto, aumentar `maxKeys` do cache

**Exemplo PromQL**:
```promql
# Evictions por cache (últimas 24h)
sum by (cache_name) (increase(baileys_cache_evictions_total[24h]))
```

#### `baileys_cache_hit_rate` (Gauge)
- **Descrição**: Taxa de hit do cache (0-1)
- **Labels**: `cache_name`
- **Uso**: Eficiência do cache

**Exemplo PromQL**:
```promql
# Cache hit rate em %
baileys_cache_hit_rate * 100

# Alertar se hit rate < 70%
baileys_cache_hit_rate < 0.7
```

---

### **Categoria 6: System Metrics** (Sistema)

#### `baileys_active_connections` (Gauge)
- **Descrição**: Número de conexões ativas no momento
- **Uso**: Capacidade atual do sistema

**Exemplo PromQL**:
```promql
# Conexões ativas
baileys_active_connections

# Alertar se > 80% da capacidade máxima
baileys_active_connections > 80
```

#### `baileys_memory_usage_bytes` (Gauge)
- **Descrição**: Uso de memória do processo Node.js
- **Labels**: `type` (heapUsed, heapTotal, external, rss)
- **Uso**: Detectar memory leaks

**Exemplo PromQL**:
```promql
# Heap usado em MB
baileys_memory_usage_bytes{type="heapUsed"} / 1024 / 1024

# Taxa de crescimento de memória (possível leak)
rate(baileys_memory_usage_bytes{type="heapUsed"}[10m]) > 0
```

**Alerta Recomendado**:
```yaml
- alert: MemoryLeakDetected
  expr: rate(baileys_memory_usage_bytes{type="heapUsed"}[10m]) > 1048576
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "Possible memory leak - heap growing continuously"
```

#### `baileys_uptime_seconds` (Gauge)
- **Descrição**: Tempo de uptime do processo
- **Uso**: Estabilidade do sistema

**Exemplo PromQL**:
```promql
# Uptime em horas
baileys_uptime_seconds / 3600

# Uptime em dias
baileys_uptime_seconds / 86400
```

---

### **Métricas Padrão do Node.js** (Automáticas)

Quando `BAILEYS_PROMETHEUS_COLLECT_DEFAULT=true`, as seguintes métricas são coletadas automaticamente:

- `baileys_nodejs_heap_size_total_bytes` - Tamanho total do heap
- `baileys_nodejs_heap_size_used_bytes` - Heap usado
- `baileys_nodejs_external_memory_bytes` - Memória externa
- `baileys_nodejs_heap_space_size_total_bytes` - Tamanho de heap spaces
- `baileys_nodejs_heap_space_size_used_bytes` - Heap spaces usado
- `baileys_nodejs_version_info` - Versão do Node.js
- `baileys_nodejs_gc_duration_seconds` - Duração do garbage collector
- `baileys_nodejs_eventloop_lag_seconds` - Lag do event loop
- `baileys_process_cpu_user_seconds_total` - CPU user time
- `baileys_process_cpu_system_seconds_total` - CPU system time
- `baileys_process_cpu_seconds_total` - CPU total time
- `baileys_process_start_time_seconds` - Timestamp de início do processo
- `baileys_process_resident_memory_bytes` - RSS memory

---

## 🚀 Quick Start

### 1. Habilitar Prometheus no Z-PRO

**Arquivo `.env`**:
```bash
# Habilitar Prometheus
BAILEYS_PROMETHEUS_ENABLED=true
BAILEYS_PROMETHEUS_PORT=9090
BAILEYS_PROMETHEUS_PREFIX=zpro_baileys_

# Labels para identificar o ambiente
BAILEYS_PROMETHEUS_LABELS={"environment":"production","service":"zpro-backend","version":"1.0.0"}
```

### 2. Reiniciar Backend
```bash
pm2 restart zpro-backend
```

### 3. Verificar Métricas
```bash
# Acessar endpoint de métricas
curl http://localhost:9090/metrics

# Verificar se servidor está rodando
pm2 logs zpro-backend | grep "prometheus"
```

**Esperado**:
```
[info] prometheus metrics enabled { port: 9090, path: '/metrics', prefix: 'zpro_baileys_' }
[info] prometheus metrics server started { port: 9090, path: '/metrics' }
```

### 4. Testar Métricas
```bash
# Ver métricas de buffer
curl http://localhost:9090/metrics | grep buffer_flush

# Ver métricas de conexão
curl http://localhost:9090/metrics | grep connection_state

# Ver métricas de memória
curl http://localhost:9090/metrics | grep memory_usage
```

---

## 📈 Configuração do Prometheus Server

### prometheus.yml
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'zpro-baileys'
    static_configs:
      - targets: ['localhost:9090']
        labels:
          service: 'zpro-backend'
          environment: 'production'

    # Scrape interval específico (opcional)
    scrape_interval: 10s
    scrape_timeout: 5s

    # Relabeling (opcional)
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'zpro-backend-1'
```

### Iniciar Prometheus
```bash
# Docker
docker run -d \
  --name prometheus \
  -p 9091:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Acessar interface
open http://localhost:9091
```

---

## 📊 Dashboards Grafana

### Importar Dashboard Pronto

1. **Acesse Grafana**: `http://localhost:3000`
2. **Menu lateral** → Dashboards → Import
3. **Upload JSON file**: Use os arquivos em `docs/improvements/grafana/`
   - `buffer-performance.json` - Performance do Buffer
   - `adaptive-algorithm.json` - Algoritmo Adaptativo
   - `connection-health.json` - Saúde das Conexões
   - `message-throughput.json` - Throughput de Mensagens
4. **Selecione datasource**: Prometheus
5. **Import**

### Dashboards Disponíveis

#### 1️⃣ **Buffer Performance Dashboard**
- Flush rate (flushes/min)
- Flush duration (P50, P95, P99)
- Buffer overflow alerts
- Cache size trend
- Items flushed/sec

#### 2️⃣ **Adaptive Algorithm Dashboard**
- Timeout evolution (timeline)
- Mode distribution (pie chart)
- Event rate vs timeout (correlation)
- Circuit breaker status
- Health status

#### 3️⃣ **Connection Health Dashboard**
- Active connections
- Connection state distribution
- Error rate by type
- Reconnection attempts
- WebSocket listeners

#### 4️⃣ **Message Throughput Dashboard**
- Messages received/sent per second
- Message type distribution
- Retry rate
- Processing latency
- Success rate

---

## ⚠️ Alertas Recomendados

### Alertas Críticos

```yaml
groups:
  - name: baileys_critical
    interval: 1m
    rules:
      # Buffer overflow
      - alert: BufferOverflow
        expr: rate(baileys_buffer_overflow_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Buffer overflow - increase BAILEYS_BUFFER_MAX_ITEMS"

      # Circuit breaker
      - alert: CircuitBreakerTripped
        expr: increase(baileys_adaptive_circuit_breaker_trips_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Adaptive flush circuit breaker triggered"

      # WebSocket listener leak
      - alert: ListenerLeak
        expr: baileys_websocket_listeners_total > 30
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "WebSocket listener leak - {{ $value }} listeners"

      # Memory leak
      - alert: MemoryLeak
        expr: rate(baileys_memory_usage_bytes{type="heapUsed"}[10m]) > 1048576
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Possible memory leak detected"

      # Alta taxa de reconexão
      - alert: HighReconnectionRate
        expr: rate(baileys_reconnection_attempts_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High reconnection rate - network instability"

      # Flush lento
      - alert: SlowFlush
        expr: histogram_quantile(0.95, rate(baileys_buffer_flush_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "95% of flushes taking more than 2 seconds"
```

---

## 🧪 Testes

### Validar Métricas Funcionando

```bash
# 1. Verificar se servidor Prometheus está rodando
curl http://localhost:9090/metrics

# 2. Verificar métricas específicas
curl http://localhost:9090/metrics | grep baileys_buffer_flush_total

# 3. Verificar labels customizados
curl http://localhost:9090/metrics | grep environment

# 4. Monitorar logs em tempo real
pm2 logs zpro-backend | grep prometheus
```

### Testar Alertas

```bash
# Simular buffer overflow (enviar muitas mensagens rapidamente)
# Ver se métrica baileys_buffer_overflow_total incrementa

# Simular circuit breaker (forçar flushes lentos)
# Ver se baileys_adaptive_circuit_breaker_trips_total incrementa
```

---

## 🔧 Troubleshooting

### Problema 1: Porta 9090 já em uso

**Erro**:
```
[error] prometheus metrics port already in use { port: 9090 }
```

**Solução**:
```bash
# Usar porta diferente
BAILEYS_PROMETHEUS_PORT=9091
```

### Problema 2: Métricas não aparecem

**Checklist**:
1. ✅ `BAILEYS_PROMETHEUS_ENABLED=true` está configurado?
2. ✅ Servidor Prometheus está rodando? (`curl http://localhost:9090/metrics`)
3. ✅ Logs mostram "prometheus metrics enabled"?
4. ✅ Firewall bloqueando porta 9090?

**Debug**:
```bash
# Ver se servidor está listening
netstat -an | grep 9090

# Ver logs do Prometheus
pm2 logs zpro-backend --lines 100 | grep prometheus
```

### Problema 3: Métricas zeradas

**Causa**: Prometheus precisa de tempo para coletar dados (scrape_interval)

**Solução**: Aguardar 15-30 segundos após iniciar o sistema

---

## 📚 Referências

- **Prometheus Documentation**: https://prometheus.io/docs/
- **prom-client (Node.js)**: https://github.com/siimon/prom-client
- **Grafana Dashboards**: https://grafana.com/docs/grafana/latest/dashboards/
- **PromQL Queries**: https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Best Practices**: https://prometheus.io/docs/practices/naming/

---

## 🎉 Benefícios

1. ✅ **Observabilidade completa** - 30+ métricas de produção
2. ✅ **Zero overhead** quando desabilitado
3. ✅ **Padrão de mercado** - Usado por Netflix, Uber, Google
4. ✅ **Alertas proativos** - Detectar problemas antes de crash
5. ✅ **Debugging facilitado** - Correlação de métricas
6. ✅ **Capacidade de planejamento** - Dados para scaling decisions
7. ✅ **SLA monitoring** - Medir uptime, latência, throughput
8. ✅ **Dashboards prontos** - Visualização imediata
9. ✅ **Multi-tenant ready** - Labels customizados
10. ✅ **Integração fácil** - Apenas variáveis de ambiente

---

## 📞 Suporte

Para dúvidas sobre integração Prometheus:
- Consulte esta documentação
- Verifique os dashboards Grafana prontos
- Teste queries PromQL de exemplo
- Analise logs com `BAILEYS_LOG=true`

**Lembre-se**: Prometheus é **opt-in** (desabilitado por padrão). Habilite apenas quando precisar de monitoramento de produção.
