
#!/bin/bash

# Script para parar WhatsApp Multi-Cliente em produção
# Arquivo: scripts/production-stop-whatsapp.sh

echo "🛑 PARANDO WHATSAPP MULTI-CLIENTE - PRODUÇÃO"
echo "=========================================="

# Parar pelo PID se disponível
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    echo "🔍 PID encontrado: $PID"
    
    if ps -p $PID > /dev/null 2>&1; then
        echo "⏹️ Parando processo PID: $PID"
        kill $PID
        sleep 5
        
        # Verificar se ainda está rodando
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️ Processo resistente, forçando parada..."
            kill -9 $PID
            sleep 2
        fi
        
        echo "✅ Processo parado com sucesso"
    else
        echo "⚠️ Processo PID $PID não está rodando"
    fi
    
    rm -f logs/whatsapp-server.pid
else
    echo "⚠️ Arquivo PID não encontrado"
fi

# Parar todos os processos relacionados
echo "🔍 Parando todos os processos WhatsApp Multi-Cliente..."
pkill -f "whatsapp-multi-client-server.js" || true

# Verificar porta 4000
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 ainda em uso, forçando liberação..."
    fuser -k 4000/tcp || true
    sleep 2
fi

# Verificar status final
if ! lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Porta 4000 está livre"
    echo "✅ WhatsApp Multi-Cliente parado com sucesso"
else
    echo "⚠️ Porta 4000 ainda pode estar em uso"
fi

echo ""
echo "📊 Status das portas principais:"
sudo lsof -i :3002 -i :3005 -i :4000 -i :5173 | head -10
