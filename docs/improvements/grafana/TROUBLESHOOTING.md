# 🔧 Troubleshooting - Painéis do Grafana Sem Dados

## Problema: Painéis 111, 112, 113 Não Mostram Dados

Os painéis de **Buffers Destruídos** foram implementados corretamente, mas podem não mostrar dados imediatamente. Aqui está o guia completo de troubleshooting.

---

## ✅ Verificações Necessárias

### 1. Aplicação Foi Reiniciada?

As novas métricas do Prometheus só são registradas quando a aplicação **inicia**. Se você fez deploy do código mas não reiniciou:

```bash
# PM2
pm2 restart zpro-backend
pm2 logs zpro-backend --lines 50

# Ou diretamente
npm start
```

**Procure nos logs:**
```
✅ Prometheus metrics server started on port 3000
```

---

### 2. Prometheus Está Habilitado?

Verifique a configuração do Prometheus no arquivo de configuração:

```typescript
// config/prometheus.ts ou similar
{
  enabled: true,  // ← DEVE SER true
  port: 3000,     // Porta do endpoint /metrics
  prefix: 'zpro_baileys_'
}
```

---

### 3. Endpoint /metrics Está Acessível?

Execute o script de teste:

```bash
cd /path/to/RBaileys
bash scripts/test-buffer-metrics.sh
```

Ou manualmente:

```bash
# Ajuste a porta conforme sua configuração
curl http://localhost:3000/metrics | grep buffer_destroyed
curl http://localhost:3000/metrics | grep buffer_final_flush
curl http://localhost:3000/metrics | grep buffer_active
```

**Saída esperada:**
```prometheus
# HELP zpro_baileys_buffer_destroyed_total Total number of event buffers destroyed (prevents orphaned buffers)
# TYPE zpro_baileys_buffer_destroyed_total counter
zpro_baileys_buffer_destroyed_total{reason="socket_close",had_pending_flush="false"} 0

# HELP zpro_baileys_buffer_final_flush_total Total number of final flushes performed during buffer destruction
# TYPE zpro_baileys_buffer_final_flush_total counter
zpro_baileys_buffer_final_flush_total{items_count="empty"} 0

# HELP zpro_baileys_buffer_active_count Number of currently active event buffers
# TYPE zpro_baileys_buffer_active_count gauge
zpro_baileys_buffer_active_count 2
```

---

### 4. Métricas Estão em 0 (Zero)?

**Isso é NORMAL!**

As métricas são **Counters** que começam em `0` e só incrementam quando eventos acontecem:

- `buffer_destroyed_total` → incrementa quando um socket desconecta
- `buffer_final_flush_total` → incrementa quando há flush final durante destruição
- `buffer_active_count` → mostra número atual de buffers ativos

**Para gerar dados de teste:**
1. Conecte um número de WhatsApp na aplicação
2. Desconecte o número (fecha conexão)
3. O buffer será destruído e as métricas incrementam

---

### 5. Prometheus Está Coletando as Métricas?

Verifique se o Prometheus Server está configurado para coletar métricas da sua aplicação:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'zpro-backend'
    static_configs:
      - targets: ['localhost:3000']  # Ajuste para seu host:porta
```

**Teste no Prometheus UI:**
1. Acesse `http://localhost:9090` (ou sua URL do Prometheus)
2. Digite na query: `zpro_baileys_buffer_destroyed_total`
3. Clique em "Execute"

Se não aparecer nada, o Prometheus não está coletando.

---

### 6. Datasource do Grafana Está Correto?

Os painéis usam o datasource UID `efa2xes2233swf`. Verifique se existe:

**No Grafana:**
1. Vá em Configuration → Data Sources
2. Procure pelo datasource do Prometheus
3. Copie o **UID** correto
4. Se for diferente de `efa2xes2233swf`, você precisa atualizar o dashboard

**Atualizar UID no dashboard:**
```bash
# Edite manualmente
nano docs/improvements/grafana/Dashboard\ Baileys.json

# Ou use sed
sed -i 's/efa2xes2233swf/SEU_UID_AQUI/g' docs/improvements/grafana/Dashboard\ Baileys.json
```

---

## 🐛 Debug Avançado

### Verificar Logs da Aplicação

```bash
# PM2
pm2 logs zpro-backend | grep "destroying event buffer"

# Diretamente
tail -f logs/app.log | grep "buffer"
```

**Procure por:**
```json
{
  "level": "info",
  "msg": "destroying event buffer",
  "buffersInProgress": 1,
  "itemsBuffered": 5,
  "flushCount": 3
}
```

### Verificar Se Código Compilado Está Atualizado

```bash
# Verificar data dos arquivos compilados
ls -lah lib/Utils/event-buffer.js
ls -lah lib/Utils/prometheus-metrics.js

# Procurar pelas chamadas das métricas
grep -n "recordBufferDestroyed" lib/Utils/event-buffer.js
grep -n "recordBufferFinalFlush" lib/Utils/event-buffer.js
```

Se não encontrar as chamadas, recompile:
```bash
npm run build
# ou
npx tsc
```

---

## 📊 Queries de Teste no Grafana

Você pode testar as queries diretamente no Grafana Explore:

1. Vá em **Explore** no menu lateral
2. Selecione o datasource do Prometheus
3. Cole estas queries:

```promql
# Total de buffers destruídos
zpro_baileys_buffer_destroyed_total

# Taxa de destruição por minuto
rate(zpro_baileys_buffer_destroyed_total[5m]) * 60

# Flush final durante destruição
zpro_baileys_buffer_final_flush_total

# Buffers ativos agora
zpro_baileys_buffer_active_count
```

---

## 🆘 Ainda Não Funciona?

Se depois de todas essas verificações ainda não funcionar:

### Checklist Final:

- [ ] Aplicação foi reiniciada após deploy
- [ ] Prometheus está habilitado na config
- [ ] Endpoint /metrics retorna as novas métricas
- [ ] Prometheus Server está coletando (scraping)
- [ ] Datasource UID está correto no dashboard
- [ ] Já houve pelo menos uma desconexão de WhatsApp para gerar dados

### Informações para Suporte:

Cole essas informações para debug:

```bash
# 1. Versão do código
git log -1 --oneline

# 2. Status das métricas
curl http://localhost:3000/metrics | grep buffer

# 3. Configuração do Prometheus
cat config/prometheus.ts  # ou onde estiver a config

# 4. Logs recentes
pm2 logs zpro-backend --lines 50 | grep buffer
```

---

## ✅ Funcionou!

Quando funcionar, você deverá ver:

- **Panel 111**: Número total de buffers destruídos (cresce a cada desconexão)
- **Panel 112**: Gráfico de taxa de destruição por minuto
- **Panel 113**: Total de flushes finais executados

Essas métricas ajudam a monitorar:
- Desconexões frequentes (problema de rede?)
- Buffers órfãos sendo limpos
- Perda de dados evitada pelo flush final
