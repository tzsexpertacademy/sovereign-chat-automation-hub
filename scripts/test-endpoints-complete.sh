#!/bin/bash

echo "🧪 TESTE COMPLETO DOS ENDPOINTS CORRIGIDOS"
echo "==========================================="

# Configurações
DOMAIN="146.59.227.248"
CLIENT_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752173664034"

echo "🌐 Testando servidor: $DOMAIN"
echo "📱 Client ID de teste: $CLIENT_ID"
echo ""

# Função para testar endpoint
test_endpoint() {
  local method=$1
  local url=$2
  local description=$3
  local data=$4
  
  echo "🔍 $description"
  echo "   $method https://$DOMAIN$url"
  
  if [ -z "$data" ]; then
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X $method https://$DOMAIN$url)
  else
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X $method \
                     -H "Content-Type: application/json" \
                     -d "$data" \
                     https://$DOMAIN$url)
  fi
  
  case $HTTP_CODE in
    200|201) echo "   ✅ Status: $HTTP_CODE" ;;
    404) echo "   ⚠️  Status: $HTTP_CODE (endpoint não encontrado)" ;;
    400) echo "   ⚠️  Status: $HTTP_CODE (dados inválidos - esperado para teste)" ;;
    500) echo "   ❌ Status: $HTTP_CODE (erro do servidor)" ;;
    *) echo "   ❓ Status: $HTTP_CODE" ;;
  esac
  echo ""
}

echo "1️⃣ ENDPOINTS BÁSICOS"
echo "===================="
test_endpoint "GET" "/health" "Health Check"
test_endpoint "GET" "/clients" "Lista de Clientes"

echo "2️⃣ ENDPOINTS DE INSTÂNCIAS"
echo "=========================="
test_endpoint "GET" "/clients/$CLIENT_ID/status" "Status da Instância"
test_endpoint "POST" "/clients/$CLIENT_ID/connect" "Conectar Instância"
test_endpoint "POST" "/clients/$CLIENT_ID/disconnect" "Desconectar Instância"

echo "3️⃣ ENDPOINTS DE MENSAGENS (COMPATIBILIDADE)"
echo "==========================================="
test_endpoint "POST" "/clients/$CLIENT_ID/send-message" "Enviar Mensagem (Compat)" '{"to":"teste","message":"teste"}'
test_endpoint "GET" "/clients/$CLIENT_ID/chats" "Listar Chats (Compat)"

echo "4️⃣ ENDPOINTS DA API (NOVOS)"
echo "=========================="
test_endpoint "GET" "/api/clients/$CLIENT_ID" "Status API"
test_endpoint "POST" "/api/clients/$CLIENT_ID/send" "Enviar Mensagem API" '{"to":"teste","message":"teste"}'
test_endpoint "GET" "/api/clients/$CLIENT_ID/chats" "Listar Chats API"
test_endpoint "POST" "/api/clients/$CLIENT_ID/logout" "Logout API"

echo "5️⃣ ENDPOINTS DE MÍDIA"
echo "===================="
test_endpoint "POST" "/api/clients/$CLIENT_ID/send-media" "Enviar Mídia (sem arquivo)"

echo "✅ TESTE COMPLETO FINALIZADO"
echo "============================"
echo ""
echo "📋 RESUMO:"
echo "• Endpoints básicos: /health, /clients"
echo "• Endpoints de compatibilidade: /clients/{id}/send-message, /clients/{id}/chats"
echo "• Endpoints da API: /api/clients/{id}/send, /api/clients/{id}/chats"
echo "• Endpoints de mídia: /api/clients/{id}/send-media"
echo ""
echo "🎯 Se todos os endpoints retornaram status 200, 400 ou 404 (mas não 500),"
echo "   então a correção foi bem-sucedida!"
echo ""
echo "📖 Para testar no frontend:"
echo "   1. Tente enviar uma mensagem"
echo "   2. Verifique se não há mais erro 404"
echo "   3. Teste envio de áudio/mídia"