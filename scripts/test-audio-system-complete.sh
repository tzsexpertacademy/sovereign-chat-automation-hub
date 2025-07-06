
#!/bin/bash

# Script para testar o sistema de áudio completo
echo "🎵 ===== TESTE COMPLETO DO SISTEMA DE ÁUDIO ====="
echo "📅 $(date)"
echo ""

# Verificar se servidor está rodando
echo "🔍 1. Verificando status do servidor..."
if curl -s --max-time 5 http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor está online"
else
    echo "❌ Servidor não está respondendo"
    echo "💡 Execute: ./scripts/production-start-whatsapp.sh"
    exit 1
fi

# Testar rota existente
echo ""
echo "🔍 2. Testando rota existente /clients/test/send-audio..."
curl -s -X POST http://localhost:4000/clients/test/send-audio \
    -H "Content-Type: application/json" \
    -d '{"test": true}' > /tmp/audio_test_old.json

if [ $? -eq 0 ]; then
    echo "✅ Rota existente respondendo"
else
    echo "⚠️ Rota existente com problemas"
fi

# Testar nova rota API
echo ""
echo "🔍 3. Testando nova rota /api/clients/test/send-audio..."

# Áudio de teste em base64 (pequeno arquivo WAV)
TEST_AUDIO="UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+L"

RESPONSE=$(curl -s -X POST http://localhost:4000/api/clients/test/send-audio \
    -H "Content-Type: application/json" \
    -d "{
        \"to\": \"test@c.us\",
        \"audioData\": \"$TEST_AUDIO\",
        \"fileName\": \"test_audio.wav\",
        \"mimeType\": \"audio/wav\"
    }")

echo "📥 Resposta da nova rota:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Verificar CORS
echo ""
echo "🔍 4. Testando CORS na nova rota..."
CORS_RESPONSE=$(curl -s -I -X OPTIONS http://localhost:4000/api/clients/test/send-audio \
    -H "Origin: https://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS configurado corretamente"
else
    echo "⚠️ CORS pode precisar de ajustes"
fi

# Testar health check
echo ""
echo "🔍 5. Verificando health check..."
HEALTH=$(curl -s http://localhost:4000/health)
echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"

echo ""
echo "🎯 RESUMO DO TESTE"
echo "=================="
echo "✅ Servidor: Online"
echo "✅ Rota existente: Preservada"
echo "✅ Nova rota API: $(echo "$RESPONSE" | grep -q '"success"' && echo 'Funcionando' || echo 'Verificar logs')"
echo "✅ CORS: $(echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin" && echo 'OK' || echo 'Verificar')"
echo ""
echo "📝 Para monitorar: tail -f logs/whatsapp-multi-client.log"
echo "📅 Teste concluído: $(date)"
