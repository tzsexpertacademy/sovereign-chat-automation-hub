
#!/bin/bash

# Script de diagnóstico DETALHADO do Socket.IO
# Arquivo: scripts/diagnose-socketio-detailed.sh

echo "🔍 DIAGNÓSTICO DETALHADO DO SOCKET.IO"
echo "====================================="

DOMAIN="146.59.227.248"

echo "📋 1. TESTANDO SOCKET.IO HANDSHAKE"
echo "=================================="

# Testar handshake inicial do Socket.IO (polling)
echo "🔍 Testando handshake Socket.IO (polling):"
echo "URL: http://localhost:4000/socket.io/?EIO=4&transport=polling"

POLLING_RESPONSE=$(curl -s "http://localhost:4000/socket.io/?EIO=4&transport=polling" 2>&1)
POLLING_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:4000/socket.io/?EIO=4&transport=polling" 2>/dev/null)

echo "Status Polling: $POLLING_STATUS"
echo "Resposta: $POLLING_RESPONSE"
echo ""

# Testar via HTTPS/Nginx
echo "🔍 Testando via HTTPS (Nginx):"
echo "URL: https://$DOMAIN/socket.io/?EIO=4&transport=polling"

HTTPS_POLLING_STATUS=$(curl -k -s -w "%{http_code}" -o /dev/null "https://$DOMAIN/socket.io/?EIO=4&transport=polling" 2>/dev/null)
HTTPS_POLLING_RESPONSE=$(curl -k -s "https://$DOMAIN/socket.io/?EIO=4&transport=polling" 2>&1)

echo "Status HTTPS Polling: $HTTPS_POLLING_STATUS"
echo "Resposta: $HTTPS_POLLING_RESPONSE"
echo ""

echo "📋 2. VERIFICANDO VERSÕES E CONFIGURAÇÃO"
echo "========================================"

# Verificar versão Socket.IO instalada
echo "🔍 Versão Socket.IO no servidor:"
if [ -f "server/package.json" ]; then
    grep "socket.io" server/package.json || echo "Socket.IO não encontrado no package.json"
else
    echo "❌ package.json não encontrado"
fi
echo ""

# Verificar se Socket.IO está sendo inicializado
echo "🔍 Verificando inicialização Socket.IO no código:"
if [ -f "server/whatsapp-multi-client-server.js" ]; then
    grep -n "socket.io\|io(" server/whatsapp-multi-client-server.js | head -5
else
    echo "❌ Servidor não encontrado"
fi
echo ""

echo "📋 3. TESTANDO CONECTIVIDADE DIRETA"
echo "=================================="

# Testar rota base do Socket.IO
echo "🔍 Testando rota base Socket.IO:"
curl -s -I "http://localhost:4000/socket.io/" | head -3
echo ""

# Testar diferentes transports
echo "🔍 Testando WebSocket transport:"
WEBSOCKET_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:4000/socket.io/?EIO=4&transport=websocket" 2>/dev/null)
echo "WebSocket Status: $WEBSOCKET_STATUS"
echo ""

echo "📋 4. DIAGNÓSTICO DE LOGS EM TEMPO REAL"
echo "======================================="

echo "🔍 Fazendo requisição e capturando logs simultâneos..."

# Fazer requisição Socket.IO e capturar resposta detalhada
echo "Requisição de teste:"
curl -v "http://localhost:4000/socket.io/?EIO=4&transport=polling" 2>&1 | head -20
echo ""

echo "📋 5. RESUMO DO DIAGNÓSTICO"
echo "=========================="

echo "Polling Local: $POLLING_STATUS"
echo "Polling HTTPS: $HTTPS_POLLING_STATUS"
echo "WebSocket: $WEBSOCKET_STATUS"

if [ "$POLLING_STATUS" = "200" ]; then
    echo "✅ Socket.IO Polling funcionando localmente"
elif [ "$POLLING_STATUS" = "400" ]; then
    echo "❌ PROBLEMA: Socket.IO retornando 400 - Handshake falhando"
    echo "🔧 CAUSA PROVÁVEL: Configuração incorreta do Socket.IO no servidor"
else
    echo "❌ PROBLEMA: Status inesperado: $POLLING_STATUS"
fi

if [ "$HTTPS_POLLING_STATUS" = "200" ]; then
    echo "✅ Socket.IO funcionando via HTTPS"
elif [ "$HTTPS_POLLING_STATUS" = "400" ]; then
    echo "❌ PROBLEMA: Socket.IO via HTTPS também falhando"
else
    echo "⚠️ HTTPS Status: $HTTPS_POLLING_STATUS"
fi

echo ""
echo "🔧 PRÓXIMOS PASSOS:"
if [ "$POLLING_STATUS" = "400" ]; then
    echo "1. CRÍTICO: Corrigir configuração Socket.IO no servidor Node.js"
    echo "2. Verificar se Socket.IO está sendo inicializado corretamente"
    echo "3. Confirmar compatibilidade de versões"
    echo "4. Testar handshake após correção"
else
    echo "1. Socket.IO local OK - problema pode ser no Nginx"
    echo "2. Verificar configuração de proxy WebSocket no Nginx"
fi
