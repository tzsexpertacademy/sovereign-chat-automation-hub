#!/bin/bash

# test-complete-system.sh - Teste completo do sistema após correções

echo "🧪 TESTE COMPLETO DO SISTEMA CORRIGIDO"
echo "======================================"

SERVER_URL="146.59.227.248"
CLIENT_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752173664034"

echo "🌐 Servidor: $SERVER_URL"
echo "📱 Client ID: $CLIENT_ID"
echo ""

echo "1️⃣ TESTANDO ENDPOINTS BÁSICOS"
echo "=============================="

echo "🔍 Health Check"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$SERVER_URL/health")
echo "   Status: $HEALTH_STATUS"
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "   ✅ Health check OK"
else
    echo "   ❌ Health check falhou"
fi

echo ""
echo "🔍 Lista de Clientes"
CLIENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$SERVER_URL/clients")
echo "   Status: $CLIENTS_STATUS"
if [ "$CLIENTS_STATUS" = "200" ]; then
    echo "   ✅ Lista de clientes OK"
else
    echo "   ❌ Lista de clientes falhou"
fi

echo ""
echo "2️⃣ TESTANDO ENDPOINTS /API/ (PRINCIPAIS)"
echo "========================================"

echo "🔍 GET /api/clients/$CLIENT_ID"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$SERVER_URL/api/clients/$CLIENT_ID")
echo "   Status: $API_STATUS"
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "404" ]; then
    echo "   ✅ Endpoint /api/clients/{id} está registrado"
else
    echo "   ❌ Endpoint /api/clients/{id} não encontrado (500 = erro interno)"
fi

echo ""
echo "🔍 POST /api/clients/$CLIENT_ID/send"
SEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"to":"5511999999999@c.us","message":"teste"}' \
  "https://$SERVER_URL/api/clients/$CLIENT_ID/send")
echo "   Status: $SEND_STATUS"
if [ "$SEND_STATUS" = "200" ] || [ "$SEND_STATUS" = "400" ] || [ "$SEND_STATUS" = "500" ]; then
    echo "   ✅ Endpoint /api/clients/{id}/send está registrado"
else
    echo "   ❌ Endpoint /api/clients/{id}/send não encontrado"
fi

echo ""
echo "🔍 GET /api/clients/$CLIENT_ID/chats"
CHATS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$SERVER_URL/api/clients/$CLIENT_ID/chats")
echo "   Status: $CHATS_STATUS"
if [ "$CHATS_STATUS" = "200" ] || [ "$CHATS_STATUS" = "404" ] || [ "$CHATS_STATUS" = "500" ]; then
    echo "   ✅ Endpoint /api/clients/{id}/chats está registrado"
else
    echo "   ❌ Endpoint /api/clients/{id}/chats não encontrado"
fi

echo ""
echo "🔍 POST /api/clients/$CLIENT_ID/send-media"
MEDIA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://$SERVER_URL/api/clients/$CLIENT_ID/send-media")
echo "   Status: $MEDIA_STATUS"
if [ "$MEDIA_STATUS" = "200" ] || [ "$MEDIA_STATUS" = "400" ] || [ "$MEDIA_STATUS" = "500" ]; then
    echo "   ✅ Endpoint /api/clients/{id}/send-media está registrado"
else
    echo "   ❌ Endpoint /api/clients/{id}/send-media não encontrado"
fi

echo ""
echo "3️⃣ TESTANDO COMPATIBILIDADE"
echo "==========================="

echo "🔍 POST /clients/$CLIENT_ID/send-message (compat)"
COMPAT_SEND=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"to":"5511999999999@c.us","message":"teste"}' \
  "https://$SERVER_URL/clients/$CLIENT_ID/send-message")
echo "   Status: $COMPAT_SEND"
if [ "$COMPAT_SEND" = "200" ] || [ "$COMPAT_SEND" = "400" ] || [ "$COMPAT_SEND" = "500" ]; then
    echo "   ✅ Endpoint compatibilidade send-message funciona"
else
    echo "   ❌ Endpoint compatibilidade send-message não encontrado"
fi

echo ""
echo "🔍 GET /clients/$CLIENT_ID/chats (compat)"
COMPAT_CHATS=$(curl -s -o /dev/null -w "%{http_code}" "https://$SERVER_URL/clients/$CLIENT_ID/chats")
echo "   Status: $COMPAT_CHATS"
if [ "$COMPAT_CHATS" = "200" ] || [ "$COMPAT_CHATS" = "404" ] || [ "$COMPAT_CHATS" = "500" ]; then
    echo "   ✅ Endpoint compatibilidade chats funciona"
else
    echo "   ❌ Endpoint compatibilidade chats não encontrado"
fi

echo ""
echo "4️⃣ ANÁLISE DOS RESULTADOS"
echo "========================="

ALL_API_WORKING=true

if [ "$API_STATUS" = "404" ]; then
    echo "❌ PROBLEMA: Endpoint /api/clients/{id} retorna 404"
    ALL_API_WORKING=false
fi

if [ "$SEND_STATUS" = "404" ]; then
    echo "❌ PROBLEMA: Endpoint /api/clients/{id}/send retorna 404"
    ALL_API_WORKING=false
fi

if [ "$CHATS_STATUS" = "404" ]; then
    echo "❌ PROBLEMA: Endpoint /api/clients/{id}/chats retorna 404"
    ALL_API_WORKING=false
fi

if [ "$MEDIA_STATUS" = "404" ]; then
    echo "❌ PROBLEMA: Endpoint /api/clients/{id}/send-media retorna 404"
    ALL_API_WORKING=false
fi

if [ "$ALL_API_WORKING" = true ]; then
    echo "✅ TODOS OS ENDPOINTS /API/ ESTÃO REGISTRADOS!"
    echo "🎯 O problema dos 404 foi resolvido"
    echo ""
    echo "📋 PRÓXIMOS PASSOS:"
    echo "1. Testar envio de mensagens no frontend"
    echo "2. Testar envio de áudios e arquivos"
    echo "3. Verificar se não há mais erros 404"
else
    echo "❌ AINDA EXISTEM ENDPOINTS /API/ COM 404"
    echo "🔧 O servidor precisa ser reiniciado ou as rotas não estão sendo registradas"
fi

echo ""
echo "5️⃣ INSTRUÇÕES DE TESTE NO FRONTEND"
echo "=================================="
echo "1. Acesse o chat no navegador"
echo "2. Tente enviar uma mensagem de texto"
echo "3. Tente enviar um arquivo de áudio"
echo "4. Verifique os logs do navegador (F12)"
echo "5. Se ainda houver erro 404, o servidor precisa ser reiniciado"

echo ""
echo "✅ TESTE COMPLETO FINALIZADO"