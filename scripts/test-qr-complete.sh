#!/bin/bash

echo "🔍 TESTE COMPLETO DO SISTEMA QR CODE"
echo "===================================="

API_BASE="https://146.59.227.248"
TEST_CLIENT_ID="test_qr_$(date +%s)"

# Função para verificar status
check_status() {
    local client_id=$1
    echo "📊 Verificando status de $client_id..."
    
    STATUS_RESPONSE=$(curl -k -s "$API_BASE/clients/$client_id/status")
    echo "Status Response: $STATUS_RESPONSE"
    
    HAS_QR=$(echo "$STATUS_RESPONSE" | jq -r '.hasQrCode // false')
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
    
    echo "Status: $STATUS, Has QR: $HAS_QR"
    return 0
}

# Teste 1: Criar instância
echo "🚀 TESTE 1: Criando instância $TEST_CLIENT_ID"
CREATE_RESPONSE=$(curl -k -s -X POST "$API_BASE/clients/$TEST_CLIENT_ID/connect")
echo "Create Response: $CREATE_RESPONSE"

sleep 3

# Teste 2: Verificar QR gerado
echo ""
echo "📱 TESTE 2: Verificando QR Code"
check_status "$TEST_CLIENT_ID"

# Teste 3: Aguardar e verificar persistência do QR
echo ""
echo "⏳ TESTE 3: Aguardando 10 segundos para verificar persistência..."
sleep 10

check_status "$TEST_CLIENT_ID"

# Teste 4: Simular múltiplas verificações rápidas
echo ""
echo "🔄 TESTE 4: Verificações rápidas (simulando frontend)"
for i in {1..5}; do
    echo "Verificação $i:"
    check_status "$TEST_CLIENT_ID"
    sleep 2
done

# Teste 5: Verificar cleanup de expirados
echo ""
echo "🧹 TESTE 5: Testando cleanup de QR expirados"
./scripts/cleanup-expired-qr.sh

echo ""
echo "✅ TESTE COMPLETO FINALIZADO"
echo "👆 Observe se o QR Code permaneceu disponível durante todo o teste"
echo "📱 Para teste real: escaneie o QR Code com WhatsApp antes que expire"