
#!/bin/bash

# Script para verificar se porta está disponível
PORT=${1:-4000}

echo "🔍 Verificando disponibilidade da porta $PORT..."

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️ Porta $PORT está em uso:"
    lsof -Pi :$PORT -sTCP:LISTEN
    
    echo ""
    echo "🛑 Parando processos na porta $PORT..."
    pkill -f "whatsapp-multi-client-server.js" || true
    sleep 3
    
    # Verificar novamente
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️ Forçando liberação da porta $PORT..."
        fuser -k $PORT/tcp || true
        sleep 2
    fi
    
    # Verificação final
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Não foi possível liberar a porta $PORT"
        exit 1
    else
        echo "✅ Porta $PORT liberada com sucesso"
    fi
else
    echo "✅ Porta $PORT está livre"
fi
