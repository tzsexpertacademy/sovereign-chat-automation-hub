
#!/bin/bash

echo "🧪 TESTE DE CONEXÃO WHATSAPP COMPLETO"
echo "===================================="

# Verificar se servidor está rodando
echo "1️⃣ Verificando servidor..."
if curl -k -s "https://146.59.227.248/health" > /dev/null; then
    echo "✅ Servidor respondendo"
else
    echo "❌ Servidor não está respondendo"
    exit 1
fi

# Verificar processos
echo ""
echo "2️⃣ Verificando processos..."
SERVER_PID=$(pgrep -f "whatsapp-multi-client-server.js")
CHROME_COUNT=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)

echo "📊 PID do servidor: ${SERVER_PID:-'Não encontrado'}"
echo "📊 Processos Chrome: $CHROME_COUNT"

# Verificar logs de erro
echo ""
echo "3️⃣ Verificando erros recentes..."
ERROR_COUNT=$(tail -50 logs/whatsapp-multi-client.log 2>/dev/null | grep -E "(Error|error|ERROR)" | wc -l)
echo "⚠️ Erros nos últimos 50 logs: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "🔍 Últimos erros:"
    tail -50 logs/whatsapp-multi-client.log 2>/dev/null | grep -E "(Error|error|ERROR)" | tail -3
fi

# Verificar sistema de recuperação
echo ""
echo "4️⃣ Verificando sistema de recuperação..."
RECOVERY_LOGS=$(tail -100 logs/whatsapp-multi-client.log 2>/dev/null | grep "SESSION-RECOVERY" | wc -l)
echo "🔄 Logs de recuperação encontrados: $RECOVERY_LOGS"

echo ""
echo "✅ TESTE CONCLUÍDO"
echo "=================="
echo "📍 Status do sistema:"
echo "  • Servidor: ${SERVER_PID:+✅ Online}${SERVER_PID:-❌ Offline}"
echo "  • Chrome: $CHROME_COUNT processos"
echo "  • Erros: $ERROR_COUNT recentes"
echo "  • Recuperação: ${RECOVERY_LOGS:+✅ Ativa}${RECOVERY_LOGS:-⚠️ Inativa}"

if [ ! -z "$SERVER_PID" ] && [ "$ERROR_COUNT" -lt 5 ]; then
    echo ""
    echo "🎯 SISTEMA PRONTO PARA TESTE!"
    echo "1. Crie uma instância no painel"
    echo "2. Escaneie o QR Code quando aparecer"  
    echo "3. Monitore: ./scripts/monitor-puppeteer-sessions.sh"
else
    echo ""
    echo "⚠️ SISTEMA PRECISA DE ATENÇÃO"
    echo "Verifique os logs: tail -f logs/whatsapp-multi-client.log"
fi
