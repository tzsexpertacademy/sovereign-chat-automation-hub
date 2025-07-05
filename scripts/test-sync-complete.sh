#!/bin/bash

echo "🔄 TESTE COMPLETO DE SINCRONIZAÇÃO"
echo "=================================="

API_BASE="https://146.59.227.248"

echo "1️⃣ Status atual do servidor:"
echo "=========================="
curl -k -s "$API_BASE/health" | jq '.' || echo "Servidor offline"
echo ""

echo "2️⃣ Status de sincronização:"
echo "=========================="
curl -k -s "$API_BASE/sync/status" | jq '.' || echo "Erro na verificação"
echo ""

echo "3️⃣ Executando sincronização manual:"
echo "==================================="
SYNC_RESULT=$(curl -k -s -X POST "$API_BASE/sync/database")
echo "$SYNC_RESULT" | jq '.' 2>/dev/null || echo "$SYNC_RESULT"
echo ""

echo "4️⃣ Status após sincronização:"
echo "============================="
curl -k -s "$API_BASE/sync/status" | jq '.sync_status' || echo "Erro na verificação"
echo ""

echo "5️⃣ Lista de clientes no servidor:"
echo "=================================="
curl -k -s "$API_BASE/clients" | jq '.clients[] | {id: .clientId, status: .status}' 2>/dev/null || echo "Erro ao listar clientes"
echo ""

echo "✅ Teste de sincronização completo!"