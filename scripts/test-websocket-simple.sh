
#!/bin/bash

# Script simples para testar WebSocket
# Arquivo: scripts/test-websocket-simple.sh

echo "🔍 TESTE SIMPLES DO WEBSOCKET"
echo "============================="

DOMAIN="146.59.227.248"

echo "Testando WebSocket..."
echo "URL: https://$DOMAIN/socket.io/"

# Testar com curl
WS_RESPONSE=$(curl -k -s -I "https://$DOMAIN/socket.io/" 2>&1)
WS_STATUS=$(echo "$WS_RESPONSE" | head -1 | awk '{print $2}')

echo "Status HTTP: $WS_STATUS"
echo ""
echo "Resposta completa:"
echo "$WS_RESPONSE"
echo ""

if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "101" ]; then
    echo "✅ WebSocket funcionando!"
elif [ "$WS_STATUS" = "400" ]; then
    echo "❌ WebSocket retornando 400 - problema na configuração Nginx"
    echo "Execute: sudo ./scripts/fix-websocket-nginx-final.sh"
elif [ "$WS_STATUS" = "404" ]; then
    echo "❌ WebSocket não encontrado - problema de roteamento"
else
    echo "❌ WebSocket com problema: $WS_STATUS"
fi

echo ""
echo "🔧 Para corrigir:"
echo "sudo ./scripts/fix-websocket-nginx-final.sh"
