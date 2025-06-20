
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
echo "🛑 Parando servidores anteriores..."
pkill -f "whatsapp-multi-client-server.js" || true
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "⏹️ Parando processo PID: $PID"
        kill $PID
        sleep 3
        
        # Verificar se ainda está rodando
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️ Processo resistente, forçando parada..."
            kill -9 $PID
            sleep 2
        fi
    fi
    rm -f logs/whatsapp-server.pid
fi

# Verificar se porta 4000 está livre
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 em uso. Liberando..."
    fuser -k 4000/tcp || true
    sleep 3
fi

# Criar diretórios necessários
echo "📁 Criando diretórios..."
mkdir -p logs
mkdir -p whatsapp-sessions
mkdir -p server

# Verificar se diretório server existe
if [ ! -d "server" ]; then
    echo "❌ Diretório server/ não encontrado"
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "server/node_modules" ]; then
    echo "📦 Instalando dependências do servidor..."
    cd server
    npm install
    cd ..
fi

# Verificar se arquivo do servidor existe
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Arquivo do servidor não encontrado: server/whatsapp-multi-client-server.js"
    echo "ℹ️ Certifique-se de que o arquivo existe no diretório server/"
    exit 1
fi

# Ir para diretório do servidor
cd server

# Configurar variáveis de ambiente para produção
export NODE_ENV=production
export WHATSAPP_PORT=4000
export SESSIONS_PATH=../whatsapp-sessions
export LOGS_PATH=../logs
export PUPPETEER_HEADLESS=true
export PUPPETEER_NO_SANDBOX=true

# Iniciar servidor em background
echo "🚀 Iniciando servidor WhatsApp Multi-Cliente na porta 4000..."
echo "📅 Data/Hora: $(date)"

nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
SERVER_PID=$!

# Salvar PID
echo $SERVER_PID > ../logs/whatsapp-server.pid

# Voltar para diretório raiz
cd ..

echo "⏳ Aguardando servidor inicializar..."
sleep 10

# Verificar se processo ainda está rodando
if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "❌ Processo morreu após inicialização. Verificando logs..."
    tail -30 logs/whatsapp-multi-client.log
    exit 1
fi

# Verificar se servidor está respondendo
MAX_ATTEMPTS=15
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔍 Tentativa $ATTEMPT/$MAX_ATTEMPTS - Verificando servidor..."
    
    if curl -s --max-time 5 http://localhost:4000/health > /dev/null; then
        echo "✅ Servidor WhatsApp Multi-Cliente iniciado com sucesso!"
        echo ""
        echo "📊 Informações do servidor:"
        echo "  🆔 PID: $SERVER_PID"
        echo "  🌐 Porta: 4000"
        echo "  📍 IP do servidor: $(hostname -I | awk '{print $1}')"
        echo ""
        echo "🌐 URLs de acesso:"
        echo "  • Health Check: http://$(hostname -I | awk '{print $1}'):4000/health"
        echo "  • API Swagger: http://$(hostname -I | awk '{print $1}'):4000/api-docs"
        echo "  • Frontend Admin: http://$(hostname -I | awk '{print $1}'):5173/admin/instances"
        echo ""
        echo "📝 Logs em tempo real:"
        echo "  tail -f logs/whatsapp-multi-client.log"
        echo ""
        echo "🛑 Para parar:"
        echo "  ./scripts/production-stop-whatsapp.sh"
        echo ""
        echo "🔍 Para verificar status:"
        echo "  ./scripts/check-whatsapp-health.sh"
        
        # Mostrar status atual
        echo ""
        echo "📊 Status atual do servidor:"
        curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health
        
        exit 0
    fi
    
    echo "⏳ Servidor ainda não está respondendo, aguardando..."
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ Falha ao iniciar servidor após $MAX_ATTEMPTS tentativas"
echo "📝 Últimas linhas do log:"
tail -50 logs/whatsapp-multi-client.log
echo ""
echo "🔍 Status do processo:"
ps aux | grep $SERVER_PID | grep -v grep || echo "Processo não encontrado"
echo ""
echo "💡 Dicas de troubleshooting:"
echo "1. Verifique se a porta 4000 não está sendo usada: lsof -i :4000"
echo "2. Verifique os logs: cat logs/whatsapp-multi-client.log"
echo "3. Verifique se o arquivo do servidor existe: ls -la server/whatsapp-multi-client-server.js"
exit 1
