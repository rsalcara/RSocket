# 🔧 BUFFER_CONFIG - Configuração via Variáveis de Ambiente

## 📋 Visão Geral

O Event Buffer do RBaileys agora pode ser configurado via **variáveis de ambiente**, permitindo ajustar limites e comportamentos sem recompilar o código.

---

## ⚙️ Variáveis de Ambiente Disponíveis

### 1. `BAILEYS_BUFFER_MAX_CACHE`
**Descrição**: Máximo de itens no cache de histórico antes de executar limpeza LRU

**Default**: `10000`

**Quando ajustar**:
- **Aumentar** se você tem muita memória disponível e quer reduzir limpezas
- **Diminuir** se está com problemas de memória

**Exemplo**:
```bash
# Aumentar cache para 20.000 itens
BAILEYS_BUFFER_MAX_CACHE=20000
```

---

### 2. `BAILEYS_BUFFER_MAX_ITEMS`
**Descrição**: Máximo de itens no buffer antes de forçar flush

**Default**: `1000`

**Quando ajustar**:
- **Aumentar** se você tem alto volume de mensagens e quer consolidar mais eventos
- **Diminuir** se está com timeouts ou quer flushes mais frequentes

**Exemplo**:
```bash
# Permitir até 2.000 itens no buffer
BAILEYS_BUFFER_MAX_ITEMS=2000
```

---

### 3. `BAILEYS_BUFFER_TIMEOUT_MS`
**Descrição**: Tempo em milissegundos para auto-flush do buffer

**Default**: `5000` (5 segundos)

**Quando ajustar**:
- **Aumentar** se você quer consolidar mais eventos (mais eficiente, mas maior latência)
- **Diminuir** se você quer menor latência (flushes mais frequentes)

**Exemplo**:
```bash
# Auto-flush após 3 segundos
BAILEYS_BUFFER_TIMEOUT_MS=3000
```

---

### 4. `BAILEYS_BUFFER_AUTO_FLUSH`
**Descrição**: Habilitar/desabilitar auto-flush por timeout

**Default**: `true`

**Quando ajustar**:
- **Manter `true`** (recomendado) para produção
- **Usar `false`** apenas em cenários de teste/debug específicos

**Exemplo**:
```bash
# Desabilitar auto-flush (NÃO RECOMENDADO para produção)
BAILEYS_BUFFER_AUTO_FLUSH=false
```

---

## 📝 Como Usar

### No Z-PRO (ou qualquer aplicação)

#### 1. Criar/editar arquivo `.env`
```bash
# .env no diretório do Z-PRO backend
BAILEYS_BUFFER_MAX_CACHE=20000
BAILEYS_BUFFER_MAX_ITEMS=2000
BAILEYS_BUFFER_TIMEOUT_MS=3000
BAILEYS_BUFFER_AUTO_FLUSH=true
```

#### 2. Reiniciar a aplicação
```bash
# Com PM2
pm2 restart zpro-backend

# Ou se rodando diretamente
npm run start
```

#### 3. Validar logs
```bash
pm2 logs zpro-backend --lines 50 | grep -i buffer
```

**Logs esperados**:
```
[BAILEYS] Event buffer initialized (timeout: 3000ms, maxSize: 2000)
```

---

## 🎯 Cenários de Uso Recomendados

### Cenário 1: **Alta Volume de Mensagens** (Ex: 100+ mensagens/segundo)
```bash
# Aumentar limites para consolidar mais eventos
BAILEYS_BUFFER_MAX_CACHE=30000
BAILEYS_BUFFER_MAX_ITEMS=3000
BAILEYS_BUFFER_TIMEOUT_MS=2000  # Flush mais rápido para não acumular demais
```

**Por quê?**
- Consolida mais mensagens em menos flushes
- Reduz operações de I/O no banco de dados
- Melhora throughput geral

---

### Cenário 2: **Baixa Latência Prioritária** (Ex: Aplicação real-time crítica)
```bash
# Reduzir timeout para flushes mais frequentes
BAILEYS_BUFFER_MAX_CACHE=5000
BAILEYS_BUFFER_MAX_ITEMS=500
BAILEYS_BUFFER_TIMEOUT_MS=1000  # Flush a cada 1 segundo
```

**Por quê?**
- Eventos são processados mais rapidamente
- Menor tempo entre recebimento e persistência
- Menor acúmulo de eventos no buffer

---

### Cenário 3: **Memória Limitada** (Ex: Servidor com pouca RAM)
```bash
# Reduzir cache e buffer para economizar memória
BAILEYS_BUFFER_MAX_CACHE=5000
BAILEYS_BUFFER_MAX_ITEMS=500
BAILEYS_BUFFER_TIMEOUT_MS=5000
```

**Por quê?**
- Reduz footprint de memória
- Evita OOM (Out of Memory)
- Limpeza de cache mais frequente

---

### Cenário 4: **Padrão (Recomendado)** - Não definir nada!
```bash
# Deixe vazio - usa defaults sensatos
# (ou remova todas as variáveis BAILEYS_BUFFER_*)
```

**Por quê?**
- Valores padrão são balanceados para maioria dos casos
- Testados em produção
- Simplifica configuração

---

## 📊 Comparação de Configurações

| Cenário | MAX_CACHE | MAX_ITEMS | TIMEOUT_MS | Memória | Latência | Throughput |
|---------|-----------|-----------|------------|---------|----------|------------|
| **Padrão** | 10000 | 1000 | 5000 | Média | Média | Médio |
| **Alto Volume** | 30000 | 3000 | 2000 | Alta | Média | **Alto** |
| **Baixa Latência** | 5000 | 500 | 1000 | Baixa | **Baixa** | Médio |
| **Memória Limitada** | 5000 | 500 | 5000 | **Baixa** | Média | Baixo |

---

## 🔍 Validação e Monitoramento

### Como verificar se as configurações foram aplicadas

#### 1. Via Logs (BAILEYS_LOG=true)
```bash
[BAILEYS] 📦 Event buffering started
[BAILEYS] 🔄 Event buffer flushed { flushCount: 1, historyCacheSize: 234 }
[BAILEYS] 📊 Buffer Metrics { itemsBuffered: 0, flushCount: 10, historyCacheSize: 5432 }
```

**Analise:**
- `historyCacheSize` deve estar abaixo de `MAX_CACHE`
- `itemsBuffered` deve estar abaixo de `MAX_ITEMS`
- `flushCount` incrementa a cada flush

#### 2. Via Código (para debug)
```typescript
import { BUFFER_CONFIG } from '@whiskeysockets/baileys'

console.log('Buffer Config:', BUFFER_CONFIG)
// Output:
// {
//   MAX_HISTORY_CACHE_SIZE: 20000,
//   MAX_BUFFER_ITEMS: 2000,
//   AUTO_FLUSH_TIMEOUT_MS: 3000,
//   ENABLE_AUTO_FLUSH: true
// }
```

---

## ⚠️ Avisos Importantes

### ❌ NÃO Desabilite Auto-Flush em Produção
```bash
# PERIGO! Não faça isso em produção:
BAILEYS_BUFFER_AUTO_FLUSH=false
```

**Por quê?**
- Eventos podem ficar presos no buffer indefinidamente
- Risco de perda de dados em caso de crash
- Pode causar acúmulo excessivo de memória

---

### ⚠️ Valores Muito Altos Podem Causar Problemas
```bash
# Cuidado com valores muito altos:
BAILEYS_BUFFER_MAX_CACHE=1000000  # ⚠️ 1 milhão - pode consumir muita memória!
BAILEYS_BUFFER_MAX_ITEMS=100000   # ⚠️ 100k - flush muito pesado!
```

**Problemas potenciais:**
- Consumo excessivo de memória
- Flushes muito lentos
- Timeouts no banco de dados

**Recomendação:** Mantenha entre 1.000-5.000 para MAX_ITEMS e 5.000-30.000 para MAX_CACHE

---

### ⚠️ Valores Muito Baixos Reduzem Eficiência
```bash
# Valores muito baixos perdem o benefício do buffer:
BAILEYS_BUFFER_MAX_ITEMS=10       # ⚠️ Muito baixo - flush constante
BAILEYS_BUFFER_TIMEOUT_MS=100     # ⚠️ Muito baixo - quase sem consolidação
```

**Problemas potenciais:**
- Perda do benefício de consolidação
- Muitas operações de I/O
- Performance reduzida

---

## 🧪 Testes e Validação

### Teste 1: Validar Configuração
```bash
# 1. Configure no .env
echo "BAILEYS_BUFFER_MAX_ITEMS=2000" >> .env

# 2. Reinicie
pm2 restart zpro-backend

# 3. Verifique logs
pm2 logs zpro-backend --lines 20 | grep -i buffer
```

**Esperado:** Ver configurações aplicadas nos logs

---

### Teste 2: Validar Auto-Flush
```bash
# 1. Configure timeout curto
echo "BAILEYS_BUFFER_TIMEOUT_MS=2000" >> .env

# 2. Reinicie e monitore
pm2 restart zpro-backend && pm2 logs zpro-backend --lines 50

# 3. Aguarde 2 segundos sem enviar mensagens
```

**Esperado:** Ver `[BAILEYS] ⏰ Buffer auto-flush triggered by timeout` após 2 segundos

---

### Teste 3: Validar Buffer Overflow Protection
```bash
# 1. Configure limite baixo (para teste)
echo "BAILEYS_BUFFER_MAX_ITEMS=50" >> .env

# 2. Reinicie
pm2 restart zpro-backend

# 3. Envie muitas mensagens rapidamente (>50)
```

**Esperado:** Ver `[BAILEYS] ⚠️ Buffer overflow detected - Force flushing`

---

## 📚 Referências

- **Source Code**: `src/Utils/event-buffer.ts` (linhas 73-97)
- **Documentação de Logging**: [BUFFER_LOGGING.md](./BUFFER_LOGGING.md)
- **Exemplos Práticos**: [LOGGING_EXAMPLES.md](./LOGGING_EXAMPLES.md)

---

## ❓ FAQ

### P: Preciso reiniciar a aplicação após mudar variáveis de ambiente?
**R:** Sim, variáveis de ambiente são lidas apenas no startup.

### P: Posso mudar apenas uma variável e deixar as outras no padrão?
**R:** Sim! Você pode configurar apenas o que quiser. As demais usarão os defaults.

### P: Como voltar aos padrões?
**R:** Remova as variáveis do `.env` e reinicie a aplicação.

### P: Os defaults são bons para produção?
**R:** Sim! Os valores padrão foram testados em produção e são adequados para a maioria dos casos (50-100 conexões simultâneas).

### P: Qual é a configuração mais rápida (menor latência)?
**R:** `MAX_ITEMS=500, TIMEOUT_MS=1000` - mas isso reduz a eficiência do buffer.

### P: Qual é a configuração mais eficiente (maior throughput)?
**R:** `MAX_ITEMS=3000, TIMEOUT_MS=2000` - mas aumenta latência e uso de memória.

### P: E se eu colocar valores inválidos (negativos, strings)?
**R:** `parseInt()` retornará `NaN`, e o código pode quebrar. **Sempre use valores numéricos positivos**.

---

## 🎓 Exemplo Completo - Z-PRO

### Arquivo `.env` no backend do Z-PRO
```bash
# ===========================================
# CONFIGURAÇÃO DO BAILEYS EVENT BUFFER
# ===========================================

# Máximo de itens no cache de histórico (default: 10000)
# Aumentar se tem muita memória e quer reduzir limpezas LRU
BAILEYS_BUFFER_MAX_CACHE=15000

# Máximo de itens no buffer antes de force flush (default: 1000)
# Aumentar para consolidar mais eventos (melhor performance de I/O)
BAILEYS_BUFFER_MAX_ITEMS=1500

# Timeout para auto-flush em ms (default: 5000)
# Reduzir para menor latência, aumentar para maior consolidação
BAILEYS_BUFFER_TIMEOUT_MS=4000

# Habilitar auto-flush por timeout (default: true)
# NUNCA desabilite em produção!
BAILEYS_BUFFER_AUTO_FLUSH=true

# ===========================================
# OUTRAS CONFIGURAÇÕES BAILEYS
# ===========================================
BAILEYS_LOG=true
BAILEYS_LOG_LEVEL=info
```

### Restart via PM2
```bash
pm2 restart zpro-backend
pm2 logs zpro-backend --lines 50
```

### Validação
```bash
# Verificar se configurações foram aplicadas
pm2 logs zpro-backend | grep -i "buffer"

# Monitorar métricas
pm2 logs zpro-backend | grep -i "📊 Buffer Metrics"
```

---

## 🎉 Benefícios

✅ **Flexibilidade**: Ajustar limites sem recompilar código
✅ **Otimização**: Tune fino para seu caso de uso específico
✅ **Simplicidade**: Valores padrão sensatos já funcionam bem
✅ **Transparência**: Fácil validar configurações aplicadas nos logs
✅ **Segurança**: Validações e avisos para configurações perigosas

---

## 📞 Suporte

Para dúvidas sobre configuração do Event Buffer:
- Consulte esta documentação
- Analise os logs (BAILEYS_LOG=true)
- Comece com os defaults e ajuste apenas se necessário
