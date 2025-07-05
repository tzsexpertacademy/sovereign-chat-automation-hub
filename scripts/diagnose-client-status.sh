#!/bin/bash

# Script para diagnóstico profundo de clientes WhatsApp
# Arquivo: scripts/diagnose-client-status.sh

INSTANCE_ID="${1:-35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751733656603}"
API_BASE="https://146.59.227.248"

echo "🔍 DIAGNÓSTICO PROFUNDO DO CLIENTE WHATSAPP"
echo "============================================="
echo "🎯 Instance ID: $INSTANCE_ID"
echo "🕐 Timestamp: $(date)"
echo ""

echo "1️⃣ Health Check do Servidor:"
echo "============================"
curl -k -s "$API_BASE/health" | jq -r '.status // "offline"'
echo ""

echo "2️⃣ Lista de Clientes Ativos:"
echo "============================"
curl -k -s "$API_BASE/clients" | jq -r '.clients // []' | head -20
echo ""

echo "3️⃣ Status Detalhado com Diagnóstico:"
echo "===================================="
curl -k -s "$API_BASE/clients/$INSTANCE_ID/status" | jq '.'
echo ""

echo "4️⃣ Logs do Servidor (últimas 10 linhas):"
echo "========================================"
tail -10 /home/ubuntu/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log | grep -E "(STATUS|ERRO|ERROR|DIAGNÓSTICO|SAÚDE|LIMPEZA)" | tail -5
echo ""

echo "5️⃣ Verificação de Processos Chrome:"
echo "=================================="
pgrep -f chrome | wc -l | xargs echo "Processos Chrome ativos:"
echo ""

echo "6️⃣ Usar o cliente:"
echo "=================="
echo "Para testar conexão: curl -k -X POST \"$API_BASE/clients/$INSTANCE_ID/connect\""
echo "Para ver chats: curl -k -s \"$API_BASE/clients/$INSTANCE_ID/chats\" | jq '.success'"
echo ""

echo "✅ Diagnóstico completo finalizado!"