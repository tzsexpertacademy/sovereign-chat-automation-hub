#!/bin/bash

# debug-api-routes.sh - Script para diagnosticar problema dos endpoints /api/

echo "🔍 DIAGNÓSTICO DOS ENDPOINTS /API/"
echo "========================================"

SERVER_URL="146.59.227.248"
CLIENT_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752173664034"

echo "🌐 Servidor: $SERVER_URL"
echo "📱 Client ID: $CLIENT_ID"
echo ""

echo "1️⃣ TESTANDO ENDPOINTS BÁSICOS"
echo "=============================="

echo "🔍 Health Check"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "https://$SERVER_URL/health"

echo "🔍 Lista de Clientes"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "https://$SERVER_URL/clients"

echo ""
echo "2️⃣ TESTANDO ENDPOINTS /API/ QUE DEVERIAM EXISTIR"
echo "================================================"

echo "🔍 GET /api/clients/$CLIENT_ID"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "https://$SERVER_URL/api/clients/$CLIENT_ID"

echo "🔍 POST /api/clients/$CLIENT_ID/send"
curl -s -o /dev/null -w "   Status: %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -d '{"to":"5511999999999@c.us","message":"teste"}' \
  "https://$SERVER_URL/api/clients/$CLIENT_ID/send"

echo "🔍 GET /api/clients/$CLIENT_ID/chats"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "https://$SERVER_URL/api/clients/$CLIENT_ID/chats"

echo "🔍 POST /api/clients/$CLIENT_ID/send-media"
curl -s -o /dev/null -w "   Status: %{http_code}\n" -X POST \
  "https://$SERVER_URL/api/clients/$CLIENT_ID/send-media"

echo ""
echo "3️⃣ TESTANDO ROTAS DE COMPATIBILIDADE"
echo "===================================="

echo "🔍 POST /clients/$CLIENT_ID/send-message"
curl -s -o /dev/null -w "   Status: %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -d '{"to":"5511999999999@c.us","message":"teste"}' \
  "https://$SERVER_URL/clients/$CLIENT_ID/send-message"

echo "🔍 GET /clients/$CLIENT_ID/chats"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "https://$SERVER_URL/clients/$CLIENT_ID/chats"

echo ""
echo "4️⃣ TESTANDO SERVIDOR DIRETAMENTE (SEM NGINX)"
echo "============================================="

echo "🔍 Health Check Direto"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "http://localhost:3001/health" 2>/dev/null || echo "   ❌ Não conseguiu conectar diretamente"

echo "🔍 API Direta"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "http://localhost:3001/api/clients/$CLIENT_ID" 2>/dev/null || echo "   ❌ Não conseguiu conectar diretamente"

echo ""
echo "✅ DIAGNÓSTICO CONCLUÍDO"
echo "========================"
echo ""
echo "📋 INTERPRETAÇÃO DOS RESULTADOS:"
echo "• Status 200: Endpoint funcionando"
echo "• Status 404: Endpoint não encontrado (problema!)"
echo "• Status 500: Endpoint existe mas com erro interno"
echo "• Status 400: Endpoint existe mas dados inválidos"
echo ""
echo "🎯 Se todos os /api/ retornaram 404, o problema é no registro das rotas!"