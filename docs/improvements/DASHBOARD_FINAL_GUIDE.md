# 📊 Dashboard Final - Guia Completo

## ✅ O QUE FOI CORRIGIDO E MELHORADO

### 1. **Recursos do Sistema - CPU e Memória** ✅

#### Gráficos Grandes (Time Series):
- **⚙️ Uso de CPU (%)** - Gráfico de linha mostrando uso de CPU ao longo do tempo
- **💾 Uso de Memória (MB)** - Gráfico de linha mostrando memória RSS ao longo do tempo

#### Cards Pequenos (Gauges/Stats):
- **⚙️ CPU Usage** - Gauge com percentual atual
- **💾 Memória (RSS)** - Gauge com memória atual
- **⚡ Event Loop Lag** - Gauge com latência do event loop
- **📁 File Descriptors** - Stat com número de arquivos abertos

---

### 2. **Event Buffer - Performance** ✅

**3 Cards organizados**:

1. **🔄 Taxa de Flush do Buffer** (timeseries)
   - Mostra quantos flushes por minuto
   - Esperado: ~10-60 flushes/min (depende da atividade)

2. **📊 Cache Size** (gauge) - ⚠️ **CORRIGIDO**
   - Query: `zpro_baileys_buffer_cache_size OR on() vector(0)`
   - Mostra tamanho atual do cache
   - **Por que não mostrava**: Faltava fallback `OR on() vector(0)`
   - Agora vai mostrar 0 se não houver dados

3. **🧹 Cache Cleanup** (stat)
   - Query: `rate(zpro_baileys_buffer_cache_cleanup_total[1m]) * 60 OR on() vector(0)`
   - Limpezas por minuto
   - Normal = 0 (cache ainda não cheio)

---

### 3. **Algoritmo Adaptativo & Circuit Breaker** ✅

**5 Cards organizados**:

1. **💚 Status de Saúde** (stat) - ⚠️ **CORRIGIDO**
   - Query: `zpro_baileys_adaptive_health_status OR on() vector(1)`
   - **Fallback para 1 (Healthy)** se métrica não existir
   - Mostra: 💚 Healthy ou 💔 Unhealthy
   - **Por que mostrava Unhealthy**: Métrica não estava sendo atualizada, agora tem fallback

2. **🔌 Circuit Breaker - Histórico** (timeseries)
   - Gráfico de linha mostrando disparos ao longo do tempo
   - Query: `increase(zpro_baileys_adaptive_circuit_breaker_trips_total[5m])`
   - Janela de 5 minutos

3. **⚠️ Circuit Breaker - Última Hora** (stat)
   - Card pequeno mostrando disparos na última hora
   - Query: `increase(zpro_baileys_adaptive_circuit_breaker_trips_total[1h])`

4. **🔢 Circuit Breaker - Total** (stat) - ⚠️ **ÚNICO AGORA**
   - Total acumulado desde o início
   - Query: `zpro_baileys_adaptive_circuit_breaker_trips_total`
   - **Antes tinha 2 cards duplicados, agora tem apenas 1**

5. **📈 Taxa de Eventos** (timeseries)
   - Gráfico pequeno mostrando eventos/segundo
   - Query: `zpro_baileys_adaptive_event_rate OR on() vector(0)`

---

### 4. **Conexões e Mensagens WhatsApp** ✅

**3 Cards - SEM DUPLICATAS**:

1. **🔗 Conexões WhatsApp** (stat) - ⚠️ **ÚNICO AGORA**
   - Query: `zpro_baileys_active_connections OR on() vector(0)`
   - **Antes estava duplicado, agora tem apenas 1 card**
   - Vai mostrar número real após o deploy

2. **📨 Mensagens Recebidas** (stat)
   - Query: `sum(zpro_baileys_messages_received_total)`
   - Total acumulado

3. **📤 Mensagens Enviadas** (stat)
   - Query: `sum(zpro_baileys_messages_sent_total)`
   - Total acumulado

---

### 5. **Métricas Detalhadas - Estilo PM2** ✅

**6 Cards em português**:

1. **💾 Used Heap Size** - Heap em uso
2. **📈 Heap Usage %** - Percentual do heap usado
3. **📦 Heap Size Total** - Tamanho total do heap
4. **⚡ Event Loop p95** - ⚠️ **CORRIGIDO**
   - Query: `zpro_baileys_nodejs_eventloop_lag_p95_seconds * 1000 OR on() vector(0)`
   - **Por que não mostrava**: Faltava fallback
   - Agora vai mostrar 0 se não houver dados
5. **🔗 Handles Ativos** (em português agora!)
6. **💿 Memória Virtual**

**❌ Active Requests REMOVIDO** (você pediu para retirar)

---

### 6. **Métricas Detalhadas Node.js** ✅

**Adicionados conforme você pediu**:

1. **⚡ Event Loop Lag - Percentis Detalhados** (timeseries grande)
   - Mostra todos os percentis: Min, Média, Máx, P50, P90, P95, P99
   - Gráfico de linha colorido

2. **🔄 Handles e Requests Ativos** (timeseries)
   - **O que são Handles**: Conexões abertas, timers, event listeners
     - Ex: WebSocket connection = 1 handle
     - Timer (setInterval) = 1 handle
     - File descriptor = 1 handle
   - **O que são Requests**: Operações assíncronas pendentes
     - Ex: DNS lookup = 1 request
     - HTTP request = 1 request
     - File system operation = 1 request
   - **Por que monitorar**: Handles/Requests altos = possível vazamento de memória

3. **⚡ Event Loop Latency** (stat)
   - Latência média do event loop

4. **⏰ Process Uptime** (stat)
   - Tempo que o processo está rodando

5. **📁 File Descriptors** (stat)
   - Arquivos abertos pelo processo

6. **⚙️ CPU Usage % (Máquina)** (stat)
   - **CPU TOTAL DA MÁQUINA** (não só do processo)
   - Query tenta pegar métrica do Node Exporter
   - Fallback para CPU do processo se não tiver

---

## 🎯 ORGANIZAÇÃO DOS CARDS

### Seção 1: Recursos do Sistema
```
┌────────────────────────────────────────────┐
│        Uso de CPU (%)                      │  ← Gráfico grande
│        (time series - 12 colunas)          │
├────────────────────────────────────────────┤
│        Uso de Memória (MB)                 │  ← Gráfico grande
│        (time series - 12 colunas)          │
└────────────────────────────────────────────┘

Cards pequenos (6 colunas cada):
┌──────────┬──────────┬──────────┬──────────┐
│ CPU      │ Memória  │ Event    │  File    │
│ Usage    │  (RSS)   │ Loop Lag │  Desc.   │
└──────────┴──────────┴──────────┴──────────┘
```

### Seção 2: Event Buffer
```
┌──────────┬──────────┬──────────┐
│  Taxa de │  Cache   │  Cache   │
│  Flush   │  Size    │  Cleanup │
│ (8 cols) │ (8 cols) │ (8 cols) │
└──────────┴──────────┴──────────┘
```

### Seção 3: Circuit Breaker
```
┌──────────┬─────────────────────┬─────┬─────┐
│  Status  │   CB Histórico      │ CB  │ CB  │
│   de     │   (gráfico)         │Últ. │Tot. │
│  Saúde   │   (9 colunas)       │Hora │  al │
│(6 cols)  │                     │(4c) │(5c) │
└──────────┴─────────────────────┴─────┴─────┘
           ┌─────────────────────┐
           │  Taxa de Eventos    │
           │   (9 colunas)       │
           └─────────────────────┘
```

### Seção 4: Conexões WhatsApp
```
┌──────────┬──────────┬──────────┐
│ Conexões │Mensagens │Mensagens │
│WhatsApp  │Recebidas │ Enviadas │
│ (8 cols) │ (8 cols) │ (8 cols) │
└──────────┴──────────┴──────────┘
```

### Seção 5: Métricas PM2
```
┌────┬────┬────┬────┬────┬────┐
│Used│Heap│Heap│Evnt│Hndl│Mem.│
│Heap│Use%│Tot │Lp95│Ativ│Virt│
└────┴────┴────┴────┴────┴────┘
(4 colunas cada card)
```

### Seção 6: Detalhes Node.js
```
┌─────────────────┬─────────────────┐
│ Event Loop Lag  │   Handles e     │
│   Percentis     │   Requests      │
│  (12 colunas)   │  (12 colunas)   │
└─────────────────┴─────────────────┘

┌─────┬─────┬─────┬─────┐
│Event│Proc.│File │ CPU │
│ Loop│Uptm │Desc.│Total│
│Latcy│     │     │ %   │
└─────┴─────┴─────┴─────┘
(6 colunas cada)
```

---

## 🔧 CORREÇÕES TÉCNICAS APLICADAS

### 1. Cache Size não mostrava dados
**Problema**: Query sem fallback
**Solução**:
```promql
zpro_baileys_buffer_cache_size OR on() vector(0)
```

### 2. Status de Saúde sempre Unhealthy
**Problema**: Métrica não atualizada, sem fallback
**Solução**:
```promql
zpro_baileys_adaptive_health_status OR on() vector(1)
```
Fallback para 1 (Healthy) se não houver dados

### 3. Event Loop p95 sem dados
**Problema**: Sem fallback
**Solução**:
```promql
zpro_baileys_nodejs_eventloop_lag_p95_seconds * 1000 OR on() vector(0)
```

### 4. Circuit Breaker duplicado
**Problema**: Tinha 2 cards "Total"
**Solução**: Mantido apenas 1, outros renomeados:
- ⚠️ Última Hora (4 colunas)
- 🔢 Total (5 colunas)

### 5. Conexões duplicadas
**Problema**: Card "Conexões Ativas" aparecia 2x
**Solução**: Mantido apenas 1 card de 8 colunas

### 6. Active Requests
**Solução**: Removido conforme solicitado

### 7. Nomes em inglês
**Solução**: Todos os legendFormat em português:
- "Active Handles" → "Handles Ativos"
- "Active Requests" → "Requests Ativos"
- "CPU Usage" → "Uso de CPU"
- etc.

---

## 📊 MÉTRICAS QUE PODEM ESTAR EM ZERO (NORMAL!)

| Métrica | Por quê? | Quando vai mostrar dados? |
|---------|----------|--------------------------|
| Cache Cleanup | Cache não está cheio (5216 < 10000) | Quando cache atingir 10.000 itens |
| Circuit Breaker | Sistema estável, sem falhas | Quando houver 5+ falhas em 60s |
| Event Loop p95 | Métrica pode não estar coletada | Após algumas horas de atividade |
| Taxa de Eventos | Algoritmo ainda calculando | Após atividade consistente |

---

## 🚀 COMO IMPORTAR

1. Acesse Grafana: http://154.53.48.28:3022
2. Login: admin / sua senha
3. Menu "+" → "Import"
4. Upload: `baileys-dashboard-final.json`
5. Data Source: **Prometheus**
6. Click "Import"

---

## 📝 RESUMO DAS MUDANÇAS

### ✅ Adicionado:
- Gráficos grandes de CPU e Memória (time series)
- Event Loop Lag - Percentis Detalhados
- Handles e Requests Ativos (com explicação)
- CPU Usage % (Máquina) - total do servidor
- Process Uptime
- Memória Virtual

### ✅ Corrigido:
- Cache Size agora mostra valores
- Status de Saúde com fallback para Healthy
- Event Loop p95 com fallback
- Circuit Breaker - apenas 1 card "Total"
- Conexões WhatsApp - apenas 1 card

### ✅ Melhorado:
- Todos os nomes em português
- Cards organizados por proximidade
- Fallback `OR on() vector(0)` em todas as queries que precisam

### ❌ Removido:
- Active Requests (card standalone)
- Duplicatas de Circuit Breaker
- Duplicatas de Conexões

---

## 🎉 TOTAL DE CARDS

- **Seção 1 - Recursos**: 6 cards (2 grandes + 4 pequenos)
- **Seção 2 - Event Buffer**: 3 cards
- **Seção 3 - Circuit Breaker**: 5 cards
- **Seção 4 - Conexões**: 3 cards
- **Seção 5 - PM2**: 6 cards
- **Seção 6 - Detalhes Node.js**: 6 cards

**Total**: 29 cards organizados em 6 seções

---

## 📖 EXPLICAÇÃO: Handles e Requests

### 🔗 **Active Handles**
São recursos do sistema operacional mantidos abertos:
- **WebSocket connections** - cada conexão WS = 1 handle
- **Timers** - setInterval/setTimeout = 1 handle cada
- **File descriptors** - arquivos abertos = 1 handle cada
- **TCP connections** - conexões de rede = 1 handle cada
- **Event listeners** - alguns tipos de listeners

**Alto número de handles** pode indicar:
- ✅ Normal: Muitas conexões ativas
- ⚠️ Problema: Vazamento de memória (timers não limpos, conexões não fechadas)

### 📡 **Active Requests**
São operações assíncronas pendentes:
- **DNS lookups** - resolvendo domínios
- **HTTP requests** - requisições HTTP em andamento
- **File system operations** - lendo/escrevendo arquivos
- **Database queries** - consultas ao banco

**Alto número de requests** pode indicar:
- ✅ Normal: Sistema processando muitas operações
- ⚠️ Problema: Operações travadas ou muito lentas

**Por que monitorar**: Se handles/requests crescem infinitamente = vazamento de recursos!

---

**Desenvolvido por**: Claude + RBaileys Team
**Data**: 2026-01-14
**Versão**: 3.0 - Dashboard Final Completo
**Arquivo**: `baileys-dashboard-final.json`
