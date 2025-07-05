#!/bin/bash

echo "🔍 TESTE COMPLETO DO FLUXO QR CODE"
echo "=================================="

API_BASE="https://146.59.227.248"
TEST_CLIENT_ID="test_complete_flow_$(date +%s)"

echo "📱 ID do Teste: $TEST_CLIENT_ID"
echo ""

# Função para verificar status com diagnóstico completo
check_detailed_status() {
    local client_id=$1
    echo "📊 DIAGNÓSTICO COMPLETO DE STATUS: $client_id"
    echo "================================================"
    
    # Status básico
    echo "1️⃣ Status básico:"
    STATUS_RESPONSE=$(curl -k -s "$API_BASE/clients/$client_id/status")
    echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "Resposta não é JSON válido: $STATUS_RESPONSE"
    
    echo ""
    echo "2️⃣ Status detalhado com diagnóstico:"
    DIAGNOSTIC_RESPONSE=$(curl -k -s "$API_BASE/clients/$client_id/status-diagnostic")
    echo "$DIAGNOSTIC_RESPONSE" | jq '.' 2>/dev/null || echo "Diagnóstico indisponível: $DIAGNOSTIC_RESPONSE"
    
    echo ""
    echo "3️⃣ Lista de todos os clientes:"
    curl -k -s "$API_BASE/clients" | jq '.clients[] | select(.clientId == "'$client_id'")' 2>/dev/null || echo "Cliente não encontrado na lista"
    
    echo ""
    echo "4️⃣ Health check do servidor:"
    curl -k -s "$API_BASE/health" | jq '.activeClients, .connectedClients' 2>/dev/null || echo "Health check falhou"
    
    echo ""
    return 0
}

# FASE 1: Criar instância e gerar QR
echo "🚀 FASE 1: Criando instância $TEST_CLIENT_ID"
echo "============================================"

CREATE_RESPONSE=$(curl -k -s -X POST "$API_BASE/clients/$TEST_CLIENT_ID/connect")
echo "Resposta da criação:"
echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"

echo ""
echo "⏳ Aguardando 5 segundos para QR ser gerado..."
sleep 5

# FASE 2: Verificar QR gerado
echo ""
echo "📱 FASE 2: Verificando QR Code inicial"
echo "====================================="
check_detailed_status "$TEST_CLIENT_ID"

# FASE 3: Aguardar e monitorar
echo ""
echo "⏳ FASE 3: Monitoramento por 60 segundos"
echo "========================================"
echo "🔔 AGORA É A HORA: Escaneie o QR Code com seu WhatsApp!"
echo "📱 Monitorando mudanças de status..."

for i in {1..12}; do
    echo ""
    echo "📊 Verificação $i/12 (${i}0 segundos):"
    echo "----------------------------------------"
    
    STATUS_RESPONSE=$(curl -k -s "$API_BASE/clients/$TEST_CLIENT_ID/status")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
    HAS_QR=$(echo "$STATUS_RESPONSE" | jq -r '.hasQrCode // false')
    PHONE=$(echo "$STATUS_RESPONSE" | jq -r '.phoneNumber // "N/A"')
    
    echo "Status: $STATUS | QR: $HAS_QR | Telefone: $PHONE"
    
    # Se conectou, mostrar detalhes
    if [ "$STATUS" = "connected" ]; then
        echo "🎉 SUCESSO! Instância conectada!"
        echo "📱 Telefone: $PHONE"
        echo "⏰ Tempo até conexão: ${i}0 segundos"
        
        echo ""
        echo "📊 Status final completo:"
        check_detailed_status "$TEST_CLIENT_ID"
        break
    fi
    
    # Se autenticado mas não conectado ainda
    if [ "$STATUS" = "authenticated" ]; then
        echo "✅ Autenticado! Aguardando ready..."
    fi
    
    sleep 10
done

# FASE 4: Teste de persistência
echo ""
echo "🔄 FASE 4: Teste de persistência"
echo "==============================="
echo "Verificando se o status persiste após múltiplas consultas..."

for i in {1..3}; do
    echo "Consulta de persistência $i/3:"
    STATUS_RESPONSE=$(curl -k -s "$API_BASE/clients/$TEST_CLIENT_ID/status")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
    echo "Status: $STATUS"
    sleep 2
done

echo ""
echo "✅ TESTE COMPLETO FINALIZADO"
echo "============================"
echo "📝 RESULTADOS:"
echo "• ID do teste: $TEST_CLIENT_ID"
echo "• Status final: $(curl -k -s "$API_BASE/clients/$TEST_CLIENT_ID/status" | jq -r '.status // "unknown"')"
echo ""
echo "🧹 Para limpar: curl -k -X POST \"$API_BASE/clients/$TEST_CLIENT_ID/disconnect\""