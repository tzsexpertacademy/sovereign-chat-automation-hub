
#!/bin/bash

echo "📊 MONITOR DE SESSÕES PUPPETEER"
echo "==============================="

while true; do
    echo ""
    echo "⏰ $(date '+%H:%M:%S') - Status das Sessões:"
    echo "============================================"
    
    # Verificar processos Chrome
    CHROME_COUNT=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)
    echo "🖥️ Processos Chrome ativos: $CHROME_COUNT"
    
    # Verificar servidor WhatsApp
    SERVER_PID=$(pgrep -f "whatsapp-multi-client-server.js")
    if [ ! -z "$SERVER_PID" ]; then
        echo "✅ Servidor WhatsApp rodando (PID: $SERVER_PID)"
    else
        echo "❌ Servidor WhatsApp não encontrado"
    fi
    
    # Health check
    HEALTH=$(curl -k -s "https://146.59.227.248/health" 2>/dev/null | grep -o '"activeClients":[0-9]*' | cut -d':' -f2)
    if [ ! -z "$HEALTH" ]; then
        echo "📱 Clientes ativos no servidor: $HEALTH"
    else
        echo "⚠️ Não foi possível verificar health"
    fi
    
    # Verificar logs recentes de sessões
    echo ""
    echo "🔍 Últimos eventos de sessão:"
    tail -10 logs/whatsapp-multi-client.log 2>/dev/null | grep -E "(SESSION-RECOVERY|CONECTADO|QR CODE|connected)" | tail -3
    
    sleep 30
done
