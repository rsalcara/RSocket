#!/bin/bash

echo "🔍 Verificando Métricas do Prometheus"
echo "======================================"
echo ""

METRICS_URL="${METRICS_URL:-http://localhost:3000/metrics}"

echo "📊 Verificando endpoint: $METRICS_URL"
echo ""

# Check if endpoint is accessible
if ! curl -s -f "$METRICS_URL" > /dev/null 2>&1; then
    echo "❌ ERRO: Não foi possível acessar $METRICS_URL"
    echo "   Verifique se a aplicação está rodando"
    exit 1
fi

echo "✅ Endpoint acessível"
echo ""

# Check buffer cache size
echo "1️⃣ Verificando: zpro_baileys_buffer_cache_size"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_buffer_cache_size"; then
    echo "   ✅ Métrica encontrada!"
    curl -s "$METRICS_URL" | grep "zpro_baileys_buffer_cache_size" | grep -v "^#"
else
    echo "   ❌ Métrica NÃO encontrada - aplicação não foi reiniciada?"
fi
echo ""

# Check cache cleanup
echo "2️⃣ Verificando: zpro_baileys_buffer_cache_cleanup_total"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_buffer_cache_cleanup_total"; then
    echo "   ✅ Métrica encontrada!"
    curl -s "$METRICS_URL" | grep "zpro_baileys_buffer_cache_cleanup_total" | grep -v "^#"
else
    echo "   ❌ Métrica NÃO encontrada"
fi
echo ""

# Check buffer overflow
echo "3️⃣ Verificando: zpro_baileys_buffer_overflow_total"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_buffer_overflow_total"; then
    echo "   ✅ Métrica encontrada!"
    curl -s "$METRICS_URL" | grep "zpro_baileys_buffer_overflow_total" | grep -v "^#"
else
    echo "   ❌ Métrica NÃO encontrada"
fi
echo ""

# Check circuit breaker
echo "4️⃣ Verificando: zpro_baileys_adaptive_circuit_breaker_trips_total"
if curl -s "$METRICS_URL" | grep -q "zpro_baileys_adaptive_circuit_breaker_trips_total"; then
    echo "   ✅ Métrica encontrada!"
    curl -s "$METRICS_URL" | grep "zpro_baileys_adaptive_circuit_breaker_trips_total" | grep -v "^#"
else
    echo "   ❌ Métrica NÃO encontrada"
fi
echo ""

echo "======================================"
echo "📋 INTERPRETAÇÃO:"
echo ""
echo "✅ Se métricas foram encontradas mas valor = 0:"
echo "   → NORMAL! Significa que não houve eventos problemáticos"
echo "   → Cache cleanup = 0: cache nunca excedeu limite"
echo "   → Buffer overflow = 0: buffer nunca ficou cheio"
echo "   → Circuit breaker = 0: sistema estável"
echo ""
echo "❌ Se métricas NÃO foram encontradas:"
echo "   → Aplicação não foi reiniciada após merge do código"
echo "   → Execute: pm2 restart zpro-backend"
echo ""
