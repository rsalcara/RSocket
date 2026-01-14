# 🔧 Correção: Conflito de Porta Prometheus

## ❌ Problema Identificado

```json
{"level":50,"time":"2026-01-13T21:05:24.675Z","port":9090,"msg":"prometheus metrics port already in use"}
```

A porta **9090** já está em uso por outro processo, impedindo o RBaileys de iniciar o servidor de métricas.

---

## ✅ Solução Rápida (5 minutos)

### Passo 1: Editar o arquivo `.env` do backend

```bash
# Conecte no servidor e edite o .env
cd /home/deployzdg/zpro.io/backend
nano .env
```

### Passo 2: Adicionar/Modificar as variáveis Prometheus

Adicione estas linhas no **final do arquivo .env**:

```bash
# Prometheus Metrics Configuration
BAILEYS_PROMETHEUS_ENABLED=true
BAILEYS_PROMETHEUS_PORT=9092
BAILEYS_PROMETHEUS_PATH=/metrics
BAILEYS_PROMETHEUS_PREFIX=zpro_baileys_
BAILEYS_PROMETHEUS_LABELS={"environment":"production","service":"zpro"}
BAILEYS_PROMETHEUS_COLLECT_DEFAULT=true
```

**IMPORTANTE**: Mudamos a porta de `9090` para `9092` para evitar conflito!

Salve o arquivo:
- `Ctrl + O` (salvar)
- `Enter` (confirmar)
- `Ctrl + X` (sair)

---

### Passo 3: Reiniciar o backend

```bash
pm2 restart zpro-backend
```

Aguarde 5 segundos e verifique os logs:

```bash
pm2 logs zpro-backend --lines 20 | grep -i prometheus
```

**Saída esperada** ✅:
```json
{"level":30,"msg":"prometheus metrics enabled on port 9092"}
{"level":30,"msg":"prometheus http server started","port":9092,"path":"/metrics"}
```

---

### Passo 4: Testar o endpoint de métricas

```bash
curl http://localhost:9092/metrics | head -20
```

**Saída esperada** ✅ (primeiras linhas):
```
# HELP zpro_baileys_buffer_flush_total Total number of buffer flushes
# TYPE zpro_baileys_buffer_flush_total counter
zpro_baileys_buffer_flush_total{mode="standard",environment="production",service="zpro"} 0

# HELP zpro_baileys_connection_state Current connection state (0=disconnected, 1=connecting, 2=connected)
# TYPE zpro_baileys_connection_state gauge
zpro_baileys_connection_state{environment="production",service="zpro"} 2
```

Se aparecer métricas com prefixo `zpro_baileys_*`, está funcionando! 🎉

---

### Passo 5: Atualizar configuração do Prometheus

Edite o arquivo de configuração do Prometheus:

```bash
# Se Prometheus está em Docker
cd /home/deployzdg/zpro.io/prometheus
nano prometheus.yml

# Se está em outro lugar, use:
# find /home/deployzdg -name "prometheus.yml" 2>/dev/null
```

Adicione ou modifique o job do RBaileys:

```yaml
scrape_configs:
  # Job existente do Prometheus
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9091']

  # ADICIONE ESTE JOB para RBaileys
  - job_name: 'rbaileys'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9092']  # PORTA CORRETA: 9092
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'zpro-backend'
```

Salve o arquivo (`Ctrl + O`, `Enter`, `Ctrl + X`)

---

### Passo 6: Reiniciar o Prometheus

```bash
# Se Prometheus está em Docker
cd /home/deployzdg/zpro.io
docker-compose restart prometheus

# Se Prometheus está instalado diretamente
sudo systemctl restart prometheus
```

---

### Passo 7: Verificar targets no Prometheus

Abra o navegador e acesse:

```
http://SEU_IP_SERVIDOR:9091/targets
```

Você deve ver **2 targets**:
1. ✅ **prometheus** (up) - localhost:9091
2. ✅ **rbaileys** (up) - localhost:9092

Se o target `rbaileys` estiver **DOWN**, verifique:
- Backend está rodando? `pm2 list`
- Porta 9092 está aberta? `curl http://localhost:9092/metrics`

---

## 🧪 Testando as Métricas no Prometheus

Acesse a interface do Prometheus:

```
http://SEU_IP_SERVIDOR:9091
```

Digite estas queries para testar:

### Teste 1: Verificar se métricas existem
```promql
{__name__=~"zpro_baileys_.*"}
```

**Resultado esperado**: Lista de todas as métricas do RBaileys

---

### Teste 2: Estado da conexão
```promql
zpro_baileys_connection_state
```

**Resultado esperado**: Valor `2` (connected) ou `1` (connecting)

---

### Teste 3: Taxa de flush do buffer
```promql
rate(zpro_baileys_buffer_flush_total[5m])
```

**Resultado esperado**: Gráfico mostrando flushes por segundo

---

### Teste 4: Uso de memória
```promql
zpro_baileys_memory_usage_bytes / 1024 / 1024
```

**Resultado esperado**: Uso de memória em MB

---

## 🎨 Importar Dashboard no Grafana

Agora que as métricas estão funcionando, importe o dashboard:

### Passo 1: Acessar Grafana
```
http://SEU_IP_SERVIDOR:3000
```

Login padrão: `admin` / `admin` (troque a senha no primeiro acesso)

---

### Passo 2: Importar Dashboard

1. Clique no menu **"+"** (lado esquerdo)
2. Selecione **"Import"**
3. Clique em **"Upload JSON file"**
4. Selecione o arquivo: `docs/improvements/grafana/baileys-complete-dashboard.json`
5. Selecione o data source: **"Prometheus"**
6. Clique em **"Import"**

---

### Passo 3: Visualizar Dashboard

O dashboard terá **4 seções**:

1. **📊 Buffer Performance**
   - Flush rate
   - Buffer size
   - Overflow events
   - Cache size

2. **🧠 Adaptive Flush Algorithm**
   - Dynamic timeout
   - Event rate
   - Circuit breaker trips
   - System health

3. **🔌 Connection & Messages**
   - Connection state
   - Messages received/sent
   - Retry attempts
   - Processing duration

4. **💾 System & Memory**
   - Memory usage
   - Cache evictions
   - Active connections
   - Uptime

---

## 🚨 Troubleshooting

### Problema: Target DOWN no Prometheus

**Causa**: Backend não está expondo métricas na porta 9092

**Solução**:
```bash
# Verificar logs
pm2 logs zpro-backend --lines 50 | grep -i prometheus

# Testar endpoint diretamente
curl http://localhost:9092/metrics

# Verificar porta em uso
sudo lsof -i :9092
```

---

### Problema: Métricas não aparecem no Prometheus

**Causa**: Prometheus não está fazendo scrape do target

**Solução**:
```bash
# Verificar configuração
cat /home/deployzdg/zpro.io/prometheus/prometheus.yml | grep -A 5 rbaileys

# Verificar logs do Prometheus
docker logs prometheus | tail -20
```

---

### Problema: Dashboard vazio no Grafana

**Causa**: Data source não está configurado ou nome das métricas diferente

**Solução**:
1. Ir em **Configuration** → **Data Sources**
2. Verificar se Prometheus está configurado corretamente
3. URL deve ser: `http://prometheus:9091` (se Docker) ou `http://localhost:9091`
4. Clicar em **"Save & Test"** - deve aparecer ✅ "Data source is working"

---

## 📊 Comandos Úteis

### Verificar se tudo está funcionando
```bash
# Backend expõe métricas?
curl -s http://localhost:9092/metrics | grep zpro_baileys | head -5

# Prometheus está fazendo scrape?
curl -s http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="rbaileys")'

# Quantas métricas existem?
curl -s http://localhost:9092/metrics | grep "^zpro_baileys_" | wc -l
```

### Ver métricas em tempo real
```bash
# Atualiza a cada 2 segundos
watch -n 2 'curl -s http://localhost:9092/metrics | grep zpro_baileys_connection_state'
```

---

## ✅ Checklist de Sucesso

Marque cada item quando estiver funcionando:

- [ ] ENV configurado com `BAILEYS_PROMETHEUS_PORT=9092`
- [ ] Backend reiniciado sem erros de porta
- [ ] Endpoint `http://localhost:9092/metrics` retorna métricas
- [ ] Métricas com prefixo `zpro_baileys_*` aparecem
- [ ] Prometheus tem target `rbaileys` configurado
- [ ] Target `rbaileys` está **UP** no Prometheus
- [ ] Queries PromQL retornam dados
- [ ] Dashboard Grafana importado com sucesso
- [ ] Dashboard mostra dados em tempo real

---

## 📞 Suporte

Se ainda houver problemas após seguir este guia:

1. Execute o script de diagnóstico completo:
```bash
bash scripts/diagnose-prometheus.sh
```

2. Cole a saída completa para análise

---

## 🎯 Resumo da Solução

**Problema**: Porta 9090 ocupada
**Solução**: Usar porta 9092
**Tempo**: ~5 minutos
**Impacto**: Zero (adicionar variáveis ao .env e reiniciar)

**Resultado**: Métricas funcionando perfeitamente! 🚀
