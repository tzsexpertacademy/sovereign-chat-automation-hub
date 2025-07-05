#!/bin/bash

echo "🔍 TESTE RÁPIDO DA API"
echo "===================="

INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751732037364"
API_BASE="http://146.59.227.248:4000"

echo "🎯 Instance ID: $INSTANCE_ID"
echo "🌐 API Base: $API_BASE"
echo ""

echo "1️⃣ Teste API status (HTTP direto):"
echo "==================================="
curl -v "$API_BASE/clients/$INSTANCE_ID/status" 2>&1

echo ""
echo ""
echo "2️⃣ Teste HTTPS com SSL ignorado:"
echo "==============================="
curl -k -v "https://146.59.227.248/clients/$INSTANCE_ID/status" 2>&1

echo ""
echo ""
echo "2️⃣ Última linha do log do servidor:"
echo "=================================="
tail -1 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log

echo ""
echo "3️⃣ Health check:"
echo "================"
curl -s "$API_BASE/health" | jq -r '.activeClients // "N/A"'