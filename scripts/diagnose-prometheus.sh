#!/bin/bash

# Script de Diagnóstico Prometheus - RBaileys
# Identifica por que as métricas não estão sendo coletadas

echo "======================================"
echo "🔍 DIAGNÓSTICO PROMETHEUS - RBAILEYS"
echo "======================================"
echo ""

# TESTE 1: Verificar variáveis de ambiente
echo "📋 TESTE 1: Verificando configuração ENV"
echo "--------------------------------------"
if [ -f "/home/deployzdg/zpro.io/backend/.env" ]; then
    echo "✅ Arquivo .env encontrado"
    echo ""
    echo "Variáveis Prometheus configuradas:"
    grep -i "PROMETHEUS" /home/deployzdg/zpro.io/backend/.env 2>/dev/null || echo "⚠️  Nenhuma variável PROMETHEUS encontrada!"
    echo ""
else
    echo "❌ Arquivo .env NÃO encontrado em /home/deployzdg/zpro.io/backend/.env"
    echo "   Por favor, informe o caminho correto do .env"
fi
echo ""

# TESTE 2: Verificar se backend está rodando
echo "📋 TESTE 2: Verificando processo do backend"
echo "--------------------------------------"
pm2 list | grep -i backend || echo "⚠️  Backend não encontrado no PM2"
echo ""

# TESTE 3: Verificar logs do backend
echo "📋 TESTE 3: Verificando logs de inicialização"
echo "--------------------------------------"
echo "Últimas 50 linhas dos logs do backend (filtro: prometheus):"
pm2 logs zpro-backend --lines 50 --nostream 2>/dev/null | grep -i prometheus || echo "⚠️  Nenhuma menção ao Prometheus nos logs"
echo ""

# TESTE 4: Testar endpoint de métricas diretamente
echo "📋 TESTE 4: Testando endpoint /metrics do backend"
echo "--------------------------------------"
echo "Tentando acessar http://localhost:9090/metrics..."

# Tenta várias possibilidades de porta
for PORT in 9090 9091 9092 8080; do
    echo ""
    echo "Testando porta $PORT..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/metrics 2>/dev/null)

    if [ "$RESPONSE" = "200" ]; then
        echo "✅ Endpoint respondendo na porta $PORT!"
        echo "Primeiras 10 linhas:"
        curl -s http://localhost:$PORT/metrics 2>/dev/null | head -10
        echo ""
        echo "Procurando métricas zpro_baileys_*:"
        BAILEYS_METRICS=$(curl -s http://localhost:$PORT/metrics 2>/dev/null | grep -c "zpro_baileys_")
        if [ "$BAILEYS_METRICS" -gt 0 ]; then
            echo "✅ ENCONTRADAS $BAILEYS_METRICS métricas do RBaileys!"
            curl -s http://localhost:$PORT/metrics 2>/dev/null | grep "zpro_baileys_" | head -5
        else
            echo "❌ Nenhuma métrica zpro_baileys_* encontrada"
            echo "   O backend expõe métricas, mas RBaileys não está inicializado"
        fi
        break
    elif [ "$RESPONSE" = "000" ]; then
        echo "⚠️  Porta $PORT não responde (conexão recusada)"
    else
        echo "⚠️  Porta $PORT retornou HTTP $RESPONSE"
    fi
done
echo ""

# TESTE 5: Verificar portas em uso
echo "📋 TESTE 5: Verificando portas em uso"
echo "--------------------------------------"
echo "Processos ouvindo nas portas 9090-9092:"
sudo lsof -i :9090 -i :9091 -i :9092 2>/dev/null | grep LISTEN || echo "⚠️  Nenhum processo ouvindo nessas portas"
echo ""

# TESTE 6: Verificar configuração do Prometheus
echo "📋 TESTE 6: Verificando configuração do Prometheus"
echo "--------------------------------------"
if [ -f "/home/deployzdg/zpro.io/prometheus/prometheus.yml" ]; then
    echo "✅ prometheus.yml encontrado"
    echo ""
    echo "Configuração de scrape_configs:"
    grep -A 10 "scrape_configs:" /home/deployzdg/zpro.io/prometheus/prometheus.yml 2>/dev/null
    echo ""
elif docker ps | grep -q prometheus; then
    echo "⚠️  Prometheus rodando no Docker"
    echo "   Precisamos verificar o docker-compose.yml"
else
    echo "⚠️  prometheus.yml não encontrado no caminho padrão"
    echo "   Por favor, informe onde está o prometheus.yml"
fi
echo ""

# TESTE 7: Verificar targets do Prometheus
echo "📋 TESTE 7: Verificando targets ativos no Prometheus"
echo "--------------------------------------"
echo "Tentando acessar API do Prometheus..."

for PORT in 9091 9090 9092; do
    TARGETS=$(curl -s http://localhost:$PORT/api/v1/targets 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$TARGETS" ]; then
        echo "✅ Prometheus API respondendo na porta $PORT"
        echo "$TARGETS" | grep -o '"job":"[^"]*"' | sort -u || echo "Nenhum target configurado"
        break
    fi
done
echo ""

# RESULTADO FINAL
echo "======================================"
echo "📊 RESUMO DO DIAGNÓSTICO"
echo "======================================"
echo ""
echo "Execute este relatório e envie a saída completa."
echo "Com base nos resultados, vou identificar o problema exato."
echo ""
echo "Problemas comuns:"
echo "1. ❌ ENV não configurado → Adicionar BAILEYS_PROMETHEUS_ENABLED=true ao .env"
echo "2. ❌ Backend não reiniciado → Executar: pm2 restart zpro-backend"
echo "3. ❌ Prometheus apontando para porta errada → Ajustar prometheus.yml"
echo "4. ❌ Porta em conflito → Mudar BAILEYS_PROMETHEUS_PORT no .env"
echo ""
