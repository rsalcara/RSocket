#!/bin/bash

# Script Automático de Correção - Conflito de Porta Prometheus
# Autor: Claude + RBaileys
# Data: 2026-01-13

set -e  # Para em caso de erro

echo "=========================================="
echo "🔧 CORREÇÃO AUTOMÁTICA - PORTA PROMETHEUS"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Caminhos (ajuste se necessário)
BACKEND_DIR="/home/deployzdg/zpro.io/backend"
ENV_FILE="$BACKEND_DIR/.env"
PROMETHEUS_DIR="/home/deployzdg/zpro.io/prometheus"
PROMETHEUS_YML="$PROMETHEUS_DIR/prometheus.yml"

# Função para log com cor
log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se arquivo .env existe
if [ ! -f "$ENV_FILE" ]; then
    log_error "Arquivo .env não encontrado em: $ENV_FILE"
    echo "Por favor, informe o caminho correto do .env:"
    read -r ENV_FILE
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Arquivo ainda não encontrado. Abortando."
        exit 1
    fi
fi

log_info "Arquivo .env encontrado: $ENV_FILE"
echo ""

# Passo 1: Backup do .env
echo "📋 Passo 1: Fazendo backup do .env..."
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
log_info "Backup criado"
echo ""

# Passo 2: Verificar se já existe configuração Prometheus
echo "📋 Passo 2: Verificando configuração existente..."
if grep -q "BAILEYS_PROMETHEUS_ENABLED" "$ENV_FILE"; then
    log_warn "Configuração Prometheus já existe no .env"
    echo "Deseja substituir? (s/n)"
    read -r RESPOSTA
    if [ "$RESPOSTA" != "s" ]; then
        log_info "Mantendo configuração existente"
        echo ""
        # Apenas atualizar a porta se necessário
        if grep -q "BAILEYS_PROMETHEUS_PORT=9090" "$ENV_FILE"; then
            log_warn "Porta 9090 detectada (conflito), atualizando para 9092..."
            sed -i 's/BAILEYS_PROMETHEUS_PORT=9090/BAILEYS_PROMETHEUS_PORT=9092/' "$ENV_FILE"
            log_info "Porta atualizada para 9092"
        fi
    else
        # Remover configuração antiga
        sed -i '/BAILEYS_PROMETHEUS/d' "$ENV_FILE"
        log_info "Configuração antiga removida"
    fi
else
    log_info "Nenhuma configuração Prometheus encontrada (primeira instalação)"
fi
echo ""

# Passo 3: Adicionar configuração Prometheus
echo "📋 Passo 3: Adicionando configuração Prometheus..."
cat >> "$ENV_FILE" <<EOF

# ========================================
# Prometheus Metrics Configuration
# Adicionado automaticamente em $(date +%Y-%m-%d)
# ========================================
BAILEYS_PROMETHEUS_ENABLED=true
BAILEYS_PROMETHEUS_PORT=9092
BAILEYS_PROMETHEUS_PATH=/metrics
BAILEYS_PROMETHEUS_PREFIX=zpro_baileys_
BAILEYS_PROMETHEUS_LABELS={"environment":"production","service":"zpro"}
BAILEYS_PROMETHEUS_COLLECT_DEFAULT=true
EOF

log_info "Configuração Prometheus adicionada ao .env"
echo ""

# Passo 4: Mostrar configuração
echo "📋 Passo 4: Configuração aplicada:"
echo "-----------------------------------"
grep "BAILEYS_PROMETHEUS" "$ENV_FILE"
echo ""

# Passo 5: Reiniciar backend
echo "📋 Passo 5: Reiniciando backend..."
pm2 restart zpro-backend
sleep 3
log_info "Backend reiniciado"
echo ""

# Passo 6: Verificar logs
echo "📋 Passo 6: Verificando inicialização..."
echo "-----------------------------------"
pm2 logs zpro-backend --lines 10 --nostream | grep -i prometheus || log_warn "Nenhuma menção ao Prometheus nos logs recentes"
echo ""

# Passo 7: Testar endpoint
echo "📋 Passo 7: Testando endpoint de métricas..."
echo "-----------------------------------"
sleep 2  # Aguardar servidor iniciar completamente

if curl -s -f http://localhost:9092/metrics > /dev/null 2>&1; then
    log_info "Endpoint respondendo na porta 9092!"
    echo ""
    echo "Primeiras métricas encontradas:"
    curl -s http://localhost:9092/metrics | grep "^zpro_baileys_" | head -5
    echo ""

    # Contar métricas
    METRIC_COUNT=$(curl -s http://localhost:9092/metrics | grep -c "^zpro_baileys_")
    log_info "Total de métricas RBaileys: $METRIC_COUNT"
else
    log_error "Endpoint não está respondendo na porta 9092"
    echo ""
    echo "Verificando logs de erro:"
    pm2 logs zpro-backend --lines 20 --nostream | grep -i "error\|prometheus"
    exit 1
fi
echo ""

# Passo 8: Verificar se Prometheus precisa ser atualizado
echo "📋 Passo 8: Verificando configuração do Prometheus..."
echo "-----------------------------------"

if [ -f "$PROMETHEUS_YML" ]; then
    log_info "prometheus.yml encontrado: $PROMETHEUS_YML"

    # Verificar se já tem job rbaileys
    if grep -q "job_name.*rbaileys" "$PROMETHEUS_YML"; then
        log_warn "Job 'rbaileys' já existe no prometheus.yml"

        # Verificar se está apontando para porta correta
        if grep -A 2 "job_name.*rbaileys" "$PROMETHEUS_YML" | grep -q "localhost:9092"; then
            log_info "Job já configurado corretamente para porta 9092"
        else
            log_warn "Job rbaileys está apontando para porta errada"
            echo ""
            echo "Deseja atualizar automaticamente o prometheus.yml? (s/n)"
            read -r RESPOSTA
            if [ "$RESPOSTA" = "s" ]; then
                # Backup do prometheus.yml
                cp "$PROMETHEUS_YML" "$PROMETHEUS_YML.backup.$(date +%Y%m%d_%H%M%S)"

                # Atualizar porta no job rbaileys
                sed -i '/job_name.*rbaileys/,/targets:/ s/localhost:[0-9]*/localhost:9092/' "$PROMETHEUS_YML"
                log_info "prometheus.yml atualizado"

                # Reiniciar Prometheus
                echo "Reiniciando Prometheus..."
                if docker ps | grep -q prometheus; then
                    docker restart prometheus
                elif systemctl is-active --quiet prometheus; then
                    sudo systemctl restart prometheus
                else
                    log_warn "Não foi possível identificar como reiniciar o Prometheus"
                    echo "Por favor, reinicie manualmente"
                fi
            fi
        fi
    else
        log_warn "Job 'rbaileys' não encontrado no prometheus.yml"
        echo ""
        echo "Adicione esta configuração ao prometheus.yml:"
        echo ""
        echo "-----------------------------------"
        cat <<EOF
  - job_name: 'rbaileys'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9092']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'zpro-backend'
EOF
        echo "-----------------------------------"
    fi
else
    log_warn "prometheus.yml não encontrado em: $PROMETHEUS_YML"
    echo "Por favor, configure manualmente o job 'rbaileys'"
fi
echo ""

# Resultado final
echo "=========================================="
echo "✅ CORREÇÃO CONCLUÍDA COM SUCESSO!"
echo "=========================================="
echo ""
echo "📊 Próximos passos:"
echo ""
echo "1. Verificar targets no Prometheus:"
echo "   http://SEU_IP_SERVIDOR:9091/targets"
echo ""
echo "2. Testar queries no Prometheus:"
echo "   http://SEU_IP_SERVIDOR:9091"
echo "   Query: zpro_baileys_connection_state"
echo ""
echo "3. Importar dashboard no Grafana:"
echo "   http://SEU_IP_SERVIDOR:3000"
echo "   Arquivo: docs/improvements/grafana/baileys-complete-dashboard.json"
echo ""
echo "4. Verificar métricas em tempo real:"
echo "   curl http://localhost:9092/metrics | grep zpro_baileys"
echo ""
echo "=========================================="
echo "📚 Documentação completa:"
echo "   docs/improvements/PROMETHEUS_PORT_FIX.md"
echo "   docs/improvements/PROMETHEUS_INTEGRATION.md"
echo "=========================================="
echo ""
