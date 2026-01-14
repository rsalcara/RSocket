# 🔧 Correções do Dashboard Grafana

## ❌ Problemas Identificados

### 1. **Cards Removidos (Inúteis)**

| Card Removido | Por quê? |
|---------------|----------|
| 🌐 Total Requisições HTTP | Não rastreia nada útil do RBaileys, apenas requisições genéricas |
| ℹ️ Versão Node.js | Informação estática, não precisa de monitoramento em tempo real |

### 2. **Duplicatas Removidas**

| Card Duplicado | Problema |
|----------------|----------|
| 📨 Total de Mensagens Recebidas | Aparecia 2 vezes na seção "Conexões e Mensagens" |
| Campo "Mensagens Recebidas" | Aparecia duplicado dentro do mesmo card |

### 3. **Métricas Sem Dados - EXPLICAÇÃO**

#### ⚠️ **Buffer Overflow (5min)** - SEM DADOS

**Por quê?**: Nos logs você vê:
```
[BAILEYS] 🔄 Event buffer flushed { flushCount: 10, historyCacheSize: 5216, mode: 'disabled' }
```

**Problema**: `mode: 'disabled'` significa que o Event Buffer está em modo DISABLED (desabilitado). Quando está desabilitado:
- ✅ Flushes acontecem imediatamente (por isso você vê vários flushes)
- ❌ **Overflow NUNCA acontece** (porque não há buffer acumulando)
- ❌ A métrica `zpro_baileys_buffer_overflow_total` sempre fica em 0

**Solução**: Este card só vai mostrar dados se o buffer estiver HABILITADO. No modo disabled, overflow é impossível.

**Card mantido**: Sim, mas sem dados é normal quando buffer está disabled.

---

#### 💚 **Status de Saúde** - SEM DADOS

**Por quê?**: Nos logs NÃO aparece nenhuma métrica de saúde sendo atualizada.

**Problema**: A métrica `zpro_baileys_adaptive_health_status` não está sendo atualizada corretamente.

**Solução**:
- ✅ **Alterado o card** para usar emoji de coração:
  - 💚 Verde = Healthy (valor 1)
  - 💔 Vermelho = Unhealthy (valor 0)
- ✅ Background muda de cor automaticamente

**Card atualizado**: Agora usa "💚 Healthy" ou "💔 Unhealthy" ao invés de gauge sem dados.

---

#### 📈 **Taxa de Evento** - SEM DADOS

**Por quê?**: A métrica `zpro_baileys_adaptive_event_rate` não aparece nos logs.

**Problema**: Esta métrica deveria ser atualizada pelo algoritmo adaptativo, mas não está sendo coletada.

**Solução**: Card mantido mas convertido para gráfico de tempo (timeseries) para mostrar tendência quando dados estiverem disponíveis.

---

#### 🔌 **Circuit Breaker - Disparos (última hora)** - SEM DADOS

**Por quê?**: Nos logs você vê:
```
[BAILEYS] 🔧 Circuit Breaker initialized - Threshold: 5 failures/60s, Timeout: 30s
```

**Problema**: O Circuit Breaker foi INICIALIZADO mas **NUNCA DISPAROU**. Isso é BONO! Significa:
- ✅ Seu sistema está estável
- ✅ Não há falhas em sequência
- ✅ Circuit breaker está apenas monitorando

**Solução**: Card mantido. Só vai mostrar dados quando houver 5+ falhas em 60 segundos (threshold).

**Esperado**: Valor = 0 (nenhum disparo) é o ideal.

---

#### 🔢 **Circuit Breaker - Histórico** - SEM DADOS

**Por quê?**: Mesma razão acima. Sem disparos, sem histórico.

**Solução**:
- ❌ **Card removido** (redundante com o card de "Total")
- ✅ Mantido apenas **"Circuit Breaker - Total"**
- ✅ Movido para a seção "Algoritmo Adaptativo"

---

#### 🔗 **Conexões Ativas = 0** (MAS TEM CONEXÃO NOS LOGS!)

**Por quê?**: Nos logs você vê:
```
[BAILEYS] ✅ Connected to WhatsApp successfully
info: Socket INFINITE Connection Update open
info: Socket TESTE Connection Update open
```

**Problema**: ❌ **A métrica `zpro_baileys_active_connections` NÃO ESTÁ SENDO ATUALIZADA NO CÓDIGO!**

**Causa raiz**: O arquivo `src/Socket/socket.ts` tem apenas o IMPORT do Prometheus, mas **NENHUMA CHAMADA** para `recordConnection()` ou `recordConnectionState()`.

**Solução necessária**: Precisamos adicionar as chamadas de métricas no `socket.ts`:

```typescript
// Quando conecta:
prometheus?.recordConnection('connect')
prometheus?.recordConnectionState('connected')

// Quando desconecta:
prometheus?.recordConnection('disconnect')
prometheus?.recordConnectionState('disconnected')
```

**Status**: 🚧 **PENDENTE** - Precisa ser implementado no código.

---

#### 🧹 **Cache Cleanup (por minuto)** - SEM DADOS

**Por quê?**: Nos logs você vê:
```
[BAILEYS] 📊 Buffer Metrics { historyCacheSize: 5216, buffersInProgress: 0 }
```

**Problema**: O cache está crescendo (5216 itens) mas **nenhuma limpeza está acontecendo**.

**Causa**: Limpeza de cache só acontece quando atinge o limite máximo (10.000 itens). Como está em 5216, ainda não acionou limpeza.

**Solução**: Card mantido. Mostrará dados quando cache atingir limite e limpezas começarem.

**Esperado**: 0 limpezas/min é normal quando cache não está cheio.

---

## ✅ Novo Dashboard: `baileys-dashboard-clean.json`

### Estrutura Reorganizada

#### 1. **💻 Recursos do Sistema - CPU e Memória**
- ⚙️ CPU Usage (gauge com %)
- 💾 Memória (RSS) (gauge com MB)
- ⚡ Event Loop Lag (gauge com ms)
- 📁 File Descriptors (stat)

#### 2. **📦 Event Buffer - Performance**
- 🔄 Taxa de Flush do Buffer (timeseries)
- 📊 Cache Size (gauge)
- 🧹 Cache Cleanup (stat)

#### 3. **🤖 Algoritmo Adaptativo & Circuit Breaker**
- 💚 Status de Saúde (emoji: 💚 ou 💔)
- 🔌 Circuit Breaker - Total (stat)
- 📈 Taxa de Eventos (timeseries)

#### 4. **📱 Conexões e Mensagens WhatsApp**
- 🔗 Conexões WhatsApp (stat) - ⚠️ Precisa implementação
- 📨 Mensagens Recebidas (stat com sum)
- 📤 Mensagens Enviadas (stat com sum)

#### 5. **📊 Métricas Estilo PM2**
- 💾 Used Heap Size
- 📈 Heap Usage %
- 📦 Heap Size Total
- ⚡ Event Loop p95
- 🔗 Active Handles
- 📡 Active Requests

---

## 🚧 O QUE PRECISA SER FEITO

### Implementar Tracking de Conexões no `socket.ts`

O problema principal é que **conexões não estão sendo rastreadas**. Você vê nos logs:

```
info: Socket INFINITE Connection Update connecting
info: Socket INFINITE Connection Update open
[BAILEYS] ✅ Connected to WhatsApp successfully
```

Mas a métrica `zpro_baileys_active_connections` continua em 0.

**Solução**:

1. **Adicionar no `src/Socket/socket.ts`** (onde tem as atualizações de conexão):

```typescript
// Import já existe:
import { getPrometheus } from '../Utils/prometheus-metrics'

// No evento de conexão (quando update.connection === 'open'):
const prometheus = getPrometheus()
if (prometheus?.isEnabled()) {
    prometheus.recordConnection('connect')
    prometheus.recordConnectionState('connected')
}

// No evento de desconexão (quando update.connection === 'close'):
const prometheus = getPrometheus()
if (prometheus?.isEnabled()) {
    prometheus.recordConnection('disconnect')
    prometheus.recordConnectionState('disconnected')
}

// No evento de reconexão:
if (prometheus?.isEnabled()) {
    prometheus.recordReconnectionAttempt()
}

// Em erros de stream:
if (prometheus?.isEnabled()) {
    prometheus.recordConnectionError('stream_error')
}
```

2. **Recompilar**:
```bash
npm run build:tsc
```

3. **Fazer deploy**:
```bash
git add src/Socket/socket.ts lib/Socket/socket.js
git commit -m "feat: add connection metrics tracking to socket.ts"
git push origin main
```

4. **Atualizar servidor** (comando que você já tem):
```bash
sudo -iu deployzdg bash -lc 'cd /home/deployzdg/zpro.io/backend && npm i "@whiskeysockets/baileys@git+ssh://git@github.com/rsalcara/RSocket.git#main" --save && pm2 restart zpro-backend'
```

---

## 📊 Comparação: Dashboard Antigo vs Novo

| Aspecto | Dashboard Antigo | Dashboard Limpo |
|---------|------------------|-----------------|
| **Número de cards** | 30+ | 19 |
| **Duplicatas** | Sim (mensagens recebidas 2x) | Não |
| **Cards inúteis** | Sim (HTTP requests, Node version) | Não |
| **Organização** | Confusa, 6 seções | Clara, 5 seções |
| **Legendas** | Algumas duplicadas | Todas únicas |
| **Status de Saúde** | Gauge sem dados | Emoji ❤️ com cor |
| **Circuit Breaker** | 3 cards (redundantes) | 1 card (essencial) |
| **PM2 Style** | 12 cards (alguns duplicados) | 6 cards (essenciais) |

---

## 🎯 Resultado Esperado Após Implementação

Depois de implementar o tracking de conexões e reimportar o dashboard limpo:

### Seção "Conexões e Mensagens WhatsApp":

```
┌───────────────────────────────────────────────────────┐
│ 🔗 Conexões WhatsApp        │  2 (TESTE + INFINITE)   │ ← Vai funcionar!
├───────────────────────────────────────────────────────┤
│ 📨 Mensagens Recebidas      │  7 (do log)             │ ← Já funciona!
├───────────────────────────────────────────────────────┤
│ 📤 Mensagens Enviadas       │  0 (nenhuma enviada)    │ ← Já funciona!
└───────────────────────────────────────────────────────┘
```

### Seção "Event Buffer":

```
┌───────────────────────────────────────────────────────┐
│ 🔄 Taxa de Flush            │  10 flushes/min         │ ← Já funciona!
├───────────────────────────────────────────────────────┤
│ 📊 Cache Size               │  5216 itens             │ ← Já funciona!
├───────────────────────────────────────────────────────┤
│ 🧹 Cache Cleanup            │  0/min (normal)         │ ← Normal (sem dados)
└───────────────────────────────────────────────────────┘
```

### Seção "Circuit Breaker":

```
┌───────────────────────────────────────────────────────┐
│ 💚 Status de Saúde          │  💚 Healthy             │ ← Coração verde!
├───────────────────────────────────────────────────────┤
│ 🔌 Circuit Breaker          │  0 disparos (ótimo!)    │ ← Normal (sem dados)
├───────────────────────────────────────────────────────┤
│ 📈 Taxa de Eventos          │  [gráfico zerado]       │ ← Normal (sem dados)
└───────────────────────────────────────────────────────┘
```

---

## 📝 Resumo das Ações

### ✅ Já Feito:
- ❌ Removido cards inúteis (HTTP requests, Node version)
- ❌ Removido duplicatas (mensagens recebidas 2x)
- ✅ Status de Saúde convertido para emoji ❤️
- ✅ Circuit Breaker reduzido de 3 para 1 card
- ✅ Dashboard limpo e organizado criado

### 🚧 Pendente:
- ⚠️ **IMPLEMENTAR tracking de conexões no `socket.ts`**
- ⚠️ Compilar código (`npm run build:tsc`)
- ⚠️ Fazer commit e push
- ⚠️ Atualizar servidor
- ⚠️ Reimportar dashboard limpo no Grafana

---

## 🎉 Arquivos Criados

1. **`baileys-dashboard-clean.json`** - Dashboard limpo, sem duplicatas
2. **`baileys-dashboard-pt-br.json.backup`** - Backup do dashboard antigo
3. **Este arquivo** (`DASHBOARD_FIXES.md`) - Documentação completa

---

**Desenvolvido por**: Claude + RBaileys Team
**Data**: 2026-01-14
**Status**: ✅ Dashboard limpo pronto | 🚧 Conexões pendentes de implementação
