# Guia Prático: Corrigindo Tickets Duplicados no Z-PRO

## 🎯 Problema

Você está vendo **2 tickets abertos** para o mesmo contato no painel Z-PRO:

```
ABERTOS (2)
├─ Renato Alcará  (#16)   - "Olá"
└─ 207421150646274 (#17)   - "Oi"
```

**Causa**: O mesmo contato aparece com JIDs diferentes:
- `207421150646274@lid` (resposta via Newsletter/Canal)
- `207421150646274@s.whatsapp.net` (mensagem regular)

O sistema trata como **2 pessoas diferentes** → cria **2 tickets separados**.

## ✅ Solução Implementada

O RBaileys agora possui **normalização de JID** que padroniza todos os formatos para `@s.whatsapp.net`, evitando duplicatas.

## 🔧 Implementação no Z-PRO Backend

### Passo 1: Atualizar o Baileys

No servidor zpro-backend, execute:

```bash
cd /home/deployzdg/zpro.io/backend

npm install @whiskeysockets/baileys@git+ssh://git@github.com/rsalcara/RSocket.git#main --save
```

**Versão necessária**: Commit `4849e48` ou superior (com JID normalization)

### Passo 2: Localizar os Arquivos de Serviço

No zpro-backend, você precisa modificar os arquivos que gerenciam contatos e tickets. Geralmente estão em:

```
backend/
├── src/
│   ├── services/
│   │   ├── ContactService.ts
│   │   ├── TicketService.ts
│   │   └── WbotService.ts
│   └── helpers/
│       └── WbotHandlers.ts
```

### Passo 3: Adicionar Normalização ao ContactService

**Arquivo**: `backend/src/services/ContactService.ts` (ou similar)

**Encontre a função** que cria ou busca contatos (geralmente chamada `findOrCreateContact`, `getContact`, ou similar):

```typescript
// ANTES (sem normalização):
import Contact from '../models/Contact'

const findOrCreateContact = async (jid: string, name?: string) => {
  let contact = await Contact.findOne({ where: { jid } })

  if (!contact) {
    contact = await Contact.create({ jid, name })
  }

  return contact
}
```

**Atualize para** incluir normalização:

```typescript
// DEPOIS (com normalização):
import Contact from '../models/Contact'
import { normalizeJid } from '@whiskeysockets/baileys'  // ← ADICIONE ESTA LINHA

const findOrCreateContact = async (jid: string, name?: string) => {
  const normalizedJid = normalizeJid(jid)  // ← ADICIONE ESTA LINHA

  let contact = await Contact.findOne({ where: { jid: normalizedJid } })

  if (!contact) {
    contact = await Contact.create({ jid: normalizedJid, name })
  }

  return contact
}
```

### Passo 4: Adicionar Normalização ao TicketService

**Arquivo**: `backend/src/services/TicketService.ts` (ou similar)

**Encontre a função** que cria ou busca tickets:

```typescript
// ANTES (sem normalização):
import Ticket from '../models/Ticket'

const createOrUpdateTicket = async (contactJid: string, queueId?: number) => {
  let ticket = await Ticket.findOne({
    where: {
      contactJid,
      status: { [Op.in]: ['open', 'pending'] }
    }
  })

  if (!ticket) {
    ticket = await Ticket.create({
      contactJid,
      queueId,
      status: 'open'
    })
  }

  return ticket
}
```

**Atualize para** incluir normalização:

```typescript
// DEPOIS (com normalização):
import Ticket from '../models/Ticket'
import { normalizeJid } from '@whiskeysockets/baileys'  // ← ADICIONE ESTA LINHA

const createOrUpdateTicket = async (contactJid: string, queueId?: number) => {
  const normalizedJid = normalizeJid(contactJid)  // ← ADICIONE ESTA LINHA

  let ticket = await Ticket.findOne({
    where: {
      contactJid: normalizedJid,
      status: { [Op.in]: ['open', 'pending'] }
    }
  })

  if (!ticket) {
    ticket = await Ticket.create({
      contactJid: normalizedJid,
      queueId,
      status: 'open'
    })
  }

  return ticket
}
```

### Passo 5: Adicionar Normalização ao Handler de Mensagens

**Arquivo**: `backend/src/helpers/WbotHandlers.ts` (ou similar)

**Encontre o handler** que processa mensagens recebidas (geralmente dentro de `sock.ev.on('messages.upsert', ...)`):

```typescript
// ANTES (sem normalização):
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const messageJid = msg.key.remoteJid

    // Buscar ou criar contato
    const contact = await findOrCreateContact(messageJid)

    // Buscar ou criar ticket
    const ticket = await findOrCreateTicket(messageJid)

    // Processar mensagem...
  }
})
```

**Atualize para** incluir normalização:

```typescript
// DEPOIS (com normalização):
import { normalizeJid, isIndividualJid } from '@whiskeysockets/baileys'  // ← ADICIONE

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const messageJid = msg.key.remoteJid

    // Ignorar mensagens de grupos/broadcasts  ← ADICIONE
    if (!isIndividualJid(messageJid)) {
      continue
    }

    // Normalizar JID antes de processar  ← ADICIONE
    const normalizedJid = normalizeJid(messageJid)

    // Buscar ou criar contato (usando JID normalizado)
    const contact = await findOrCreateContact(normalizedJid)

    // Buscar ou criar ticket (usando JID normalizado)
    const ticket = await findOrCreateTicket(normalizedJid)

    // Processar mensagem...
  }
})
```

### Passo 6: Limpar Tickets Duplicados Existentes

**Crie um script de migração**: `backend/src/scripts/fix-duplicate-tickets.ts`

```typescript
import { normalizeJid } from '@whiskeysockets/baileys'
import Contact from '../models/Contact'
import Ticket from '../models/Ticket'
import Message from '../models/Message'

async function fixDuplicateTickets() {
  console.log('🔄 Iniciando correção de tickets duplicados...')

  // 1. Normalizar todos os contatos
  const contacts = await Contact.findAll()
  const contactMap = new Map<string, number>() // normalizedJid → primary contact ID
  let mergedCount = 0

  for (const contact of contacts) {
    const normalized = normalizeJid(contact.jid)

    if (contactMap.has(normalized)) {
      // Duplicata encontrada!
      const primaryId = contactMap.get(normalized)!

      console.log(`⚠️  Duplicata: ${contact.jid} → ${normalized}`)

      // Transferir todos os tickets para o contato principal
      const ticketsUpdated = await Ticket.update(
        { contactId: primaryId },
        { where: { contactId: contact.id } }
      )

      // Transferir todas as mensagens para o contato principal
      const messagesUpdated = await Message.update(
        { contactId: primaryId },
        { where: { contactId: contact.id } }
      )

      // Deletar contato duplicado
      await contact.destroy()

      mergedCount++
      console.log(`✅ Mesclado: ${contact.jid} → contato #${primaryId}`)
      console.log(`   Tickets transferidos: ${ticketsUpdated[0]}`)
      console.log(`   Mensagens transferidas: ${messagesUpdated[0]}`)
    } else {
      // Primeira ocorrência - atualizar JID se necessário
      if (contact.jid !== normalized) {
        contact.jid = normalized
        await contact.save()
        console.log(`📝 Normalizado: ${contact.jid} → ${normalized}`)
      }
      contactMap.set(normalized, contact.id)
    }
  }

  // 2. Normalizar todos os tickets
  const tickets = await Ticket.findAll()
  let ticketsNormalized = 0

  for (const ticket of tickets) {
    if (ticket.contactJid) {
      const normalized = normalizeJid(ticket.contactJid)
      if (ticket.contactJid !== normalized) {
        ticket.contactJid = normalized
        await ticket.save()
        ticketsNormalized++
        console.log(`🎫 Ticket #${ticket.id} normalizado`)
      }
    }
  }

  console.log('\n✅ Migração completa!')
  console.log(`   Contatos mesclados: ${mergedCount}`)
  console.log(`   Tickets normalizados: ${ticketsNormalized}`)
}

fixDuplicateTickets()
  .then(() => {
    console.log('✅ Script finalizado com sucesso')
    process.exit(0)
  })
  .catch(err => {
    console.error('❌ Erro na migração:', err)
    process.exit(1)
  })
```

### Passo 7: Executar a Migração

**⚠️ IMPORTANTE**: Faça backup do banco de dados antes!

```bash
# No servidor zpro-backend
cd /home/deployzdg/zpro.io/backend

# Backup do banco (PostgreSQL exemplo):
pg_dump -U zpro_user zpro_db > backup_$(date +%Y%m%d_%H%M%S).sql

# OU backup MySQL:
mysqldump -u zpro_user -p zpro_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Executar migração
npx ts-node src/scripts/fix-duplicate-tickets.ts
```

**Saída esperada**:
```
🔄 Iniciando correção de tickets duplicados...
⚠️  Duplicata: 207421150646274@lid → 207421150646274@s.whatsapp.net
✅ Mesclado: 207421150646274@lid → contato #123
   Tickets transferidos: 1
   Mensagens transferidas: 15
📝 Normalizado: 5511999999999@c.us → 5511999999999@s.whatsapp.net
🎫 Ticket #16 normalizado
🎫 Ticket #17 normalizado

✅ Migração completa!
   Contatos mesclados: 1
   Tickets normalizados: 2
```

### Passo 8: Reiniciar o Backend

```bash
pm2 restart zpro-backend
pm2 logs zpro-backend --lines 50
```

**Verificar logs**:
```
[BAILEYS] 📤 Message sent: 3EB0... → 207421150646274@s.whatsapp.net  ← SEMPRE @s.whatsapp.net agora!
info: Z-PRO ::: Baileys assertSession sended successfully
```

## 🎉 Resultado Esperado

### Antes da Correção
```
ABERTOS (2)
├─ Renato Alcará      (#16)   - "Olá"         ← Ticket 1
└─ 207421150646274    (#17)   - "Oi"          ← Ticket 2 (DUPLICADO!)
```

### Depois da Correção
```
RESOLVIDOS (2)
├─ Renato Alcará      (#16)   - "Olá"         ← Mesmo contato
└─ Renato Alcará      (#17)   - "Oi"          ← Mesmo contato
```

Agora **novos tickets** nunca mais serão duplicados para o mesmo contato! ✅

## 🔍 Verificação

### 1. Verificar no Banco de Dados

```sql
-- Verificar se há contatos duplicados
SELECT
  SUBSTRING(jid, 1, POSITION('@' IN jid) - 1) as phone,
  COUNT(*) as count,
  array_agg(jid) as jids
FROM contacts
GROUP BY phone
HAVING COUNT(*) > 1;

-- Deve retornar vazio após a migração
```

### 2. Verificar no Painel Z-PRO

1. Acesse `app.integrazap.app/#/chats/`
2. Verifique a aba **ABERTOS**
3. Envie uma mensagem do WhatsApp para o número conectado
4. Responda da aplicação
5. O mesmo ticket deve continuar aberto (não criar novo)

### 3. Monitorar Logs

```bash
pm2 logs zpro-backend --lines 100 | grep -E '@lid|@s.whatsapp.net'
```

**Logs normais** (após correção):
```
[BAILEYS] 📤 Message sent: → 207421150646274@s.whatsapp.net  ✅
[BAILEYS] 📤 Message sent: → 5511999999999@s.whatsapp.net    ✅
```

**Logs problemáticos** (se ainda aparecer):
```
warn: CheckIsValidContact 2 | invalidNumber, trying @lid  ⚠️
[BAILEYS] 📤 Message sent: → 207421150646274@lid            ❌
```

Se ainda ver `@lid` nos logs após a implementação, verifique se todos os pontos de entrada estão normalizando JIDs.

## ⚠️ Troubleshooting

### Problema: Ainda vejo tickets duplicados após a migração

**Causa**: A normalização não está sendo aplicada em todos os pontos de entrada.

**Solução**:
1. Verifique se você adicionou `normalizeJid()` em **TODOS** os lugares onde JIDs são usados
2. Procure por `msg.key.remoteJid` no código e certifique-se de normalizar
3. Verifique handlers de eventos: `messages.upsert`, `messages.update`, `presence.update`

### Problema: Erro "Cannot find module '@whiskeysockets/baileys'"

**Causa**: Baileys não foi atualizado corretamente.

**Solução**:
```bash
cd /home/deployzdg/zpro.io/backend
rm -rf node_modules/@whiskeysockets
npm install @whiskeysockets/baileys@git+ssh://git@github.com/rsalcara/RSocket.git#main --save
npm ls @whiskeysockets/baileys  # Verificar versão
```

### Problema: Erro na migração "contactId is not unique"

**Causa**: Tentativa de mesclar tickets com mesmo contactId.

**Solução**: Ajuste o script de migração para verificar duplicatas antes de atualizar:
```typescript
const existingTicket = await Ticket.findOne({
  where: { contactId: primaryId, id: ticket.id }
})
if (!existingTicket) {
  await Ticket.update(...)
}
```

### Problema: Mensagens antigas não aparecem no ticket mesclado

**Causa**: As mensagens ainda estão associadas ao contato antigo (deletado).

**Solução**: O script de migração já transfere mensagens. Se não funcionou, execute manualmente:
```sql
-- Encontrar o contactId principal para o número
SELECT id, jid FROM contacts WHERE jid LIKE '207421150646274%';

-- Atualizar mensagens órfãs
UPDATE messages SET contactId = <id_principal> WHERE contactId IS NULL OR contactId NOT IN (SELECT id FROM contacts);
```

## 📚 Documentação Adicional

- [JID Normalization - Guia Completo](./JID_NORMALIZATION.md)
- [Baileys Issue #1718 - @lid Problem](https://github.com/WhiskeySockets/Baileys/issues/1718)
- [EvolutionAPI Issue #1872 - LID Events](https://github.com/EvolutionAPI/evolution-api/issues/1872)

## 💡 Boas Práticas

1. **Sempre normalize na entrada**: Normalize JIDs assim que recebê-los
2. **Use funções de comparação**: Use `areJidsEqual()` em vez de `===`
3. **Valide antes de processar**: Use `validateJid()` para detectar JIDs malformados
4. **Filtre tipos de mensagem**: Use `isIndividualJid()` para ignorar grupos/broadcasts
5. **Monitore logs**: Fique atento a padrões `@lid` que indicam necessidade de normalização

## 🎯 Checklist de Implementação

- [ ] Baileys atualizado para commit `4849e48` ou superior
- [ ] `normalizeJid()` adicionado em `ContactService`
- [ ] `normalizeJid()` adicionado em `TicketService`
- [ ] `normalizeJid()` adicionado em `WbotHandlers` (message handler)
- [ ] `isIndividualJid()` adicionado para filtrar grupos
- [ ] Backup do banco de dados criado
- [ ] Script de migração executado com sucesso
- [ ] Backend reiniciado
- [ ] Logs verificados (sem `@lid` aparecendo)
- [ ] Teste manual: enviar mensagem e verificar que não cria ticket duplicado
- [ ] Painel Z-PRO mostrando tickets corretos

---

**Precisa de ajuda?**
- [RBaileys Issues](https://github.com/rsalcara/RSocket/issues)
- [Z-PRO Suporte](https://zpro.passaportezdg.com.br/)
