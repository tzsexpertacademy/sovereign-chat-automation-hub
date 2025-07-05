#!/bin/bash

# Script para monitoramento contínuo da saúde dos clientes
# Arquivo: scripts/monitor-client-health.sh

INSTANCE_ID="${1:-35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751733656603}"
API_BASE="https://146.59.227.248"
INTERVAL="${2:-10}"

echo "🔄 MONITOR CONTÍNUO DE SAÚDE - Cliente WhatsApp"
echo "=============================================="
echo "🎯 Instance ID: $INSTANCE_ID"
echo "⏱️ Intervalo: ${INTERVAL}s"
echo "🛑 Para parar: Ctrl+C"
echo ""

# Função para extrair status
get_status() {
    curl -k -s "$API_BASE/clients/$INSTANCE_ID/status" | jq -r '.status // "error"'
}

# Função para extrair diagnóstico
get_diagnostic() {
    curl -k -s "$API_BASE/clients/$INSTANCE_ID/status" | jq -r '.diagnostic.exists // false'
}

# Função para contar clientes ativos
get_active_clients() {
    curl -k -s "$API_BASE/health" | jq -r '.activeClients // 0'
}

echo "📊 Status | Existe | Clientes | Timestamp"
echo "=========================================="

while true; do
    TIMESTAMP=$(date '+%H:%M:%S')
    STATUS=$(get_status)
    EXISTS=$(get_diagnostic)
    ACTIVE=$(get_active_clients)
    
    # Colorir output baseado no status
    if [[ "$STATUS" == "connected" ]]; then
        COLOR="\033[32m" # Verde
    elif [[ "$STATUS" == "qr_ready" ]]; then
        COLOR="\033[33m" # Amarelo
    elif [[ "$STATUS" == "connecting" ]]; then
        COLOR="\033[36m" # Ciano
    else
        COLOR="\033[31m" # Vermelho
    fi
    
    printf "${COLOR}%-9s\033[0m | %-6s | %-8s | %s\n" "$STATUS" "$EXISTS" "$ACTIVE" "$TIMESTAMP"
    
    sleep $INTERVAL
done