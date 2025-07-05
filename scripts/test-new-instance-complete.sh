#!/bin/bash

echo "🧪 TESTE COMPLETO DE NOVA INSTÂNCIA - PUPPETEER OTIMIZADO"
echo "========================================================="

# Gerar ID único para teste
TEST_ID="test_puppeteer_$(date +%s)"
echo "🎯 ID de teste: $TEST_ID"

echo ""
echo "1️⃣ HEALTH CHECK INICIAL"
echo "========================"
HEALTH_STATUS=$(curl -k -s "https://146.59.227.248/health" | jq -r '.status // "offline"')
ACTIVE_CLIENTS=$(curl -k -s "https://146.59.227.248/health" | jq -r '.activeClients // 0')
echo "Servidor: $HEALTH_STATUS | Clientes ativos: $ACTIVE_CLIENTS"

echo ""
echo "2️⃣ CRIANDO NOVA INSTÂNCIA"
echo "=========================="
echo "📤 Enviando comando para criar instância..."
CREATE_RESPONSE=$(curl -k -s -X POST "https://146.59.227.248/clients/$TEST_ID/connect")
echo "Resposta: $CREATE_RESPONSE"

echo ""
echo "3️⃣ MONITORAMENTO EM TEMPO REAL (60 segundos)"
echo "============================================="

START_TIME=$(date +%s)
TIMEOUT=60

echo "⏱️ Aguardando até $TIMEOUT segundos para QR Code aparecer..."
echo "🔍 Verificando status a cada 3 segundos..."

while [ $(($(date +%s) - START_TIME)) -lt $TIMEOUT ]; do
    ELAPSED=$(($(date +%s) - START_TIME))
    
    # Verificar status da instância
    STATUS_RESPONSE=$(curl -k -s "https://146.59.227.248/clients/$TEST_ID/status" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$STATUS_RESPONSE" ]; then
        STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
        HAS_QR=$(echo "$STATUS_RESPONSE" | jq -r '.hasQrCode // false')
        PHONE=$(echo "$STATUS_RESPONSE" | jq -r '.phoneNumber // "null"')
        
        echo "📊 [${ELAPSED}s] Status: $STATUS | QR: $HAS_QR | Phone: $PHONE"
        
        # Se QR Code apareceu
        if [ "$HAS_QR" = "true" ]; then
            echo ""
            echo "🎉 QR CODE GERADO COM SUCESSO!"
            echo "✅ Tempo para gerar QR: ${ELAPSED} segundos"
            echo "📱 Status atual: $STATUS"
            echo ""
            echo "🔗 Para ver o QR Code, acesse o painel admin:"
            echo "   https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
            echo ""
            echo "📋 Para continuar monitorando até conexão:"
            echo "   ./scripts/monitor-puppeteer-detailed.sh $TEST_ID"
            break
        fi
        
        # Se conectou diretamente (sessão salva)
        if [ "$STATUS" = "connected" ]; then
            echo ""
            echo "🎉 CONECTADO DIRETAMENTE (sessão salva)!"
            echo "✅ Tempo para conectar: ${ELAPSED} segundos"
            echo "📱 Telefone: $PHONE"
            break
        fi
        
        # Se falhou
        if [ "$STATUS" = "auth_failed" ] || [ "$STATUS" = "failed" ]; then
            echo ""
            echo "❌ FALHA NA AUTENTICAÇÃO!"
            echo "Status: $STATUS"
            break
        fi
    else
        echo "⚠️ [${ELAPSED}s] Erro na comunicação com servidor"
    fi
    
    sleep 3
done

echo ""
echo "4️⃣ RESULTADO FINAL"
echo "==================="

# Status final
FINAL_STATUS_RESPONSE=$(curl -k -s "https://146.59.227.248/clients/$TEST_ID/status" 2>/dev/null)
if [ ! -z "$FINAL_STATUS_RESPONSE" ]; then
    FINAL_STATUS=$(echo "$FINAL_STATUS_RESPONSE" | jq -r '.status // "unknown"')
    FINAL_HAS_QR=$(echo "$FINAL_STATUS_RESPONSE" | jq -r '.hasQrCode // false')
    FINAL_PHONE=$(echo "$FINAL_STATUS_RESPONSE" | jq -r '.phoneNumber // "null"')
    
    echo "📊 Status final: $FINAL_STATUS"
    echo "📱 Tem QR Code: $FINAL_HAS_QR"
    echo "📞 Telefone: $FINAL_PHONE"
    
    if [ "$FINAL_HAS_QR" = "true" ]; then
        echo ""
        echo "✅ TESTE BEM-SUCEDIDO! QR Code gerado corretamente."
        echo "🔧 Puppeteer está funcionando adequadamente."
    elif [ "$FINAL_STATUS" = "connected" ]; then
        echo ""
        echo "✅ TESTE BEM-SUCEDIDO! Conectado diretamente."
        echo "🔧 Puppeteer e sessão funcionando adequadamente."
    else
        echo ""
        echo "⚠️ TESTE INCONCLUSIVO ou FALHA"
        echo "🔧 Status: $FINAL_STATUS"
        
        # Verificar logs para diagnóstico
        echo ""
        echo "📋 Últimas linhas do log para diagnóstico:"
        tail -10 logs/whatsapp-multi-client.log | grep -E "($TEST_ID|TIMEOUT|erro|ERROR)"
    fi
else
    echo "❌ Não foi possível obter status final"
fi

echo ""
echo "🧹 LIMPEZA"
echo "=========="
echo "Para remover a instância de teste:"
echo "curl -k -X POST \"https://146.59.227.248/clients/$TEST_ID/disconnect\""

echo ""
echo "✅ Teste completo finalizado!"