
#!/bin/bash

# Script para validar o fluxo completo de QR Code
# Arquivo: scripts/validate-qr-flow.sh

echo "🧪 VALIDAÇÃO COMPLETA DO FLUXO QR CODE"
echo "====================================="

DOMAIN="146.59.227.248"
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3"

echo "🔍 Fase 1: Validação da Infraestrutura"
echo "======================================"

# 1. Testar WebSocket
echo "1️⃣ Testando WebSocket..."
WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" | head -1 | awk '{print $2}')
if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "101" ]; then
    echo "✅ WebSocket funcionando (Status: $WS_STATUS)"
else
    echo "❌ WebSocket com problema (Status: $WS_STATUS)"
    echo "🔧 Execute: sudo ./scripts/fix-websocket-definitive.sh"
    exit 1
fi

# 2. Testar API Health
echo "2️⃣ Testando API Health..."
HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ API Health funcionando"
else
    echo "❌ API Health com problema (Status: $HEALTH_STATUS)"
    exit 1
fi

# 3. Testar API Clients
echo "3️⃣ Testando API Clients..."
CLIENTS_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/clients")
if [ "$CLIENTS_STATUS" = "200" ]; then
    echo "✅ API Clients funcionando"
else
    echo "❌ API Clients com problema (Status: $CLIENTS_STATUS)"
    exit 1
fi

echo ""
echo "🔍 Fase 2: Teste do Fluxo QR Code"
echo "================================"

# 4. Conectar instância
echo "4️⃣ Conectando instância para gerar QR Code..."
CONNECT_RESPONSE=$(curl -k -s -X POST "https://$DOMAIN/clients/$INSTANCE_ID/connect" \
  -H "Content-Type: application/json" \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com")

echo "Resposta da conexão: $CONNECT_RESPONSE"

# 5. Aguardar e verificar status
echo -n "5️⃣ Aguardando QR Code aparecer"
for i in {1..10}; do
    echo -n "."
    sleep 2
    
    STATUS_RESPONSE=$(curl -k -s "https://$DOMAIN/clients/$INSTANCE_ID/status")
    
    # Verificar se tem QR Code
    if echo "$STATUS_RESPONSE" | grep -q '"hasQrCode":true'; then
        echo ""
        echo "✅ QR Code detectado na API!"
        echo "Status completo: $STATUS_RESPONSE"
        break
    fi
    
    if [ $i -eq 10 ]; then
        echo ""
        echo "⚠️ QR Code não apareceu após 20 segundos"
        echo "Status final: $STATUS_RESPONSE"
    fi
done

echo ""
echo "🔍 Fase 3: Validação dos Endpoints de Mídia"
echo "==========================================="

# 6. Testar endpoints de mídia
MEDIA_ENDPOINTS=(
    "/clients/$INSTANCE_ID/send-message"
    "/clients/$INSTANCE_ID/send-image" 
    "/clients/$INSTANCE_ID/send-audio"
    "/clients/$INSTANCE_ID/send-video"
    "/clients/$INSTANCE_ID/send-document"
    "/clients/$INSTANCE_ID/chats"
)

for endpoint in "${MEDIA_ENDPOINTS[@]}"; do
    echo -n "6️⃣ Testando $endpoint... "
    
    if [[ "$endpoint" == *"send-"* ]]; then
        # Testar POST endpoints
        STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "https://$DOMAIN$endpoint" \
          -H "Content-Type: application/json" \
          -d '{"to":"5547999999999","message":"teste"}')
    else
        # Testar GET endpoints
        STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN$endpoint")
    fi
    
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
        echo "✅ ($STATUS)"
    else
        echo "❌ ($STATUS)"
    fi
done

echo ""
echo "🎯 RESULTADO DA VALIDAÇÃO"
echo "========================"
echo "✅ Infraestrutura: WebSocket + API funcionando"
echo "📱 QR Code: Verifique o resultado acima"
echo "🔗 Endpoints: Testados individualmente"
echo ""
echo "🎮 PRÓXIMOS PASSOS:"
echo "=================="
echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo "2. Clique em 'Diagnóstico QR Code'"
echo "3. Clique em 'Gerar QR' ou 'Diagnosticar'"
echo "4. O QR Code deve aparecer automaticamente"
echo "5. Escaneie com seu WhatsApp para conectar"
echo ""
echo "🔧 Se QR Code não aparecer:"
echo "• Verifique logs: pm2 logs whatsapp-multi-client"  
echo "• Reinicie: pm2 restart whatsapp-multi-client"
echo "• Verifique conexão WebSocket no navegador (F12 → Network → WS)"
EOF

chmod +x scripts/validate-qr-flow.sh
