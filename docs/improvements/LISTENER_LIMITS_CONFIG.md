# 📖 Configuração de Limites de Listeners

## 🎯 Visão Geral

A partir da correção de vazamento de memória em WebSocket Listeners, o RBaileys agora permite **configurar os limites de listeners** através do `SocketConfig`, oferecendo flexibilidade para diferentes casos de uso.

---

## ⚙️ Configurações Disponíveis

### 1. **maxWebSocketListeners** (Opcional)

Controla o número máximo de listeners no **WebSocket interno** (conexão ws com WhatsApp).

```typescript
interface SocketConfig {
  /**
   * Maximum listeners for WebSocket internal events
   * @default 15
   * Recommended: 15-30 depending on external handlers
   * Set to 0 for unlimited (NOT RECOMMENDED - causes memory leaks)
   */
  maxWebSocketListeners?: number
}
```

**Valor padrão**: `15`

**Cálculo do padrão**:
- 8 eventos base do WebSocket (close, error, upgrade, message, open, ping, pong, unexpected-response)
- 7 slots adicionais para handlers dinâmicos

---

### 2. **maxSocketClientListeners** (Opcional)

Controla o número máximo de listeners no **AbstractSocketClient** (EventEmitter que gerencia conexão).

```typescript
interface SocketConfig {
  /**
   * Maximum listeners for SocketClient EventEmitter
   * @default 30
   * Recommended: 30-50 depending on application complexity
   * Set to 0 for unlimited (NOT RECOMMENDED - causes memory leaks)
   */
  maxSocketClientListeners?: number
}
```

**Valor padrão**: `30`

**Cálculo do padrão**:
- 8 eventos WebSocket propagados
- ~10 listeners internos do Baileys (connection, messages, etc.)
- ~12 slots para handlers adicionados pelo usuário

---

## 📝 Exemplos de Uso

### Exemplo 1: Usando Valores Padrão (Recomendado)

```typescript
import makeWASocket from '@whiskeysockets/baileys'

const sock = makeWASocket({
  auth: state,
  // Não precisa especificar - usará os padrões seguros
  // maxWebSocketListeners: 15 (padrão)
  // maxSocketClientListeners: 30 (padrão)
})
```

**Quando usar**: Para a maioria dos casos de uso. Os valores padrão são seguros e suficientes.

---

### Exemplo 2: Aplicação com Muitos Handlers Externos

```typescript
const sock = makeWASocket({
  auth: state,
  // Se sua aplicação adiciona muitos listeners externos
  maxWebSocketListeners: 25,       // Aumentado de 15 para 25
  maxSocketClientListeners: 50,    // Aumentado de 30 para 50
})

// Agora você pode adicionar mais handlers sem warnings
sock.ev.on('connection.update', handler1)
sock.ev.on('connection.update', handler2)
sock.ev.on('connection.update', handler3)
// ... até 50 handlers diferentes
```

**Quando usar**: Se você tem uma aplicação complexa que adiciona 10+ handlers personalizados.

---

### Exemplo 3: Modo "Unlimited" (⚠️ NÃO RECOMENDADO)

```typescript
const sock = makeWASocket({
  auth: state,
  maxWebSocketListeners: 0,      // ⚠️ PERIGOSO!
  maxSocketClientListeners: 0,   // ⚠️ PERIGOSO!
})
```

**Resultado nos logs**:
```
⚠️  WARNING: setMaxListeners(0) allows UNLIMITED listeners - potential memory leak!
⚠️  WARNING: WebSocket setMaxListeners(0) allows UNLIMITED listeners - potential memory leak!
```

**Quando usar**:
- ❌ **NUNCA** em produção
- ⚠️ Apenas para debugging de casos específicos
- ⚠️ Temporariamente para migração de código legado

**Por que evitar**:
- Desabilita warnings do Node.js
- Permite crescimento ilimitado de memória
- Vazamentos de memória são silenciosos até crash

---

## 🔍 Como Escolher o Valor Correto

### Passo 1: Entenda Seu Uso

Conte quantos **handlers personalizados** você adiciona:

```typescript
// Exemplo: contando handlers
sock.ev.on('messages.upsert', myHandler1)      // +1
sock.ev.on('messages.update', myHandler2)      // +1
sock.ev.on('connection.update', myHandler3)    // +1
sock.ev.on('creds.update', myHandler4)         // +1
// Total: 4 handlers externos
```

### Passo 2: Calcule o Limite

**Para maxSocketClientListeners:**
```
Limite = 18 (base) + N (seus handlers) + buffer (20% margem)

Exemplo com 10 handlers:
Limite = 18 + 10 + 6 = 34
```

**Para maxWebSocketListeners:**
```
Raramente precisa mudar (use padrão 15)
Apenas se adicionar listeners direto no socket WebSocket
```

### Passo 3: Teste e Ajuste

1. **Comece com os padrões** (15 e 30)
2. **Execute sua aplicação**
3. **Se aparecer warning**:
   ```
   MaxListenersExceededWarning: Possible EventEmitter memory leak detected
   ```
4. **Analise se é legítimo** (muitos handlers) ou vazamento
5. **Ajuste o limite** se for legítimo

---

## ⚠️ Warnings e Diagnóstico

### Warning: MaxListenersExceededWarning

**O que significa:**
```
(node:1234) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
31 connection.update listeners added to [AbstractSocketClient].
Use emitter.setMaxListeners() to increase limit
```

**Possíveis causas:**

#### 1. **Uso Legítimo** (OK)
Sua aplicação realmente precisa de muitos handlers:
```typescript
// Solução: Aumentar o limite
const sock = makeWASocket({
  auth: state,
  maxSocketClientListeners: 50,  // Aumentado para acomodar
})
```

#### 2. **Vazamento de Memória** (PROBLEMA)
Você está adicionando listeners sem remover:
```typescript
// ❌ ERRADO - vazamento!
function reconnect() {
  sock.ev.on('messages.upsert', handler)  // ← Adiciona sempre que reconecta!
}

// ✅ CORRETO - remove antes de adicionar novamente
function reconnect() {
  sock.ev.off('messages.upsert', handler)  // Remove anterior
  sock.ev.on('messages.upsert', handler)   // Adiciona novo
}
```

---

## 📊 Tabela de Referência

| Cenário | maxWebSocketListeners | maxSocketClientListeners |
|---------|------------------------|---------------------------|
| **Aplicação simples** (1-5 handlers) | 15 (padrão) | 30 (padrão) |
| **Aplicação média** (6-15 handlers) | 15-20 | 35-45 |
| **Aplicação complexa** (16-30 handlers) | 20-30 | 45-60 |
| **Multi-tenant** (muitas instâncias) | 15 (padrão)* | 30 (padrão)* |
| **Debugging temporário** | 100+ | 100+ |
| **❌ NUNCA** | 0 | 0 |

*Multi-tenant: Use valores padrão por instância, não aumente globalmente

---

## 🧪 Como Testar Suas Configurações

### Teste 1: Verificar Limite Atual

```typescript
import makeWASocket from '@whiskeysockets/baileys'

const sock = makeWASocket({
  auth: state,
  maxSocketClientListeners: 50,
})

// Verificar limite aplicado
console.log('Max listeners:', sock.ev.getMaxListeners())
// Output: Max listeners: 50
```

### Teste 2: Monitorar Listener Count

```typescript
// Adicionar monitoramento
setInterval(() => {
  const count = sock.ev.listenerCount('messages.upsert')
  console.log(`Messages.upsert listeners: ${count}`)

  if (count > 10) {
    console.warn('⚠️  Listener count alto - possível vazamento!')
  }
}, 30000)  // Verifica a cada 30 segundos
```

### Teste 3: Detectar Vazamentos em Reconexão

```typescript
// Teste de stress
async function stressTest() {
  const initialCount = sock.ev.listenerCount('messages.upsert')

  // Fazer 10 reconexões
  for (let i = 0; i < 10; i++) {
    sock.ws.close()
    await sock.connect()
  }

  const finalCount = sock.ev.listenerCount('messages.upsert')

  console.log(`Initial: ${initialCount}, Final: ${finalCount}`)

  if (finalCount > initialCount) {
    console.error('❌ VAZAMENTO DETECTADO!')
  } else {
    console.log('✅ Sem vazamento - cleanup funcionando')
  }
}
```

---

## 🔧 Migração de Código Legado

Se você tinha `setMaxListeners(0)` hardcoded no seu código:

### Antes (Perigoso):
```typescript
// ❌ Código antigo com vazamento
const sock = makeWASocket({ auth: state })
sock.ev.setMaxListeners(0)  // PERIGOSO!
```

### Depois (Seguro):
```typescript
// ✅ Opção 1: Usar padrão seguro (recomendado)
const sock = makeWASocket({
  auth: state,
  // Deixar padrão (30)
})

// ✅ Opção 2: Aumentar limite se necessário
const sock = makeWASocket({
  auth: state,
  maxSocketClientListeners: 50,  // Valor razoável
})

// ❌ Opção 3: Unlimited (temporário apenas!)
const sock = makeWASocket({
  auth: state,
  maxSocketClientListeners: 0,  // Vai gerar warning
})
```

---

## 🎯 Melhores Práticas

### ✅ FAZER

1. **Usar valores padrão** quando possível
2. **Remover listeners** antes de adicionar novamente
3. **Monitorar listener counts** em produção
4. **Aumentar limite gradualmente** se necessário
5. **Documentar** por que você precisa de limites altos

### ❌ EVITAR

1. **setMaxListeners(0)** em produção
2. **Ignorar warnings** sem investigar
3. **Adicionar listeners em loops** sem cleanup
4. **Limites arbitrariamente altos** (>100) sem justificativa

---

## 📚 Referências

- [Node.js EventEmitter.setMaxListeners()](https://nodejs.org/api/events.html#eventssetmaxlistenersn)
- [WebSocket Listener Leak Fix](./WEBSOCKET_LISTENER_LEAK.md)
- [Memory Leak Debugging Guide](https://nodejs.org/en/docs/guides/simple-profiling/)

---

## ❓ FAQ

### P: Qual valor usar em produção?

**R**: Use os padrões (15 e 30) a menos que você veja warnings legítimos. Se aparecer warning, analise primeiro se é vazamento ou uso legítimo.

### P: Posso usar 0 (unlimited)?

**R**: ❌ **NÃO** em produção. Apenas temporariamente para debugging. Sempre retorne a um valor finito.

### P: O que fazer se minha app precisa de 100+ listeners?

**R**: Primeiro, **verifique se há vazamento**. 100+ listeners é incomum. Se for legítimo, documente o motivo e use um valor específico (não 0).

### P: Como saber se tenho um vazamento?

**R**: Monitore listener count após reconexões. Se crescer constantemente, você tem vazamento. Implemente os testes acima.

### P: Posso mudar o limite em runtime?

**R**: ✅ Sim, mas não recomendado. Configure no makeWASocket para consistência.

---

**Última atualização**: 2026-01-11
