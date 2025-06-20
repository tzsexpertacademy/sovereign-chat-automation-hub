
#!/bin/bash

# Script para verificar saúde do sistema WhatsApp Multi-Cliente
# Arquivo: scripts/check-whatsapp-health.sh

echo "🔍 Verificando saúde do sistema WhatsApp Multi-Cliente..."
echo "================================================="

# Verificar se o servidor está rodando
HEALTH_URL="http://localhost:4000/health"

if curl -s --max-time 10 $HEALTH_URL > /dev/null; then
    echo "✅ Servidor WhatsApp Multi-Cliente está rodando (porta 4000)"
    
    # Mostrar informações do servidor
    echo ""
    echo "📊 Status do servidor:"
    HEALTH_DATA=$(curl -s --max-time 5 $HEALTH_URL)
    echo "$HEALTH_DATA" | jq . 2>/dev/null || echo "$HEALTH_DATA"
    
    echo ""
    echo "🌐 URLs disponíveis:"
    echo "• API Health: http://localhost:4000/health"
    echo "• Swagger API: http://localhost:4000/api-docs"
    echo "• Frontend Admin: http://localhost:5173/admin/instances"
    
    # Verificar se PID file existe e processo está rodando
    if [ -f "logs/whatsapp-server.pid" ]; then
        PID=$(cat logs/whatsapp-server.pid)
        if ps -p $PID > /dev/null 2>&1; then
            echo ""
            echo "✅ Processo PID $PID está ativo"
            
            # Mostrar uso de CPU e memória
            echo "📈 Uso de recursos:"
            ps -p $PID -o pid,ppid,%cpu,%mem,cmd --no-headers 2>/dev/null || echo "Não foi possível obter dados de recursos"
        else
            echo ""
            echo "⚠️ Arquivo PID existe mas processo não está rodando"
        fi
    else
        echo ""
        echo "⚠️ Arquivo PID não encontrado"
    fi
    
else
    echo "❌ Servidor WhatsApp Multi-Cliente não está rodando"
    echo ""
    echo "🔍 Verificando possíveis causas:"
    
    # Verificar se porta está em uso
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️ Porta 4000 está em uso por outro processo:"
        lsof -Pi :4000 -sTCP:LISTEN
    else
        echo "ℹ️ Porta 4000 está livre"
    fi
    
    # Verificar logs se existirem
    if [ -f "logs/whatsapp-multi-client.log" ]; then
        echo ""
        echo "📝 Últimas linhas do log:"
        tail -10 logs/whatsapp-multi-client.log
    fi
    
    echo ""
    echo "💡 Para iniciar o servidor:"
    echo "  ./scripts/production-start-whatsapp.sh"
fi

echo ""
echo "🔍 Processos WhatsApp ativos:"
ps aux | grep -E "(whatsapp|chrome)" | grep -v grep | head -10

echo ""
echo "🔍 Portas relacionadas em uso:"
echo "Porta 4000 (WhatsApp Multi-Cliente):"
lsof -i :4000 2>/dev/null || echo "  Nenhum processo"

echo "Porta 3002 (Sistema existente):"
lsof -i :3002 2>/dev/null || echo "  Nenhum processo"

echo "Porta 3005 (Sistema existente):"
lsof -i :3005 2>/dev/null || echo "  Nenhum processo"

echo "Porta 5173 (Frontend):"
lsof -i :5173 2>/dev/null || echo "  Nenhum processo"

echo ""
echo "📅 Verificação concluída em: $(date)"
