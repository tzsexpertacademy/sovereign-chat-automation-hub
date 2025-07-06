
#!/bin/bash

echo "🧪 TESTE DE FLUXO DE CONEXÃO WHATSAPP"
echo "===================================="

# Função para aguardar com timeout
wait_for_condition() {
    local condition_check="$1"
    local timeout="$2"
    local description="$3"
    local elapsed=0
    local interval=2
    
    echo "⏳ Aguardando: $description (timeout: ${timeout}s)"
    
    while [ $elapsed -lt $timeout ]; do
        if eval "$condition_check"; then
            echo "✅ Condição atendida em ${elapsed}s"
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo "  ⏱️ ${elapsed}/${timeout}s..."
    done
    
    echo "❌ Timeout após ${timeout}s"
    return 1
}

echo "1️⃣ Verificando servidor..."
if ! curl -k -s "https://146.59.227.248/health" > /dev/null; then
    echo "❌ Servidor não está respondendo"
    exit 1
fi
echo "✅ Servidor OK"

echo ""
echo "2️⃣ Verificando logs em tempo real..."
echo "📝 Iniciando monitoramento de logs (pressione Ctrl+C para parar):"
echo "   tail -f logs/whatsapp-multi-client.log | grep -E '(CONNECTION-CHECK|QR|READY|connected)'"
echo ""

# Instruções para o usuário
echo "🎯 INSTRUÇÕES PARA TESTE:"
echo "========================"
echo "1. Abra outro terminal e execute:"
echo "   tail -f logs/whatsapp-multi-client.log | grep -E '(CONNECTION-CHECK|QR|READY|connected)'"
echo ""
echo "2. No painel admin, crie uma nova instância"
echo ""
echo "3. Escaneie o QR Code que aparecer"
echo ""
echo "4. Observe os logs - você deve ver:"
echo "   • QR CODE GERADO"
echo "   • INICIANDO VERIFICAÇÃO ATIVA"
echo "   • CONNECTION-CHECK - Estado: OPENING"
echo "   • CONNECTION-CHECK - Estado: CONNECTED"
echo "   • Status atualizado para connected"
echo ""
echo "5. O status na interface deve mudar para 'Conectado' automaticamente"
echo ""
echo "📊 MONITORAMENTO AUTOMÁTICO:"
echo "Executando verificação automática a cada 15 segundos..."

# Loop de monitoramento
LOOP_COUNT=0
MAX_LOOPS=40  # 10 minutos total

while [ $LOOP_COUNT -lt $MAX_LOOPS ]; do
    echo ""
    echo "🔍 Verificação #$((LOOP_COUNT + 1)) - $(date '+%H:%M:%S')"
    echo "================================================"
    
    # Verificar health
    HEALTH=$(curl -k -s "https://146.59.227.248/health" 2>/dev/null)
    if [ ! -z "$HEALTH" ]; then
        ACTIVE=$(echo "$HEALTH" | grep -o '"activeClients":[0-9]*' | cut -d':' -f2)
        CONNECTED=$(echo "$HEALTH" | grep -o '"connectedClients":[0-9]*' | cut -d':' -f2)
        echo "📱 Clientes: ${ACTIVE:-0} ativos, ${CONNECTED:-0} conectados"
        
        if [ "${CONNECTED:-0}" -gt 0 ]; then
            echo "🎉 CONEXÃO DETECTADA!"
            echo "✅ Teste de fluxo de conexão BEM-SUCEDIDO!"
            exit 0
        fi
    fi
    
    # Verificar logs recentes
    echo "📝 Últimos eventos:"
    tail -10 logs/whatsapp-multi-client.log 2>/dev/null | \
    grep -E "(CONNECTION-CHECK|QR|READY|connected)" | \
    tail -3 | \
    while read line; do
        echo "  $line"
    done
    
    LOOP_COUNT=$((LOOP_COUNT + 1))
    
    if [ $LOOP_COUNT -lt $MAX_LOOPS ]; then
        echo "⏳ Próxima verificação em 15s..."
        sleep 15
    fi
done

echo ""
echo "⏰ Monitoramento finalizado após 10 minutos"
echo "💡 Se não houve conexão, verifique:"
echo "1. Se o QR Code foi escaneado corretamente"
echo "2. Se o WhatsApp do celular está funcionando"
echo "3. Os logs detalhados: tail -f logs/whatsapp-multi-client.log"
