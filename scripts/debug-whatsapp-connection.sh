#!/bin/bash

echo "🔍 DEBUG: Monitorando conexão WhatsApp em tempo real..."
echo "📅 Iniciado em: $(date)"
echo "================================"

# Função para testar status de instância específica
test_instance_status() {
    local instance_id=$1
    echo "🎯 Testando instância: $instance_id"
    
    echo "📡 GET Status:"
    curl -s "https://146.59.227.248/clients/$instance_id/status" | jq '.'
    
    echo ""
    echo "📡 GET Chats:"  
    curl -s "https://146.59.227.248/clients/$instance_id/chats" | jq '.'
    
    echo ""
    echo "================================"
}

# Função para monitorar logs do servidor
monitor_server_logs() {
    echo "📋 Últimos logs do servidor:"
    tail -n 20 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log 2>/dev/null || echo "❌ Log não encontrado"
    echo "================================"
}

# Função para verificar processos
check_processes() {
    echo "🔧 Processos PM2:"
    pm2 list
    echo ""
    echo "🔧 Processos Node relacionados:"
    ps aux | grep node | grep -v grep
    echo "================================"
}

# Menu interativo
while true; do
    echo ""
    echo "🛠️  MENU DEBUG WHATSAPP:"
    echo "1) Testar instância específica"
    echo "2) Monitorar logs do servidor" 
    echo "3) Verificar processos"
    echo "4) Teste completo health check"
    echo "5) Monitorar logs em tempo real"
    echo "6) Sair"
    echo ""
    read -p "Escolha uma opção: " option
    
    case $option in
        1)
            read -p "📝 Digite o ID da instância: " instance_id
            test_instance_status "$instance_id"
            ;;
        2)
            monitor_server_logs
            ;;
        3)
            check_processes
            ;;
        4)
            echo "🏥 Health Check Completo:"
            curl -s "https://146.59.227.248/health" | jq '.'
            echo ""
            echo "📊 Clientes ativos:"
            curl -s "https://146.59.227.248/clients" | jq '.'
            ;;
        5)
            echo "📺 Monitorando logs em tempo real (Ctrl+C para sair):"
            tail -f /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log 2>/dev/null || echo "❌ Log não encontrado"
            ;;
        6)
            echo "👋 Encerrando debug..."
            exit 0
            ;;
        *)
            echo "❌ Opção inválida!"
            ;;
    esac
done