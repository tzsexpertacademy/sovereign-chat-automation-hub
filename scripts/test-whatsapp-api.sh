
#!/bin/bash

# Script para testar a API do WhatsApp Multi-Client
# Use: ./scripts/test-whatsapp-api.sh [IP_SERVIDOR] [CLIENT_ID]

# Configurações padrão
SERVER_IP=${1:-"146.59.227.248"}
SERVER_PORT="4000"
CLIENT_ID=${2:-"35f36a03-39b2-412c-bba6-01fdd45c2dd3"}
BASE_URL="http://${SERVER_IP}:${SERVER_PORT}"

echo "🔍 ===== TESTE COMPLETO DA API WHATSAPP ====="
echo "🌐 Servidor: ${BASE_URL}"
echo "📱 Cliente ID: ${CLIENT_ID}"
echo ""

# Função para fazer requisição e mostrar resultado
test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local data=$4
  
  echo "📡 Testando: ${description}"
  echo "🎯 ${method} ${BASE_URL}${endpoint}"
  
  if [ -z "$data" ]; then
    curl -X ${method} \
         -H "Content-Type: application/json" \
         -w "\n📊 Status: %{http_code} | Tempo: %{time_total}s\n" \
         -s "${BASE_URL}${endpoint}" | jq . 2>/dev/null || echo "Resposta não é JSON válido"
  else
    curl -X ${method} \
         -H "Content-Type: application/json" \
         -d "${data}" \
         -w "\n📊 Status: %{http_code} | Tempo: %{time_total}s\n" \
         -s "${BASE_URL}${endpoint}" | jq . 2>/dev/null || echo "Resposta não é JSON válido"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# 1. Teste de Health Check
test_endpoint "GET" "/health" "Health Check do Servidor"

# 2. Lista todos os clientes
test_endpoint "GET" "/api/clients" "Lista de Clientes"

# 3. Status específico do cliente
test_endpoint "GET" "/api/clients/${CLIENT_ID}/status" "Status do Cliente Específico"

# 4. Teste do endpoint send-audio (sem arquivo real)
echo "🎵 Testando endpoint send-audio..."
echo "🎯 POST ${BASE_URL}/api/clients/${CLIENT_ID}/send-audio"
echo "⚠️  Nota: Este teste verificará se o endpoint existe e quais parâmetros espera"

# Criar um teste com dados vazios para ver a resposta de erro
curl -X POST \
     -F "to=" \
     -F "file=@/dev/null" \
     -w "\n📊 Status: %{http_code} | Tempo: %{time_total}s\n" \
     -s "${BASE_URL}/api/clients/${CLIENT_ID}/send-audio" 2>/dev/null
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 5. Verificar outros endpoints disponíveis
echo "📋 Testando outros endpoints comuns..."

# Send message
test_endpoint "POST" "/api/clients/${CLIENT_ID}/send-message" "Send Message" '{"to":"teste","message":"teste"}'

# Get chats
test_endpoint "GET" "/api/clients/${CLIENT_ID}/chats" "Lista de Chats"

echo "✅ ===== TESTE COMPLETO FINALIZADO ====="
echo ""
echo "🔧 Comandos úteis adicionais:"
echo "   • Ver logs: tail -f logs/whatsapp-multi-client.log"
echo "   • Status detalhado: curl ${BASE_URL}/health | jq ."
echo "   • Monitorar requisições: netstat -tlnp | grep :${SERVER_PORT}"
echo "   • Processes: ps aux | grep whatsapp"
