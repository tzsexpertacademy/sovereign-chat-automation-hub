#!/bin/bash

# Script para testar uma instância específica em detalhes
INSTANCE_ID="${1:-35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751730495129}"

echo "🎯 TESTE DETALHADO DA INSTÂNCIA"
echo "Instance ID: $INSTANCE_ID"
echo "Timestamp: $(date)"
echo "================================"

echo "1️⃣ Status atual:"
curl -s "https://146.59.227.248/clients/$INSTANCE_ID/status" | jq '.'

echo ""
echo "2️⃣ Tentando reconectar:"
curl -X POST -s "https://146.59.227.248/clients/$INSTANCE_ID/connect" | jq '.'

echo ""
echo "3️⃣ Aguardando 5 segundos..."
sleep 5

echo ""
echo "4️⃣ Status após reconectar:"
curl -s "https://146.59.227.248/clients/$INSTANCE_ID/status" | jq '.'

echo ""
echo "5️⃣ Verificando chats disponíveis:"
curl -s "https://146.59.227.248/clients/$INSTANCE_ID/chats" | jq '.'

echo ""
echo "6️⃣ Health check do servidor:"
curl -s "https://146.59.227.248/health" | jq '.activeClients, .connectedClients'

echo ""
echo "7️⃣ Lista de todos os clientes:"
curl -s "https://146.59.227.248/clients" | jq '.'