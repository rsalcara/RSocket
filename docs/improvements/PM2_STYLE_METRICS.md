# 📊 Métricas Estilo PM2 - Dashboard Grafana

## ✅ TODAS as Métricas PM2 Disponíveis no Prometheus

Este documento mapeia todas as métricas que você vê no `pm2 monit` e mostra como visualizá-las no Grafana.

---

## 📋 Mapeamento Completo: PM2 → Prometheus

| Métrica PM2 | Métrica Prometheus | Query PromQL | Status |
|-------------|-------------------|--------------|--------|
| **Used Heap Size** | `zpro_baileys_nodejs_heap_size_used_bytes` | `zpro_baileys_nodejs_heap_size_used_bytes` | ✅ |
| **Heap Usage %** | Calculado | `(zpro_baileys_nodejs_heap_size_used_bytes / zpro_baileys_nodejs_heap_size_total_bytes) * 100` | ✅ |
| **Heap Size (Total)** | `zpro_baileys_nodejs_heap_size_total_bytes` | `zpro_baileys_nodejs_heap_size_total_bytes` | ✅ |
| **Event Loop Latency** | `zpro_baileys_nodejs_eventloop_lag_mean_seconds` | `zpro_baileys_nodejs_eventloop_lag_mean_seconds * 1000` | ✅ |
| **Event Loop Latency p95** | `zpro_baileys_nodejs_eventloop_lag_p95_seconds` | `zpro_baileys_nodejs_eventloop_lag_p95_seconds * 1000` | ✅ |
| **Active Handles** | `zpro_baileys_nodejs_active_handles` | `zpro_baileys_nodejs_active_handles` | ✅ |
| **Active Requests** | `zpro_baileys_nodejs_active_requests` | `zpro_baileys_nodejs_active_requests` | ✅ |
| **Memory (RSS)** | `zpro_baileys_process_resident_memory_bytes` | `zpro_baileys_process_resident_memory_bytes` | ✅ |
| **CPU %** | Calculado | `rate(zpro_baileys_process_cpu_seconds_total[1m]) * 100` | ✅ |
| **Files count** | `zpro_baileys_process_open_fds` | `zpro_baileys_process_open_fds` | ✅ |
| **Process Uptime** | Calculado | `time() - zpro_baileys_process_start_time_seconds` | ✅ |
| **Virtual Memory** | `zpro_baileys_process_virtual_memory_bytes` | `zpro_baileys_process_virtual_memory_bytes` | ✅ |

---

## 🎨 Nova Seção no Dashboard

Adicionei uma nova seção chamada **"📊 Painel PM2 Style - Métricas Heap e Node.js"** que contém 12 painéis em formato de cards (estilo PM2 monit):

### Painéis Incluídos:

1. **💾 Used Heap Size** - Memória heap em uso
2. **📈 Heap Usage %** - Percentual de uso do heap (calculado)
3. **📦 Heap Size (Total)** - Tamanho total do heap alocado
4. **⚡ Event Loop Latency** - Latência média do event loop
5. **⚡ Event Loop Latency p95** - Latência do event loop no percentil 95
6. **🔗 Active Handles** - Handles ativos no Node.js
7. **📡 Active Requests** - Requisições ativas
8. **💾 Memória (RSS)** - Memória residente do processo
9. **⚙️ CPU Usage %** - Uso de CPU em percentual
10. **💿 Memória Virtual** - Memória virtual do processo
11. **⏰ Process Uptime** - Tempo que o processo está rodando
12. **📁 File Descriptors** - Arquivos abertos (equivalente ao "Files count")

---

## 🎯 Como os Valores se Comparam

### Exemplo do seu PM2 Monit:

```
Used Heap Size:           12.39 MiB  →  ~12,990,000 bytes
Heap Usage:               91.06 %    →  91.06%
Heap Size:                13.90 MiB  →  ~14,577,000 bytes
Event Loop Latency:       0.64 ms    →  0.64 ms
Event Loop Latency p95:   1.75 ms    →  1.75 ms
Active handles:           4          →  4
Active requests:          0          →  0
Memory (RSS):             444 MB     →  ~465,567,000 bytes
CPU:                      1 %        →  1%
Files count:              19         →  19
```

### No Grafana você verá:

- **Used Heap Size**: `12.39 MB` (formato automático)
- **Heap Usage %**: `91.06%` (calculado em tempo real)
- **Heap Size**: `13.90 MB`
- **Event Loop Latency**: `0.64 ms`
- **Event Loop p95**: `1.75 ms`
- **Active Handles**: `4`
- **Active Requests**: `0`
- **Memória (RSS)**: `444 MB`
- **CPU Usage %**: `1.0%`
- **File Descriptors**: `19`

---

## 🔍 Cores dos Indicadores

Cada métrica tem thresholds (limites) configurados com cores:

### Used Heap Size
- 🟢 Verde: < 50 MB
- 🟡 Amarelo: 50-100 MB
- 🔴 Vermelho: > 100 MB

### Heap Usage %
- 🟢 Verde: < 70%
- 🟡 Amarelo: 70-90%
- 🔴 Vermelho: > 90%

### Event Loop Latency
- 🟢 Verde: < 10 ms
- 🟡 Amarelo: 10-50 ms
- 🔴 Vermelho: > 50 ms

### Event Loop Latency p95
- 🟢 Verde: < 20 ms
- 🟡 Amarelo: 20-100 ms
- 🔴 Vermelho: > 100 ms

### Active Handles
- 🟢 Verde: < 100
- 🟡 Amarelo: 100-500
- 🔴 Vermelho: > 500

### Active Requests
- 🟢 Verde: < 50
- 🟡 Amarelo: 50-200
- 🔴 Vermelho: > 200

### Memória (RSS)
- 🟢 Verde: < 500 MB
- 🟡 Amarelo: 500 MB - 1 GB
- 🔴 Vermelho: > 1 GB

### CPU Usage %
- 🟢 Verde: < 50%
- 🟡 Amarelo: 50-80%
- 🔴 Vermelho: > 80%

### File Descriptors
- 🟢 Verde: < 500
- 🟡 Amarelo: 500-1000
- 🔴 Vermelho: > 1000

---

## 📊 Visualização no Dashboard

Os painéis estão organizados em **2 linhas**:

### Linha 1 (6 painéis):
```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Used Heap    │ Heap Usage % │ Heap Size    │ Event Loop   │ Event Loop   │ Active       │
│ Size         │              │ (Total)      │ Latency      │ Latency p95  │ Handles      │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### Linha 2 (6 painéis):
```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Active       │ Memória      │ CPU Usage %  │ Memória      │ Process      │ File         │
│ Requests     │ (RSS)        │              │ Virtual      │ Uptime       │ Descriptors  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

Cada painel mostra:
- ✅ **Valor atual** em destaque
- ✅ **Nome da métrica** (em português)
- ✅ **Cor de fundo** baseada no threshold
- ✅ **Mini gráfico** de tendência (area chart)

---

## 🚀 Como Importar no Grafana

O dashboard atualizado já está em:
```
C:\github\RBaileys\docs\improvements\grafana\baileys-dashboard-pt-br.json
```

### Passos:

1. **Acessar Grafana**: http://154.53.48.28:3022
2. **Login**: admin / sua senha
3. **Menu "+"** → **"Import"**
4. **Upload JSON**: Selecionar `baileys-dashboard-pt-br.json`
5. **Data Source**: Selecionar **Prometheus**
6. **Click "Import"**

---

## 📈 Métricas Adicionais Disponíveis

Além das métricas do PM2, você também tem:

### Percentis Detalhados do Event Loop:
- `zpro_baileys_nodejs_eventloop_lag_min_seconds` - Mínimo
- `zpro_baileys_nodejs_eventloop_lag_mean_seconds` - Média
- `zpro_baileys_nodejs_eventloop_lag_max_seconds` - Máximo
- `zpro_baileys_nodejs_eventloop_lag_p50_seconds` - Percentil 50 (mediana)
- `zpro_baileys_nodejs_eventloop_lag_p90_seconds` - Percentil 90
- `zpro_baileys_nodejs_eventloop_lag_p99_seconds` - Percentil 99

### Memória Detalhada:
- `zpro_baileys_nodejs_heap_size_used_bytes` - Heap usado
- `zpro_baileys_nodejs_heap_size_total_bytes` - Heap total
- `zpro_baileys_nodejs_external_memory_bytes` - Memória externa
- `zpro_baileys_process_resident_memory_bytes` - RSS
- `zpro_baileys_process_virtual_memory_bytes` - Virtual
- `zpro_baileys_process_heap_bytes` - Heap do processo

### CPU Detalhada:
- `zpro_baileys_process_cpu_user_seconds_total` - Tempo de CPU em user mode
- `zpro_baileys_process_cpu_system_seconds_total` - Tempo de CPU em system mode
- `zpro_baileys_process_cpu_seconds_total` - Total

---

## 🎯 Queries PromQL Úteis

### Ver tendência de uso de memória (últimas 24h):
```promql
zpro_baileys_process_resident_memory_bytes[24h]
```

### Ver picos de CPU (últimos 5 minutos):
```promql
max_over_time(rate(zpro_baileys_process_cpu_seconds_total[1m])[5m:]) * 100
```

### Ver se o Event Loop está congestionado:
```promql
zpro_baileys_nodejs_eventloop_lag_p99_seconds * 1000 > 100
```

### Alertar se memória > 1GB:
```promql
zpro_baileys_process_resident_memory_bytes > 1000000000
```

### Ver quantos handles vazaram (crescimento):
```promql
deriv(zpro_baileys_nodejs_active_handles[5m]) > 0
```

---

## ✅ Comparação Final: PM2 vs Grafana

| Recurso | PM2 Monit | Grafana Dashboard |
|---------|-----------|-------------------|
| **Visualização em tempo real** | ✅ | ✅ |
| **Histórico** | ❌ | ✅ (infinito) |
| **Alertas** | ❌ | ✅ |
| **Múltiplas instâncias** | ✅ | ✅ |
| **Exportar dados** | ❌ | ✅ |
| **Painéis customizados** | ❌ | ✅ |
| **Português** | ❌ | ✅ |
| **Acesso remoto** | ❌ | ✅ |
| **Queries avançadas** | ❌ | ✅ |
| **Correlação de eventos** | ❌ | ✅ |

---

## 📞 Troubleshooting

### Métricas não aparecem no Grafana?

1. **Verificar se Prometheus está coletando**:
   ```bash
   curl -s http://localhost:9092/metrics | grep nodejs_heap_size_used_bytes
   ```

2. **Verificar se Prometheus está fazendo scrape**:
   - Acessar: http://154.53.48.28:9090/targets
   - Target "rbaileys" deve estar **UP**

3. **Verificar no Grafana Explorer**:
   - Menu → Explore
   - Testar query: `zpro_baileys_nodejs_heap_size_used_bytes`

### Valores diferentes entre PM2 e Grafana?

- PM2 atualiza instantaneamente
- Prometheus coleta a cada 15 segundos (configurado no scrape_interval)
- Pode haver atraso de até 15 segundos

---

## 🎉 Resultado Final

Agora você tem um dashboard Grafana que replica **TODAS** as métricas do `pm2 monit`, com:

✅ **12 painéis** no estilo PM2
✅ **Nomes em português**
✅ **Cores de alerta** (verde, amarelo, vermelho)
✅ **Histórico ilimitado**
✅ **Gráficos de tendência**
✅ **Acesso via web**
✅ **Suporte a múltiplas instâncias**

**Dashboard**: "Monitoramento Completo (Português)"
**Arquivo**: `baileys-dashboard-pt-br.json`

---

**Desenvolvido por**: Claude + RBaileys Team
**Data**: 2026-01-14
**Versão**: 2.0 - PM2 Style Metrics
