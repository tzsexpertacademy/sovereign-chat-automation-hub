#!/bin/bash

echo "🐛 DIAGNÓSTICO COMPLETO DO WHATSAPP"
echo "===================================="
echo "📅 Iniciado em: $(date)"
echo ""

# Tornar scripts executáveis
chmod +x scripts/debug-whatsapp-connection.sh
chmod +x scripts/test-specific-instance.sh  
chmod +x scripts/debug-websocket-events.sh

# Função para executar com separadores visuais
run_section() {
    local title=$1
    local command=$2
    
    echo ""
    echo "🔍 $title"
    echo "$(printf '=%.0s' {1..50})"
    eval $command
    echo "$(printf '=%.0s' {1..50})"
    echo ""
}

run_section "HEALTH CHECK DO SERVIDOR" "curl -s https://146.59.227.248/health | jq '.'"

run_section "LISTA DE CLIENTES ATIVOS" "curl -s https://146.59.227.248/clients | jq '.'"

run_section "STATUS DA INSTÂNCIA PROBLEMÁTICA" "./scripts/test-specific-instance.sh 35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751730495129"

run_section "LOGS RECENTES DO SERVIDOR" "tail -n 30 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log 2>/dev/null || echo 'Log não encontrado'"

run_section "PROCESSOS PM2" "pm2 list"

echo ""
echo "🎯 PRÓXIMOS PASSOS RECOMENDADOS:"
echo "1️⃣ Execute: ./scripts/debug-websocket-events.sh"
echo "   (Para monitorar eventos WebSocket em tempo real)"
echo ""
echo "2️⃣ Execute: ./scripts/debug-whatsapp-connection.sh" 
echo "   (Para menu interativo de debug)"
echo ""
echo "3️⃣ Depois de escanear QR code, execute novamente:"
echo "   ./scripts/test-specific-instance.sh [INSTANCE_ID]"
echo ""
echo "📋 Para monitorar logs em tempo real:"
echo "   tail -f /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log"