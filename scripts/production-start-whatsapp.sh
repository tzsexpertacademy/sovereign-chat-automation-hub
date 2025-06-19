
#!/bin/bash

# Script de produção para WhatsApp Multi-Cliente
# Arquivo: scripts/production-start-whatsapp.sh

echo "🚀 INICIANDO WHATSAPP MULTI-CLIENTE - PRODUÇÃO"
echo "=============================================="

# Verificar se Node.js está disponível
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute do diretório raiz do projeto"
    exit 1
fi

# Parar servidor anterior se estiver rodando
echo "🛑 Parando servidor anterior..."
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        sleep 3
    fi
    rm -f logs/whatsapp-server.pid
fi

# Verificar se porta 4000 está livre
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 em uso. Liberando..."
    pkill -f "whatsapp-multi-client-server.js" || true
    sleep 3
fi

# Criar diretórios necessários
mkdir -p logs
mkdir -p whatsapp-sessions

# Instalar dependências se necessário
if [ ! -d "server/node_modules" ]; then
    echo "📦 Instalando dependências..."
    ./scripts/install-dependencies.sh
fi

# Ir para diretório do servidor
cd server

# Iniciar servidor em background
echo "🚀 Iniciando servidor WhatsApp Multi-Cliente (porta 4000)..."
nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
SERVER_PID=$!

# Salvar PID
echo $SERVER_PID > ../logs/whatsapp-server.pid

# Voltar para diretório raiz
cd ..

# Aguardar servidor inicializar
echo "⏳ Aguardando servidor inicializar..."
sleep 5

# Verificar se servidor está funcionando
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor WhatsApp Multi-Cliente iniciado com sucesso!"
    echo "📊 PID: $SERVER_PID"
    echo "🌐 URLs disponíveis:"
    echo "  • Health Check: http://localhost:4000/health"
    echo "  • API Swagger: http://localhost:4000/api-docs"
    echo "  • Frontend Admin: http://localhost:5173/admin/instances"
    echo ""
    echo "📝 Logs em tempo real:"
    echo "  tail -f logs/whatsapp-multi-client.log"
    echo ""
    echo "🛑 Para parar:"
    echo "  ./scripts/stop-whatsapp-server.sh"
else
    echo "❌ Falha ao iniciar servidor. Verificando logs..."
    tail -20 logs/whatsapp-multi-client.log
    exit 1
fi
