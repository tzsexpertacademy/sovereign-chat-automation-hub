
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

# Verificar se PID file existe e parar processo
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "⏹️ Parando processo PID: $PID"
        kill -TERM $PID
        sleep 5
        
        # Verificar se ainda está rodando
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️ Processo resistente, forçando parada..."
            kill -KILL $PID
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
    npm install --production
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
export NODE_OPTIONS="--max-old-space-size=2048"

# Limpeza de memória do Chrome
export PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-accelerated-2d-canvas --no-first-run --no-zygote --single-process --disable-gpu --disable-web-security --disable-features=VizDisplayCompositor --memory-pressure-off --max_old_space_size=2048"

# Iniciar servidor em background com PM2 ou nohup
echo "🚀 Iniciando servidor WhatsApp Multi-Cliente na porta 4000..."
echo "📅 Data/Hora: $(date)"

# Verificar se PM2 está disponível
if command -v pm2 &> /dev/null; then
    echo "🔧 Usando PM2 para gerenciar o processo..."
    pm2 delete whatsapp-multi-client 2>/dev/null || true
    pm2 start whatsapp-multi-client-server.js --name "whatsapp-multi-client" --log ../logs/whatsapp-multi-client.log --error ../logs/whatsapp-error.log --out ../logs/whatsapp-out.log
    pm2 save
    SERVER_PID=$(pm2 jlist | jq -r '.[] | select(.name=="whatsapp-multi-client") | .pid')
else
    echo "🔧 Usando nohup para gerenciar o processo..."
    nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
    SERVER_PID=$!
fi

# Salvar PID
echo $SERVER_PID > ../logs/whatsapp-server.pid

# Voltar para diretório raiz
cd ..

echo "⏳ Aguardando servidor inicializar..."
sleep 15

# Verificar se processo ainda está rodando
if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "❌ Processo morreu após inicialização. Verificando logs..."
    tail -50 logs/whatsapp-multi-client.log
    exit 1
fi

# Verificar se servidor está respondendo
MAX_ATTEMPTS=20
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔍 Tentativa $ATTEMPT/$MAX_ATTEMPTS - Verificando servidor..."
    
    if curl -s --max-time 10 http://localhost:4000/health > /dev/null; then
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
        echo "  • Frontend Admin: http://$(hostname -I | awk '{print $1}'):8080/admin/instances"
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
    sleep 5
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
echo "4. Verifique memória disponível: free -h"
echo "5. Verifique espaço em disco: df -h"
exit 1
