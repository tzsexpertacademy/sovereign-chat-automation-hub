
#!/bin/bash

# Script para testar especificamente o endpoint de áudio
# Use: ./scripts/test-audio-endpoint.sh [IP_SERVIDOR] [CLIENT_ID] [CHAT_ID]

SERVER_IP=${1:-"146.59.227.248"}
SERVER_PORT="4000"
CLIENT_ID=${2:-"35f36a03-39b2-412c-bba6-01fdd45c2dd3"}
CHAT_ID=${3:-"5547964518886@c.us"}
BASE_URL="http://${SERVER_IP}:${SERVER_PORT}"

echo "🎵 ===== TESTE ESPECÍFICO DO ENDPOINT DE ÁUDIO ====="
echo "🌐 Servidor: ${BASE_URL}"
echo "📱 Cliente ID: ${CLIENT_ID}"
echo "💬 Chat ID: ${CHAT_ID}"
echo ""

# Criar um arquivo de áudio de teste (pequeno arquivo MP3 vazio)
TEST_AUDIO_FILE="/tmp/test_audio.mp3"
echo "🔧 Criando arquivo de áudio de teste..."

# Criar um arquivo MP3 mínimo válido (cabeçalho MP3)
printf '\xFF\xFB\x90\x00' > ${TEST_AUDIO_FILE}
echo "Teste de áudio" >> ${TEST_AUDIO_FILE}

echo "📁 Arquivo criado: ${TEST_AUDIO_FILE} ($(wc -c < ${TEST_AUDIO_FILE}) bytes)"
echo ""

# Função para testar com diferentes parâmetros
test_audio_send() {
  local description=$1
  local extra_params=$2
  
  echo "🎤 Teste: ${description}"
  echo "🎯 POST ${BASE_URL}/api/clients/${CLIENT_ID}/send-audio"
  
  local cmd="curl -X POST"
  cmd="${cmd} -F 'to=${CHAT_ID}'"
  cmd="${cmd} -F 'file=@${TEST_AUDIO_FILE}'"
  
  if [ ! -z "$extra_params" ]; then
    cmd="${cmd} ${extra_params}"
  fi
  
  cmd="${cmd} -w '\n📊 Status: %{http_code} | Tempo: %{time_total}s | Tamanho: %{size_download} bytes\n'"
  cmd="${cmd} -v '${BASE_URL}/api/clients/${CLIENT_ID}/send-audio'"
  
  echo "💻 Comando: ${cmd}"
  echo ""
  
  eval $cmd 2>&1 | tee /tmp/audio_test_output.log
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# 1. Teste básico
test_audio_send "Envio Básico de Áudio"

# 2. Teste com caption
test_audio_send "Envio com Caption" "-F 'caption=Teste de áudio via script'"

# 3. Teste com tipo MIME específico
test_audio_send "Envio com Content-Type específico" "-H 'Content-Type: multipart/form-data'"

# Verificar resposta detalhada
echo "📋 Análise da última resposta:"
if [ -f /tmp/audio_test_output.log ]; then
  echo "🔍 Headers recebidos:"
  grep -i "< " /tmp/audio_test_output.log | head -10
  echo ""
  
  echo "🔍 Corpo da resposta:"
  tail -20 /tmp/audio_test_output.log | grep -v "^> \|^< \|^* "
fi

echo ""
echo "🧹 Limpando arquivos temporários..."
rm -f ${TEST_AUDIO_FILE} /tmp/audio_test_output.log

echo "✅ ===== TESTE DE ÁUDIO FINALIZADO ====="
echo ""
echo "📝 Próximos passos se o teste falhar:"
echo "   1. Verificar se o cliente WhatsApp está conectado"
echo "   2. Confirmar se o chat_id está correto"
echo "   3. Verificar logs do servidor: tail -f logs/whatsapp-multi-client.log"
echo "   4. Testar com um arquivo de áudio real"
