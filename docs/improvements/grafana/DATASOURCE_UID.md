# 🔧 Corrigir Datasource UID no Dashboard

## Problema: Dashboard Inteiro Sem Dados

Se **TODOS os painéis** do dashboard estão sem dados (CPU, memória, buffers, tudo vazio), o problema é o **Datasource UID** incorreto.

O dashboard está configurado para usar o datasource com UID `efa2xes2233swf`, mas esse UID provavelmente não existe no seu Grafana.

---

## ✅ Solução 1: Atualizar UID Automaticamente (RECOMENDADO)

### Passo 1: Encontrar o UID Correto

1. Abra o **Grafana** no navegador
2. Vá em **Configuration (⚙️)** → **Data Sources**
3. Clique no seu datasource **Prometheus**
4. Olhe a **URL** no navegador:
   ```
   http://seu-grafana:3000/datasources/edit/PDZQQ9VVz
                                              ^^^^^^^^^^
                                              Este é o UID!
   ```
5. **Copie o UID** (exemplo: `PDZQQ9VVz`)

### Passo 2: Executar o Script

```bash
cd C:\github\RBaileys

# Substitua SEU_UID_AQUI pelo UID que você copiou
python scripts/fix-datasource-uid.py SEU_UID_AQUI

# Exemplo:
python scripts/fix-datasource-uid.py PDZQQ9VVz
```

**Saída esperada:**
```
🔧 Atualizando Datasource UID no Dashboard
==================================================
📂 Arquivo: docs/improvements/grafana/Dashboard Baileys.json
🔴 UID antigo: efa2xes2233swf
🟢 UID novo: PDZQQ9VVz

✅ Atualizado com sucesso!
📊 Total de substituições: 88
```

### Passo 3: Importar Dashboard Atualizado

1. No Grafana, vá em **Dashboards** → **Import**
2. Clique em **Upload JSON file**
3. Selecione `C:\github\RBaileys\docs\improvements\grafana\Dashboard Baileys.json`
4. Clique em **Import**

**PRONTO!** Todos os painéis devem mostrar dados agora. 🎉

---

## ✅ Solução 2: Editar Diretamente no Arquivo JSON

Se preferir editar manualmente:

```powershell
# No PowerShell (Windows)
cd C:\github\RBaileys

# Substituir todas as ocorrências do UID antigo pelo novo
(Get-Content "docs\improvements\grafana\Dashboard Baileys.json") -replace 'efa2xes2233swf', 'SEU_UID_AQUI' | Set-Content "docs\improvements\grafana\Dashboard Baileys.json"
```

```bash
# No Bash (Linux/Mac)
cd /path/to/RBaileys

# Substituir todas as ocorrências
sed -i 's/efa2xes2233swf/SEU_UID_AQUI/g' "docs/improvements/grafana/Dashboard Baileys.json"
```

---

## ✅ Solução 3: Configurar Datasource no Grafana UI (Mais Fácil)

Se você não quer editar o arquivo JSON, pode configurar direto no Grafana:

### Ao Importar o Dashboard:

1. No Grafana, vá em **Dashboards** → **Import**
2. Clique em **Upload JSON file**
3. Selecione o arquivo `Dashboard Baileys.json`
4. **IMPORTANTE**: Na tela de import, você verá:
   ```
   ⚠️ Datasource efa2xes2233swf not found

   Select a Prometheus datasource: [dropdown]
   ```
5. Selecione seu datasource Prometheus no dropdown
6. Clique em **Import**

**PRONTO!** O Grafana vai usar o datasource correto automaticamente.

---

## 🔍 Como Verificar Se Funcionou

Após corrigir o UID:

### 1. Painéis Devem Mostrar Dados

Verifique se estes painéis mostram dados:
- ⚙️ CPU Zpro-Backend %
- 💾 Memória Zpro-Backend
- 🚀 Taxa de Flush do Buffer

Se ainda não mostrar dados, verifique o [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

### 2. Verificar No Grafana Explore

1. Vá em **Explore** no menu lateral
2. Selecione seu datasource Prometheus
3. Digite esta query:
   ```promql
   zpro_baileys_process_cpu_seconds_total
   ```
4. Clique em **Run Query**
5. Se aparecer dados → Prometheus está funcionando!

---

## 📋 Referência Rápida

### Onde Está Configurado o UID?

O UID do datasource aparece em **2 lugares** no JSON do dashboard:

```json
{
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "efa2xes2233swf"  ← AQUI
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "efa2xes2233swf"  ← E AQUI
          },
          "expr": "zpro_baileys_process_cpu_seconds_total"
        }
      ]
    }
  ]
}
```

O script Python atualiza **todas as ocorrências** automaticamente.

---

## 🆘 Ainda Não Funciona?

Se após corrigir o UID ainda não aparecer dados:

### Checklist:

- [ ] UID está correto (conferiu no Grafana?)
- [ ] Datasource Prometheus está funcionando (teste no Explore)
- [ ] Aplicação está expondo métricas no `/metrics` endpoint
- [ ] Prometheus está coletando (scraping) as métricas

### Debug:

```bash
# 1. Verificar se métricas estão sendo exportadas
curl http://localhost:3000/metrics | grep zpro_baileys

# 2. Verificar se Prometheus consegue acessar
# No Grafana UI → Configuration → Data Sources → Prometheus → Test
# Deve mostrar: "Data source is working"
```

---

## 📝 Resumo

**Problema**: Dashboard usa UID `efa2xes2233swf` que não existe no seu Grafana

**Solução Rápida**:
1. Encontre o UID correto em Configuration → Data Sources
2. Execute: `python scripts/fix-datasource-uid.py SEU_UID`
3. Importe o dashboard atualizado no Grafana

**Solução Mais Fácil**:
- Ao importar o dashboard no Grafana, selecione o datasource correto no dropdown

✅ Pronto! Todos os painéis devem funcionar agora.
