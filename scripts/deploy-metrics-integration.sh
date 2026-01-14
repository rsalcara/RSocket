#!/bin/bash

# Script de Deploy - Integração Completa de Métricas Prometheus
# Autor: Claude + RBaileys
# Data: 2026-01-14

set -e  # Para em caso de erro

echo "=========================================="
echo "🚀 DEPLOY - INTEGRAÇÃO PROMETHEUS COMPLETA"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
BACKEND_DIR="/home/deployzdg/zpro.io/backend"
RBAILEYS_DIR="$BACKEND_DIR/node_modules/@whiskeysockets/baileys"

log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

# ==================================================================
# PASSO 1: Backup
# ==================================================================
log_step "Passo 1: Criando backup..."
BACKUP_DIR="/tmp/rbaileys-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "$RBAILEYS_DIR/lib" ]; then
    cp -r "$RBAILEYS_DIR/lib" "$BACKUP_DIR/"
    log_info "Backup criado em: $BACKUP_DIR"
else
    log_warn "Diretório lib/ não encontrado, pulando backup"
fi

echo ""

# ==================================================================
# PASSO 2: Copiar arquivos compilados
# ==================================================================
log_step "Passo 2: Copiando arquivos compilados do RBaileys..."

# Verificar se estamos no diretório correto
if [ ! -d "./lib" ]; then
    log_error "Diretório lib/ não encontrado! Execute este script do diretório raiz do RBaileys"
    exit 1
fi

# Copiar lib/ compilado
if [ -d "$RBAILEYS_DIR" ]; then
    cp -r ./lib/* "$RBAILEYS_DIR/lib/"
    log_info "Arquivos compilados copiados"
else
    log_error "RBaileys não encontrado em: $RBAILEYS_DIR"
    exit 1
fi

echo ""

# ==================================================================
# PASSO 3: Verificar ENV
# ==================================================================
log_step "Passo 3: Verificando configuração ENV..."

ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_error "Arquivo .env não encontrado: $ENV_FILE"
    exit 1
fi

# Verificar se Prometheus está habilitado
if grep -q "BAILEYS_PROMETHEUS_ENABLED=true" "$ENV_FILE"; then
    log_info "Prometheus habilitado no .env"

    # Verificar porta
    if grep -q "BAILEYS_PROMETHEUS_PORT=9092" "$ENV_FILE"; then
        log_info "Porta 9092 configurada corretamente"
    else
        log_warn "Porta Prometheus pode estar incorreta (esperado: 9092)"
    fi
else
    log_warn "Prometheus não está habilitado no .env"
    echo ""
    echo "Deseja habilitar agora? (s/n)"
    read -r RESPOSTA

    if [ "$RESPOSTA" = "s" ]; then
        echo "" >> "$ENV_FILE"
        echo "# Prometheus Metrics - Integração Completa $(date +%Y-%m-%d)" >> "$ENV_FILE"
        echo "BAILEYS_PROMETHEUS_ENABLED=true" >> "$ENV_FILE"
        echo "BAILEYS_PROMETHEUS_PORT=9092" >> "$ENV_FILE"
        echo "BAILEYS_PROMETHEUS_PATH=/metrics" >> "$ENV_FILE"
        echo "BAILEYS_PROMETHEUS_PREFIX=zpro_baileys_" >> "$ENV_FILE"
        echo "BAILEYS_PROMETHEUS_LABELS={\"environment\":\"production\",\"service\":\"zpro-backend\",\"server\":\"main\"}" >> "$ENV_FILE"
        echo "BAILEYS_PROMETHEUS_COLLECT_DEFAULT=true" >> "$ENV_FILE"
        log_info "Configuração Prometheus adicionada ao .env"
    fi
fi

echo ""

# ==================================================================
# PASSO 4: Reiniciar backend
# ==================================================================
log_step "Passo 4: Reiniciando backend..."
pm2 restart zpro-backend
sleep 3
log_info "Backend reiniciado"

echo ""

# ==================================================================
# PASSO 5: Verificar métricas
# ==================================================================
log_step "Passo 5: Verificando métricas..."
sleep 2

if curl -s -f http://localhost:9092/metrics > /dev/null 2>&1; then
    log_info "Endpoint /metrics respondendo na porta 9092"

    # Contar métricas
    METRIC_COUNT=$(curl -s http://localhost:9092/metrics | grep -c "^zpro_baileys_")
    log_info "Total de métricas RBaileys: $METRIC_COUNT"

    echo ""
    echo "Exemplos de métricas encontradas:"
    curl -s http://localhost:9092/metrics | grep "^zpro_baileys_" | head -10
    echo ""
else
    log_error "Endpoint não está respondendo na porta 9092"
    echo ""
    echo "Verificando logs de erro:"
    pm2 logs zpro-backend --lines 20 --nostream | grep -i "prometheus\|error"
    exit 1
fi

echo ""

# ==================================================================
# PASSO 6: Testar integração
# ==================================================================
log_step "Passo 6: Testando integração de métricas..."

echo "Aguardando atividade no sistema (10 segundos)..."
sleep 10

echo ""
echo "Verificando métricas de mensagens:"
MESSAGES_RECEIVED=$(curl -s http://localhost:9092/metrics | grep "zpro_baileys_messages_received_total" | grep -v "^#" || echo "0")
MESSAGES_SENT=$(curl -s http://localhost:9092/metrics | grep "zpro_baileys_messages_sent_total" | grep -v "^#" || echo "0")
ACTIVE_CONNECTIONS=$(curl -s http://localhost:9092/metrics | grep "zpro_baileys_active_connections" | grep -v "^#" || echo "0")

echo "$MESSAGES_RECEIVED"
echo "$MESSAGES_SENT"
echo "$ACTIVE_CONNECTIONS"

if echo "$ACTIVE_CONNECTIONS" | grep -q "zpro_baileys_active_connections{"; then
    log_info "Métricas de conexão funcionando"
else
    log_warn "Métricas de conexão ainda não têm valores (normal se não houver conexões ativas)"
fi

echo ""

# ==================================================================
# RESULTADO FINAL
# ==================================================================
echo "=========================================="
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "=========================================="
echo ""
echo "📊 Métricas disponíveis: $METRIC_COUNT"
echo ""
echo "🔗 Links úteis:"
echo "   Métricas: http://localhost:9092/metrics"
echo "   Prometheus: http://SEU_IP:9090"
echo "   Grafana: http://SEU_IP:3022"
echo ""
echo "📚 Documentação:"
echo "   - Guia completo: docs/improvements/PROMETHEUS_METRICS_GUIDE.md"
echo "   - Dashboard: docs/improvements/grafana/baileys-dashboard-pt-br.json"
echo ""
echo "🎯 Próximos passos:"
echo "   1. Importar dashboard no Grafana"
echo "   2. Conectar uma instância WhatsApp"
echo "   3. Enviar/receber mensagens para testar métricas"
echo "   4. Verificar dashboard em tempo real"
echo ""
echo "=========================================="
echo "📞 Suporte:"
echo "   Em caso de problemas, execute:"
echo "   bash scripts/diagnose-prometheus.sh"
echo "=========================================="
echo ""
