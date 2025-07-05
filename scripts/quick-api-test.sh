#!/bin/bash

echo "🔍 TESTE RÁPIDO DA API COM DIAGNÓSTICO APRIMORADO"
echo "================================================="

INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751734727003"
API_BASE="https://146.59.227.248"

echo "🎯 Instance ID: $INSTANCE_ID"
echo "🌐 API Base: $API_BASE"
echo ""

echo "1️⃣ Health Check do Servidor:"
echo "============================="
SERVER_STATUS=$(curl -k -s "$API_BASE/health" | jq -r '.status // "offline"')
ACTIVE_CLIENTS=$(curl -k -s "$API_BASE/health" | jq -r '.activeClients // 0')
CONNECTED_CLIENTS=$(curl -k -s "$API_BASE/health" | jq -r '.connectedClients // 0')

echo "Status do Servidor: $SERVER_STATUS"
echo "Clientes Ativos: $ACTIVE_CLIENTS"
echo "Clientes Conectados: $CONNECTED_CLIENTS"
echo ""

echo "2️⃣ Status Detalhado com Diagnóstico:"
echo "===================================="
STATUS_RESPONSE=$(curl -k -s "$API_BASE/clients/$INSTANCE_ID/status")
echo "$STATUS_RESPONSE" | jq '.'
echo ""

echo "3️⃣ Extração de Informações Chave:"
echo "=================================="
CLIENT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
HAS_QR=$(echo "$STATUS_RESPONSE" | jq -r '.hasQrCode // false')
PHONE_NUMBER=$(echo "$STATUS_RESPONSE" | jq -r '.phoneNumber // "null"')
CLIENT_EXISTS=$(echo "$STATUS_RESPONSE" | jq -r '.diagnostic.exists // false')
SESSION_HEALTHY=$(echo "$STATUS_RESPONSE" | jq -r '.diagnostic.hasMainFrame // false')

echo "✅ Status do Cliente: $CLIENT_STATUS"
echo "📱 Tem QR Code: $HAS_QR"
echo "📞 Número de Telefone: $PHONE_NUMBER"
echo "🔍 Cliente Existe: $CLIENT_EXISTS"
echo "💚 Sessão Saudável: $SESSION_HEALTHY"
echo ""

echo "4️⃣ Logs Recentes do Servidor:"
echo "=============================="
tail -20 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log | grep -E "(DIAGNÓSTICO|STATUS|SAÚDE|LIMPEZA|ERROR)" | tail -5
echo ""

echo "5️⃣ Sugestões de Ação:"
echo "====================="
if [[ "$CLIENT_STATUS" == "error" ]] || [[ "$CLIENT_EXISTS" == "false" ]]; then
    echo "🔧 AÇÃO RECOMENDADA: Reconectar cliente"
    echo "   curl -k -X POST \"$API_BASE/clients/$INSTANCE_ID/connect\""
elif [[ "$CLIENT_STATUS" == "qr_ready" ]]; then
    echo "📱 AÇÃO RECOMENDADA: Escanear QR Code no painel"
elif [[ "$CLIENT_STATUS" == "connected" ]]; then
    echo "✅ TUDO OK: Cliente funcionando normalmente"
    echo "   Testar envio: curl -k -s \"$API_BASE/clients/$INSTANCE_ID/chats\" | jq '.success'"
else
    echo "⏳ AGUARDAR: Cliente ainda conectando"
fi
echo ""

echo "6️⃣ Monitoramento Contínuo:"
echo "=========================="
echo "Para monitorar: ./scripts/monitor-client-health.sh $INSTANCE_ID 5"
echo "Para diagnóstico: ./scripts/diagnose-client-status.sh $INSTANCE_ID"