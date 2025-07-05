#!/bin/bash

echo "📊 MONITOR DETALHADO DO PUPPETEER - TEMPO REAL"
echo "=============================================="

if [ -z "$1" ]; then
    echo "❌ Uso: $0 <instance_id_partial>"
    echo "Exemplo: $0 1751741022579"
    exit 1
fi

INSTANCE_PARTIAL="$1"
LOG_FILE="logs/whatsapp-multi-client.log"

echo "🎯 Monitorando instância contendo: $INSTANCE_PARTIAL"
echo "📁 Arquivo de log: $LOG_FILE"
echo "🛑 Para parar: Ctrl+C"
echo ""

# Função para mostrar status da instância
show_instance_status() {
    local instance_id=$(curl -k -s "https://146.59.227.248/clients" | jq -r ".clients[] | select(.clientId | contains(\"$INSTANCE_PARTIAL\")) | .clientId" | head -1)
    
    if [ ! -z "$instance_id" ]; then
        local status_data=$(curl -k -s "https://146.59.227.248/clients/$instance_id/status")
        local status=$(echo "$status_data" | jq -r '.status // "unknown"')
        local has_qr=$(echo "$status_data" | jq -r '.hasQrCode // false')
        local phone=$(echo "$status_data" | jq -r '.phoneNumber // "null"')
        
        echo "📊 [$instance_id] Status: $status | QR: $has_qr | Phone: $phone"
    else
        echo "⚠️ Instância contendo '$INSTANCE_PARTIAL' não encontrada"
    fi
}

# Função para mostrar processos Chrome
show_chrome_processes() {
    local chrome_count=$(ps aux | grep chrome | grep -v grep | wc -l)
    echo "🌐 Processos Chrome ativos: $chrome_count"
}

# Função para mostrar uso de memória
show_memory_usage() {
    local memory_info=$(free -h | grep Mem)
    echo "💾 $memory_info"
}

# Monitoramento inicial
echo "📊 STATUS INICIAL"
echo "=================="
show_instance_status
show_chrome_processes
show_memory_usage
echo ""

echo "📋 LOGS EM TEMPO REAL (filtrando por Puppeteer/Chrome/QR/Timeout)"
echo "=================================================================="

# Monitor contínuo de logs com filtros específicos
tail -f "$LOG_FILE" | while read line; do
    # Verificar se a linha contém informações relevantes
    if echo "$line" | grep -qE "($INSTANCE_PARTIAL|INICIALIZANDO|QR CODE|TIMEOUT|Chrome|Puppeteer|ready|auth_failure|disconnected|connecting|qr_ready|connected)"; then
        timestamp=$(date '+%H:%M:%S')
        
        # Colorir por tipo de evento
        if echo "$line" | grep -q "INICIALIZANDO"; then
            echo "🚀 [$timestamp] $line"
        elif echo "$line" | grep -q "QR CODE"; then
            echo "📱 [$timestamp] $line"
        elif echo "$line" | grep -q "TIMEOUT"; then
            echo "⏰ [$timestamp] $line"
        elif echo "$line" | grep -q "ready"; then
            echo "🎉 [$timestamp] $line"
        elif echo "$line" | grep -q "auth_failure"; then
            echo "❌ [$timestamp] $line"
        elif echo "$line" | grep -q "disconnected"; then
            echo "🔌 [$timestamp] $line"
        elif echo "$line" | grep -q "connected"; then
            echo "✅ [$timestamp] $line"
        elif echo "$line" | grep -q "qr_ready"; then
            echo "📱 [$timestamp] $line"
        elif echo "$line" | grep -q "connecting"; then
            echo "🔄 [$timestamp] $line"
        else
            echo "📋 [$timestamp] $line"
        fi
        
        # Mostrar status atualizado a cada evento importante
        if echo "$line" | grep -qE "(QR CODE|ready|connected|auth_failure|disconnected)"; then
            echo "   ↳ Atualizando status..."
            show_instance_status
            echo ""
        fi
    fi
done