#!/bin/bash

echo "🔍 Testando Métricas de Buffer Destruído"
echo "========================================"
echo ""

# Configurar URL base (ajuste conforme necessário)
METRICS_URL="${METRICS_URL:-http://localhost:3000/metrics}"

echo "📊 Verificando endpoint: $METRICS_URL"
echo ""

# Verificar se endpoint está acessível
if ! curl -s -f "$METRICS_URL" > /dev/null 2>&1; then
    echo "❌ ERRO: Não foi possível acessar $METRICS_URL"
    echo "   Verifique se a aplicação está rodando e o Prometheus está habilitado"
    exit 1
fi

echo "✅ Endpoint acessível"
echo ""

# Verificar métricas de buffer destruído
echo "🔍 Buscando métrica: zpro_baileys_buffer_destroyed_total"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_buffer_destroyed_total"; then
    echo "✅ Métrica encontrada!"
    echo ""
    curl -s "$METRICS_URL" | grep "zpro_baileys_buffer_destroyed"
else
    echo "❌ Métrica NÃO encontrada"
    echo "   A aplicação pode não ter sido reiniciada com o novo código"
fi

echo ""
echo ""

# Verificar métricas de flush final
echo "🔍 Buscando métrica: zpro_baileys_buffer_final_flush_total"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_buffer_final_flush_total"; then
    echo "✅ Métrica encontrada!"
    echo ""
    curl -s "$METRICS_URL" | grep "zpro_baileys_buffer_final_flush"
else
    echo "❌ Métrica NÃO encontrada"
    echo "   A aplicação pode não ter sido reiniciada com o novo código"
fi

echo ""
echo ""

# Verificar métricas de buffer ativo
echo "🔍 Buscando métrica: zpro_baileys_buffer_active_count"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_buffer_active_count"; then
    echo "✅ Métrica encontrada!"
    echo ""
    curl -s "$METRICS_URL" | grep "zpro_baileys_buffer_active"
else
    echo "❌ Métrica NÃO encontrada"
fi

echo ""
echo ""
echo "========================================"
echo "📋 RESUMO:"
echo ""
echo "Se todas as métricas foram encontradas mas mostram 0:"
echo "  → Normal! Elas incrementam quando buffers são destruídos"
echo "  → Teste: conecte/desconecte um WhatsApp"
echo ""
echo "Se as métricas NÃO foram encontradas:"
echo "  → Reinicie a aplicação: pm2 restart zpro-backend"
echo "  → Verifique se o código compilado está atualizado"
echo ""
