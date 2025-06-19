
#!/bin/bash

# Script para parar servidor WhatsApp Multi-Cliente
# Arquivo: scripts/stop-whatsapp-server.sh

echo "🛑 Parando Servidor WhatsApp Multi-Cliente..."

# Verificar se arquivo PID existe
if [ -f "../logs/whatsapp-server.pid" ]; then
    PID=$(cat ../logs/whatsapp-server.pid)
    
    if ps -p $PID > /dev/null; then
        echo "⏹️ Parando processo PID: $PID"
        kill $PID
        sleep 3
        
        # Verificar se processo ainda está rodando
        if ps -p $PID > /dev/null; then
            echo "⚠️ Processo ainda rodando, forçando parada..."
            kill -9 $PID
        fi
        
        echo "✅ Servidor parado com sucesso!"
    else
        echo "⚠️ Processo não está rodando."
    fi
    
    # Remover arquivo PID
    rm -f ../logs/whatsapp-server.pid
else
    echo "⚠️ Arquivo PID não encontrado. Tentando parar processo..."
    pkill -f "whatsapp-multi-client-server.js"
    echo "✅ Comando de parada enviado."
fi

# Verificar se porta está livre
if ! lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Porta 4000 está livre."
else
    echo "⚠️ Porta 4000 ainda está em uso."
fi
