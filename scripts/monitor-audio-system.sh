
#!/bin/bash

# Script para monitorar o sistema de áudio em tempo real
# Monitora logs, performance e conectividade

LOG_FILE="/home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log"
SERVER_PORT="4000"

echo "📊 ===== MONITOR DO SISTEMA DE ÁUDIO ====="
echo "📅 $(date)"
echo "🔍 Monitorando logs: $LOG_FILE"
echo "🌐 Porta do servidor: $SERVER_PORT"
echo ""
echo "🎯 Pressione Ctrl+C para parar o monitoramento"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Função para mostrar status do servidor
show_server_status() {
    if pgrep -f "whatsapp-multi-client-server.js" > /dev/null; then
        echo "✅ Servidor: ATIVO"
    else
        echo "❌ Servidor: INATIVO"
    fi
    
    if netstat -tlnp 2>/dev/null | grep ":$SERVER_PORT " > /dev/null; then
        echo "✅ Porta $SERVER_PORT: ESCUTANDO"
    else
        echo "❌ Porta $SERVER_PORT: NÃO DISPONÍVEL"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Mostrar status inicial
show_server_status
echo ""

# Monitorar logs em tempo real com filtros para áudio
if [ -f "$LOG_FILE" ]; then
    echo "📋 Monitorando atividade de áudio..."
    echo ""
    
    tail -f "$LOG_FILE" | grep --line-buffered -E "(🎵|🔄|📤|✅|❌|send-audio|AudioProcessor|ÁUDIO|audio)" | while read line; do
        timestamp=$(date '+%H:%M:%S')
        echo "[$timestamp] $line"
    done
else
    echo "⚠️  Log file não encontrado: $LOG_FILE"
    echo "🔍 Verificar se o servidor está rodando e gerando logs"
    echo ""
    echo "🧪 Testando conectividade..."
    
    while true; do
        show_server_status
        echo ""
        sleep 10
    done
fi
