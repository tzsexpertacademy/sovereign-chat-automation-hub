
#!/bin/bash

echo "📊 MONITOR DE CONEXÕES WHATSAPP - TEMPO REAL"
echo "==========================================="

while true; do
    echo ""
    echo "⏰ $(date '+%H:%M:%S') - Status das Conexões:"
    echo "==========================================="
    
    # Verificar servidor
    SERVER_PID=$(pgrep -f "whatsapp-multi-client-server.js")
    if [ ! -z "$SERVER_PID" ]; then
        echo "✅ Servidor rodando (PID: $SERVER_PID)"
    else
        echo "❌ Servidor não encontrado"
    fi
    
    # Verificar processos Chrome/Puppeteer
    CHROME_COUNT=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)
    echo "🖥️ Processos Chrome: $CHROME_COUNT"
    
    # Health check detalhado
    HEALTH=$(curl -k -s "https://146.59.227.248/health" 2>/dev/null)
    if [ ! -z "$HEALTH" ]; then
        ACTIVE_CLIENTS=$(echo "$HEALTH" | grep -o '"activeClients":[0-9]*' | cut -d':' -f2)
        CONNECTED_CLIENTS=$(echo "$HEALTH" | grep -o '"connectedClients":[0-9]*' | cut -d':' -f2)
        echo "📱 Clientes ativos: ${ACTIVE_CLIENTS:-0}"
        echo "🔗 Clientes conectados: ${CONNECTED_CLIENTS:-0}"
    else
        echo "⚠️ Health check falhou"
    fi
    
    # Verificar logs de conexão dos últimos 30 segundos
    echo ""
    echo "🔍 Eventos de conexão recentes:"
    tail -50 logs/whatsapp-multi-client.log 2>/dev/null | \
    grep -E "(CONNECTION-CHECK|QR CODE|READY|connected|CONECTADO)" | \
    grep "$(date '+%Y-%m-%d')" | \
    tail -5 | \
    while read line; do
        echo "  $line"
    done
    
    # Verificar verificações ativas
    echo ""
    echo "🔍 Verificações ativas em andamento:"
    tail -20 logs/whatsapp-multi-client.log 2>/dev/null | \
    grep "CONNECTION-CHECK" | \
    tail -3 | \
    while read line; do
        echo "  $line"
    done
    
    sleep 10
done
