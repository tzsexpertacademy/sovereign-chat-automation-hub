#!/bin/bash

echo "📺 MONITOR EM TEMPO REAL - CONEXÃO WHATSAPP"
echo "==========================================="

# Função para monitorar logs
monitor_logs() {
    echo "📋 Monitorando logs do servidor..."
    tail -f /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log | while read line; do
        timestamp=$(date '+%H:%M:%S')
        
        # Destacar eventos importantes
        if [[ $line == *"CONECTADO"* ]]; then
            echo -e "🟢 [$timestamp] $line"
        elif [[ $line == *"QR"* ]]; then
            echo -e "🔵 [$timestamp] $line"  
        elif [[ $line == *"erro"* ]] || [[ $line == *"Error"* ]]; then
            echo -e "🔴 [$timestamp] $line"
        elif [[ $line == *"client_status_"* ]]; then
            echo -e "📡 [$timestamp] $line"
        else
            echo "⚪ [$timestamp] $line"
        fi
    done
}

# Função para testar API
test_api() {
    local instance_id="$1"
    echo ""
    echo "🧪 Testando API para: $instance_id"
    echo "Status: $(curl -s "https://146.59.227.248/clients/$instance_id/status" | jq -r '.status // "sem resposta"')"
    echo "Phone: $(curl -s "https://146.59.227.248/clients/$instance_id/status" | jq -r '.phoneNumber // "não conectado"')"
}

# Menu
echo ""
echo "Escolha uma opção:"
echo "1) Monitorar logs em tempo real"
echo "2) Testar API específica"
echo "3) Ambos (split screen)"
echo ""
read -p "Opção: " choice

case $choice in
    1)
        monitor_logs
        ;;
    2)
        read -p "Digite o Instance ID: " instance_id
        while true; do
            test_api "$instance_id"
            sleep 3
        done
        ;;
    3)
        read -p "Digite o Instance ID para monitorar: " instance_id
        echo "🔄 Iniciando monitoramento duplo..."
        
        # Abrir monitor de logs em background
        monitor_logs &
        LOG_PID=$!
        
        # Testar API em loop
        while true; do
            test_api "$instance_id"
            sleep 5
        done
        
        # Cleanup
        kill $LOG_PID 2>/dev/null
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac