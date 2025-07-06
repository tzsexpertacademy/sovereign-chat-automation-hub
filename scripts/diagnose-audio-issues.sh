
#!/bin/bash

# Script para diagnosticar problemas de áudio
# Arquivo: scripts/diagnose-audio-issues.sh

echo "🎵 DIAGNÓSTICO DE PROBLEMAS DE ÁUDIO"
echo "===================================="

# Verificar se servidor está rodando
echo "🔍 Verificando status do servidor..."
if curl -s --max-time 5 http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor está rodando"
    
    # Testar endpoint de áudio
    echo "🎵 Testando endpoint de áudio..."
    
    # Criar áudio de teste simples (base64 de um pequeno arquivo WAV)
    TEST_AUDIO_BASE64="UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+L"
    
    # Criar payload de teste
    TEST_PAYLOAD='{
        "to": "test@c.us",
        "audioData": "'$TEST_AUDIO_BASE64'",
        "fileName": "test_audio.wav",
        "mimeType": "audio/wav"
    }'
    
    echo "📤 Enviando requisição de teste..."
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" \
        http://localhost:4000/api/clients/test/send-audio)
    
    echo "📥 Resposta do servidor:"
    echo "$RESPONSE"
    
    # Verificar se resposta contém erro "Evaluation failed"
    if echo "$RESPONSE" | grep -q "Evaluation failed"; then
        echo "❌ PROBLEMA IDENTIFICADO: Evaluation failed"
        echo "🔧 Causa provável: Versão incompatível do whatsapp-web.js"
        echo "💡 Solução: Execute ./scripts/fix-dependencies.sh"
    elif echo "$RESPONSE" | grep -q "success"; then
        echo "✅ Endpoint de áudio funcionando"
    else
        echo "⚠️ Resposta inesperada do servidor"
    fi
    
else
    echo "❌ Servidor não está respondendo"
    echo "💡 Inicie o servidor: ./scripts/production-start-whatsapp.sh"
fi

# Verificar versão do whatsapp-web.js
echo ""
echo "📦 Verificando versão do whatsapp-web.js..."
cd server
if [ -f "package.json" ]; then
    WA_VERSION=$(node -e "console.log(require('./package.json').dependencies['whatsapp-web.js'])" 2>/dev/null)
    if [ -n "$WA_VERSION" ]; then
        echo "📌 Versão atual: $WA_VERSION"
        
        # Verificar se é versão problemática
        if echo "$WA_VERSION" | grep -q "1.23.0"; then
            echo "⚠️ VERSÃO PROBLEMÁTICA DETECTADA!"
            echo "🔧 Recomendação: Atualize para 1.25.0 ou superior"
            echo "💡 Execute: ./scripts/fix-dependencies.sh"
        else
            echo "✅ Versão parece adequada"
        fi
    else
        echo "❌ Não foi possível determinar a versão"
    fi
else
    echo "❌ package.json não encontrado no servidor"
fi

cd ..

# Verificar logs recentes
echo ""
echo "📝 Verificando logs recentes..."
if [ -f "logs/whatsapp-multi-client.log" ]; then
    echo "🔍 Últimas 10 linhas do log:"
    tail -10 logs/whatsapp-multi-client.log
    
    echo ""
    echo "🔍 Erros relacionados a áudio:"
    grep -i "audio\|evaluation\|failed" logs/whatsapp-multi-client.log | tail -5
else
    echo "⚠️ Arquivo de log não encontrado"
fi

echo ""
echo "🎯 RESUMO DO DIAGNÓSTICO"
echo "======================="
echo "1. Status do servidor: $(curl -s --max-time 5 http://localhost:4000/health > /dev/null && echo 'Online' || echo 'Offline')"
echo "2. Versão whatsapp-web.js: ${WA_VERSION:-'Desconhecida'}"
echo "3. Endpoint de áudio: Testado acima"
echo ""
echo "💡 PRÓXIMAS AÇÕES RECOMENDADAS:"
echo "• Se 'Evaluation failed': Execute ./scripts/fix-dependencies.sh"
echo "• Se servidor offline: Execute ./scripts/production-start-whatsapp.sh"
echo "• Para monitorar: tail -f logs/whatsapp-multi-client.log"
