
#!/bin/bash

# Script para testar conexão Socket.IO isoladamente
# Arquivo: scripts/test-socketio-connection.sh

echo "🧪 TESTE ISOLADO DO SOCKET.IO"
echo "============================="

DOMAIN="146.59.227.248"

echo "🔍 Testando handshake Socket.IO..."

# Teste 1: Handshake inicial (polling)
echo "1. Testando polling handshake:"
echo "   curl \"http://localhost:4000/socket.io/?EIO=4&transport=polling\""

RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "http://localhost:4000/socket.io/?EIO=4&transport=polling" 2>/dev/null)
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo "   Status: $HTTP_STATUS"
echo "   Resposta: $BODY"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Polling handshake funcionando!"
else
    echo "   ❌ Polling handshake falhando!"
fi

echo ""

# Teste 2: Via HTTPS
echo "2. Testando via HTTPS:"
echo "   curl \"https://$DOMAIN/socket.io/?EIO=4&transport=polling\""

HTTPS_RESPONSE=$(curl -k -s -w "HTTPSTATUS:%{http_code}" "https://$DOMAIN/socket.io/?EIO=4&transport=polling" 2>/dev/null)
HTTPS_STATUS=$(echo $HTTPS_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
HTTPS_BODY=$(echo $HTTPS_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo "   Status: $HTTPS_STATUS"
echo "   Resposta: $HTTPS_BODY"

if [ "$HTTPS_STATUS" = "200" ]; then
    echo "   ✅ HTTPS Socket.IO funcionando!"
else
    echo "   ❌ HTTPS Socket.IO falhando!"
fi

echo ""

# Teste 3: Health check com info Socket.IO
echo "3. Verificando info Socket.IO no health:"
HEALTH_RESPONSE=$(curl -s "http://localhost:4000/health" | grep -A 10 '"socketio"' 2>/dev/null)

if [ -n "$HEALTH_RESPONSE" ]; then
    echo "   ✅ Info Socket.IO encontrada:"
    echo "$HEALTH_RESPONSE"
else
    echo "   ⚠️ Info Socket.IO não encontrada no health"
fi

echo ""
echo "🎯 RESULTADO FINAL:"
echo "=================="

if [ "$HTTP_STATUS" = "200" ] && [ "$HTTPS_STATUS" = "200" ]; then
    echo "🎉 SOCKET.IO FUNCIONANDO PERFEITAMENTE!"
    echo ""
    echo "✅ Handshake local: OK"
    echo "✅ Handshake HTTPS: OK"
    echo ""
    echo "🎮 PRÓXIMOS PASSOS:"
    echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    echo "2. Clique em 'Diagnóstico QR Code'"
    echo "3. Clique em 'Gerar QR'"
    echo "4. O QR Code deve aparecer automaticamente!"
    
elif [ "$HTTP_STATUS" = "200" ]; then
    echo "⚠️ Socket.IO funcionando localmente, mas problema no HTTPS"
    echo "🔧 Verificar configuração Nginx"
    
elif [ "$HTTPS_STATUS" = "200" ]; then
    echo "⚠️ Socket.IO funcionando via HTTPS, mas problema local"
    echo "🔧 Problema incomum - verificar configuração local"
    
else
    echo "❌ Socket.IO não funcionando"
    echo "🔧 Executar correção: sudo ./scripts/fix-socketio-server.sh"
fi
