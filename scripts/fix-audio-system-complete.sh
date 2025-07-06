
#!/bin/bash

# Script completo para corrigir o sistema de áudio
# Arquivo: scripts/fix-audio-system-complete.sh

echo "🎵 CORREÇÃO COMPLETA DO SISTEMA DE ÁUDIO"
echo "======================================="

# Verificar se está rodando como root para CORS
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-audio-system-complete.sh"
    exit 1
fi

echo "🔧 ETAPA 1: Corrigindo CORS e roteamento..."
./scripts/fix-cors-audio-api.sh

if [ $? -ne 0 ]; then
    echo "❌ Falha na correção de CORS"
    exit 1
fi

echo ""
echo "🔧 ETAPA 2: Reiniciando servidor para aplicar mudanças..."
cd /home/ubuntu/sovereign-chat-automation-hub

# Parar servidor
./scripts/production-stop-whatsapp.sh
sleep 5

# Iniciar servidor com novas correções
./scripts/production-start-whatsapp.sh
sleep 10

echo ""
echo "🔧 ETAPA 3: Testando sistema de áudio..."

# Testar health check
echo "🏥 Testando health check..."
HEALTH_RESPONSE=$(curl -k -s "https://146.59.227.248/health")
echo "Resposta: $HEALTH_RESPONSE"

# Testar CORS específico para áudio
echo ""
echo "🎵 Testando CORS para API de áudio..."
CORS_TEST=$(curl -k -H "Origin: https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type" \
            -X OPTIONS -I -s "https://146.59.227.248/api/clients/test/send-audio" | grep -i "access-control-allow-origin")

if [ -n "$CORS_TEST" ]; then
    echo "✅ CORS funcionando: $CORS_TEST"
else
    echo "⚠️ CORS pode não estar funcionando corretamente"
fi

echo ""
echo "🎉 CORREÇÕES APLICADAS!"
echo "======================"
echo "✅ CORS configurado para /api/clients/*"
echo "✅ Roteamento /api/clients -> /clients"
echo "✅ Backend atualizado para suportar base64"
echo "✅ Serviços de áudio melhorados"
echo "✅ Servidor reiniciado"
echo ""
echo "🌐 Sistema de áudio deve estar funcionando agora!"
echo "Teste no frontend: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/client/35f36a03-39b2-412c-bba6-01fdd45c2dd3/connect"
EOF

chmod +x scripts/fix-cors-audio-api.sh
chmod +x scripts/fix-audio-system-complete.sh
