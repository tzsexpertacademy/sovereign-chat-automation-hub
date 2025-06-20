
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
./scripts/production-stop-whatsapp.sh

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

# Iniciar servidor em background
echo "🚀 Iniciando servidor WhatsApp Multi-Cliente na porta 4000..."
echo "📅 Data/Hora: $(date)"

# Verificar se PM2 está disponível
if command -v pm2 &> /dev/null; then
    echo "🔧 Usando PM2 para gerenciar o processo..."
    pm2 delete whatsapp-multi-client 2>/dev/null || true
    pm2 start whatsapp-multi-client-server.js --name "whatsapp-multi-client" \
        --log ../logs/whatsapp-multi-client.log \
        --error ../logs/whatsapp-error.log \
        --max-memory-restart 1G \
        --restart-delay 5000 \
        --time
    pm2 save
    sleep 5
    SERVER_PID=$(pm2 jlist | jq -r '.[] | select(.name=="whatsapp-multi-client") | .pid' 2>/dev/null || echo "")
else
    echo "🔧 Usando nohup para gerenciar o processo..."
    nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
    SERVER_PID=$!
    sleep 3
fi

# Salvar PID se disponível
if [ -n "$SERVER_PID" ]; then
    echo $SERVER_PID > ../logs/whatsapp-server.pid
fi

# Voltar para diretório raiz
cd ..

echo "⏳ Aguardando servidor inicializar..."
sleep 8

# Verificar se servidor está respondendo
MAX_ATTEMPTS=12
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔍 Tentativa $ATTEMPT/$MAX_ATTEMPTS - Verificando servidor..."
    
    if curl -s --max-time 10 http://146.59.227.248:4000/health > /dev/null; then
        echo "✅ Servidor WhatsApp Multi-Cliente iniciado com sucesso!"
        echo ""
        echo "📊 Informações do servidor:"
        if [ -n "$SERVER_PID" ]; then
            echo "  🆔 PID: $SERVER_PID"
        fi
        echo "  🌐 Porta: 4000"
        echo "  📍 IP de produção: 146.59.227.248"
        echo ""
        echo "🌐 URLs de acesso:"
        echo "  • Health Check: http://146.59.227.248:4000/health"
        echo "  • API Swagger: http://146.59.227.248:4000/api-docs"
        echo "  • Frontend Admin: http://146.59.227.248:8080/admin/instances"
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
        curl -s http://146.59.227.248:4000/health | jq . 2>/dev/null || curl -s http://146.59.227.248:4000/health
        
        exit 0
    fi
    
    echo "⏳ Servidor ainda não está respondendo, aguardando..."
    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ Falha ao iniciar servidor após $MAX_ATTEMPTS tentativas"
echo "📝 Últimas linhas do log:"
tail -50 logs/whatsapp-multi-client.log 2>/dev/null || echo "Log não encontrado"
echo ""
echo "🔍 Status do processo:"
if [ -n "$SERVER_PID" ]; then
    ps aux | grep $SERVER_PID | grep -v grep || echo "Processo não encontrado"
fi
echo ""
echo "💡 Dicas de troubleshooting:"
echo "1. Verifique se a porta 4000 não está sendo usada: lsof -i :4000"
echo "2. Verifique os logs: cat logs/whatsapp-multi-client.log"
echo "3. Verifique memória disponível: free -h"
echo "4. Verifique espaço em disco: df -h"
exit 1
