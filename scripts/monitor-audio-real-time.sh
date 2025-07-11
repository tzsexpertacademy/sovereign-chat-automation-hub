#!/bin/bash
# Dar permissão de execução: chmod +x scripts/monitor-audio-real-time.sh

# Script otimizado para monitorar áudio com APIs corretas v1.25.0+
# Arquivo: scripts/monitor-audio-real-time.sh

echo "🎵 ===== MONITOR DE ÁUDIO - APIs CORRETAS v1.25.0+ ====="
echo "🔧 Monitorando: sendAudio(), MessageMedia, chunks, APIs corretas"
echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Configuração
LOG_FILE="logs/whatsapp-multi-client.log"
SERVER_PORT="4000"
AUDIO_KEYWORDS="sendAudio|MessageMedia|CORREÇÃO|APIs corretas|áudio|audio|chunk|blob|base64|send-audio|ogg|wav|webm"

# Função para verificar servidor
check_server() {
    if curl -s --max-time 3 http://localhost:${SERVER_PORT}/health > /dev/null; then
        echo "✅ Servidor online (porta ${SERVER_PORT})"
        return 0
    else
        echo "❌ Servidor offline ou não responde"
        return 1
    fi
}

# Função para exibir estatísticas rápidas
show_stats() {
    echo "📊 ESTATÍSTICAS RÁPIDAS:"
    echo "===================="
    
    if [ -f "${LOG_FILE}" ]; then
        echo "📈 Tentativas de áudio (últimas 100 linhas):"
        tail -100 "${LOG_FILE}" | grep -c "send-audio" | xargs echo "   • Requisições send-audio:"
        tail -100 "${LOG_FILE}" | grep -c "MessageMedia" | xargs echo "   • Uso MessageMedia:"
        tail -100 "${LOG_FILE}" | grep -c "CORREÇÃO" | xargs echo "   • APIs corretas:"
        tail -100 "${LOG_FILE}" | grep -c "✅.*áudio\|✅.*audio" | xargs echo "   • Sucessos:"
        tail -100 "${LOG_FILE}" | grep -c "❌.*áudio\|❌.*audio" | xargs echo "   • Falhas:"
        echo ""
    fi
    
    check_server
    echo ""
}

# Função para colorir logs
colorize_log() {
    while read line; do
        # Timestamp
        timestamp="⏰ $(date '+%H:%M:%S')"
        
        # Colorização baseada em conteúdo
        if echo "$line" | grep -q "✅\|SUCESSO\|success"; then
            echo "🟢 ${timestamp}: $line"
        elif echo "$line" | grep -q "❌\|ERRO\|ERROR\|FALHA"; then
            echo "🔴 ${timestamp}: $line"
        elif echo "$line" | grep -q "⚠️\|WARN\|warning"; then
            echo "🟡 ${timestamp}: $line"
        elif echo "$line" | grep -q "CORREÇÃO\|APIs corretas\|MessageMedia"; then
            echo "🔧 ${timestamp}: $line"
        elif echo "$line" | grep -q "send-audio\|áudio\|audio"; then
            echo "🎵 ${timestamp}: $line"
        else
            echo "📋 ${timestamp}: $line"
        fi
    done
}

# Função principal de monitoramento
start_monitoring() {
    echo "🔄 Iniciando monitoramento em tempo real..."
    echo "   💡 Use Ctrl+C para parar"
    echo "   🔍 Filtrando por: ${AUDIO_KEYWORDS}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -f "${LOG_FILE}" ]; then
        # Mostrar últimas 5 linhas relevantes primeiro
        echo "📝 Últimas entradas de áudio:"
        tail -50 "${LOG_FILE}" | grep -i -E "${AUDIO_KEYWORDS}" | tail -5 | colorize_log
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Monitoramento em tempo real
        tail -f "${LOG_FILE}" | grep --line-buffered -i -E "${AUDIO_KEYWORDS}" | colorize_log
    else
        echo "❌ Log não encontrado: ${LOG_FILE}"
        echo "🔍 Procurando logs alternativos..."
        
        # Buscar logs alternativos
        find . -name "*whatsapp*.log" -o -name "*server*.log" 2>/dev/null | head -3 | while read logfile; do
            echo "   📁 Encontrado: $logfile"
        done
        
        echo ""
        echo "💡 Se não há logs, o servidor pode não estar configurado para logging"
        echo "   Execute: ./scripts/production-start-whatsapp.sh"
    fi
}

# Menu de opções
show_menu() {
    echo "OPÇÕES DISPONÍVEIS:"
    echo "=================="
    echo "1. [ENTER] - Monitoramento em tempo real"
    echo "2. s - Mostrar estatísticas rápidas"
    echo "3. t - Teste rápido de áudio"
    echo "4. q - Sair"
    echo ""
    read -p "Escolha uma opção (ou ENTER para monitor): " choice
    
    case $choice in
        ""|1)
            start_monitoring
            ;;
        s|S)
            show_stats
            show_menu
            ;;
        t|T)
            test_audio_endpoint
            show_menu
            ;;
        q|Q)
            echo "👋 Saindo do monitor..."
            exit 0
            ;;
        *)
            echo "❌ Opção inválida"
            show_menu
            ;;
    esac
}

# Teste rápido do endpoint
test_audio_endpoint() {
    echo "🧪 TESTE RÁPIDO DO ENDPOINT DE ÁUDIO"
    echo "===================================="
    
    if ! check_server; then
        echo "💡 Inicie o servidor: ./scripts/production-start-whatsapp.sh"
        return 1
    fi
    
    echo "📤 Testando endpoint /api/clients/test/send-audio..."
    
    # Áudio de teste mínimo
    TEST_BASE64="UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+L"
    
    PAYLOAD='{
        "to": "test@c.us",
        "audioData": "'$TEST_BASE64'",
        "fileName": "test_audio_monitor.ogg",
        "mimeType": "audio/ogg"
    }'
    
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        http://localhost:${SERVER_PORT}/api/clients/test/send-audio \
        --max-time 10)
    
    echo "📥 Resposta:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    
    # Análise da resposta
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo "✅ Endpoint funcionando - APIs corretas detectadas"
    elif echo "$RESPONSE" | grep -q "MessageMedia"; then
        echo "🔧 APIs corretas sendo usadas"
    elif echo "$RESPONSE" | grep -q "Evaluation failed"; then
        echo "❌ PROBLEMA: Evaluation failed (APIs incorretas)"
        echo "💡 Execute: ./scripts/fix-dependencies.sh"
    else
        echo "⚠️ Resposta inesperada"
    fi
    
    echo ""
}

# Verificação inicial
show_stats
echo ""

# Iniciar menu
show_menu