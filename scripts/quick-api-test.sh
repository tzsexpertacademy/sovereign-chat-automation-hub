#!/bin/bash

echo "🔍 TESTE RÁPIDO DA API"
echo "===================="

INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751732037364"
API_BASE="https://146.59.227.248"

echo "🎯 Instance ID: $INSTANCE_ID"
echo ""

echo "1️⃣ Teste completo da API status:"
echo "==============================="
curl -v "$API_BASE/clients/$INSTANCE_ID/status" 2>&1

echo ""
echo ""
echo "2️⃣ Última linha do log do servidor:"
echo "=================================="
tail -1 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log

echo ""
echo "3️⃣ Health check:"
echo "================"
curl -s "$API_BASE/health" | jq -r '.activeClients // "N/A"'