#!/bin/bash

echo "🔍 DIAGNÓSTICO DETALHADO DA API - WHATSAPP"
echo "=========================================="

# Instance ID completo
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751732037364"
API_BASE="https://146.59.227.248"

echo "🎯 Testando Instance ID: $INSTANCE_ID"
echo ""

echo "1️⃣ Status direto da API:"
echo "========================"
response=$(curl -s "$API_BASE/clients/$INSTANCE_ID/status")
echo "Response: $response"
echo ""

echo "2️⃣ Health check do servidor:"
echo "=========================="
curl -s "$API_BASE/health" | jq -r '.activeClients // "N/A"' | head -1
echo ""

echo "3️⃣ Lista de clientes ativos:"
echo "=========================="
curl -s "$API_BASE/clients" | jq -r '.clients // []' | head -10
echo ""

echo "4️⃣ Logs do servidor (últimas 20 linhas):"
echo "========================================"
tail -20 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log | grep -E "(STATUS|CONECTADO|ERROR|connected|authenticated|qr_ready)" | tail -10
echo ""

echo "5️⃣ Testando com curl verbose:"
echo "============================"
echo "Status code da requisição:"
curl -s -o /dev/null -w "%{http_code}" "$API_BASE/clients/$INSTANCE_ID/status"
echo ""
echo ""

echo "6️⃣ Detalhes da resposta completa:"
echo "==============================="
curl -v "$API_BASE/clients/$INSTANCE_ID/status" 2>&1 | head -20