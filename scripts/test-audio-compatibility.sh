
#!/bin/bash

# Script para testar a compatibilidade do sistema de áudio
# Testa tanto a rota antiga quanto a nova

SERVER_IP=${1:-"localhost"}
SERVER_PORT="4000"
CLIENT_ID=${2:-"35f36a03-39b2-412c-bba6-01fdd45c2dd3"}
CHAT_ID=${3:-"5547964518886@c.us"}
BASE_URL="http://${SERVER_IP}:${SERVER_PORT}"

echo "🧪 ===== TESTE DE COMPATIBILIDADE DO SISTEMA DE ÁUDIO ====="
echo "🌐 Servidor: ${BASE_URL}"
echo "📱 Cliente ID: ${CLIENT_ID}"
echo "💬 Chat ID: ${CHAT_ID}"
echo ""

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local content_type=${5:-"application/json"}
    
    echo "🎯 Teste: ${description}"
    echo "📡 ${method} ${BASE_URL}${endpoint}"
    
    if [ -z "$data" ]; then
        curl -X ${method} \
             -H "Content-Type: ${content_type}" \
             -w "\n📊 Status: %{http_code} | Tempo: %{time_total}s\n" \
             -s "${BASE_URL}${endpoint}" 2>/dev/null
    else
        curl -X ${method} \
             -H "Content-Type: ${content_type}" \
             -d "${data}" \
             -w "\n📊 Status: %{http_code} | Tempo: %{time_total}s\n" \
             -s "${BASE_URL}${endpoint}" 2>/dev/null
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# 1. Teste health check
test_endpoint "GET" "/health" "Health Check Geral"

# 2. Teste CORS para rota nova (/api/*)
echo "🔍 Testando CORS para rotas /api/*..."
echo "🎯 OPTIONS ${BASE_URL}/api/clients/${CLIENT_ID}/send-audio"
curl -X OPTIONS \
     -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -v "${BASE_URL}/api/clients/${CLIENT_ID}/send-audio" 2>&1 | grep -i "access-control"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 3. Teste da nova rota /api/clients/*/send-audio (JSON)
echo "🎵 Testando nova rota de áudio (JSON + base64)..."
# Criar um base64 de áudio mínimo para teste
TEST_AUDIO_BASE64="UklGRmADAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YSYDAAAAAAECAwQFBgcICQoLDA=="

JSON_DATA=$(cat << EOF
{
  "to": "${CHAT_ID}",
  "audioData": "${TEST_AUDIO_BASE64}",
  "fileName": "test_audio.wav",
  "mimeType": "audio/wav"
}
EOF
)

test_endpoint "POST" "/api/clients/${CLIENT_ID}/send-audio" "Nova Rota Áudio (JSON)" "$JSON_DATA"

# 4. Teste da rota de estatísticas
test_endpoint "GET" "/api/clients/${CLIENT_ID}/audio-stats" "Estatísticas de Áudio"

# 5. Teste da rota antiga (para garantir compatibilidade)
echo "🔄 Testando rota antiga (multipart) - deve continuar funcionando..."
test_endpoint "POST" "/clients/${CLIENT_ID}/send-audio" "Rota Antiga (Multipart)" "" "multipart/form-data"

echo ""
echo "🎉 ===== TESTE DE COMPATIBILIDADE FINALIZADO ====="
echo ""
echo "📋 INTERPRETAÇÃO DOS RESULTADOS:"
echo "• Status 200: ✅ Endpoint funcionando"
echo "• Status 400: ⚠️  Parâmetros incorretos (normal para teste)"
echo "• Status 404: ❌ Endpoint não encontrado"
echo "• Status 500: ❌ Erro interno do servidor"
echo ""
echo "🔍 PRÓXIMOS PASSOS:"
echo "1. Se Status 200/400: Sistema funcionando ✅"
echo "2. Se Status 404: Verificar se servidor foi reiniciado"
echo "3. Se Status 500: Verificar logs do servidor"
echo ""
echo "📊 LOGS DO SERVIDOR: tail -f logs/whatsapp-multi-client.log"
