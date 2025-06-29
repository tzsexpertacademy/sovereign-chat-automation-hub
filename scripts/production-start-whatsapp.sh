
#!/bin/bash

# Script de produção para WhatsApp Multi-Cliente
# Execute da pasta raiz: ./scripts/production-start-whatsapp.sh

echo "🚀 INICIANDO WHATSAPP MULTI-CLIENTE - PRODUÇÃO"
echo "=============================================="

# Verificar se Node.js está disponível (detecção melhorada)
NODE_CMD=""
if command -v node >/dev/null 2>&1; then
    NODE_CMD="node"
elif command -v nodejs >/dev/null 2>&1; then
    NODE_CMD="nodejs"
elif [ -f "/usr/bin/node" ]; then
    NODE_CMD="/usr/bin/node"
elif [ -f "/usr/bin/nodejs" ]; then
    NODE_CMD="/usr/bin/nodejs"
fi

if [ -z "$NODE_CMD" ]; then
    echo "❌ Node.js não encontrado"
    echo "🔍 Tentando localizar Node.js..."
    which node 2>/dev/null || echo "node não encontrado no PATH"
    which nodejs 2>/dev/null || echo "nodejs não encontrado no PATH"
    ls -la /usr/bin/node* 2>/dev/null || echo "Nenhum executável node* em /usr/bin"
    exit 1
fi

NODE_VERSION=$($NODE_CMD --version 2>/dev/null)
echo "✅ Node.js encontrado: $NODE_VERSION ($NODE_CMD)"

# Verificar se estamos no diretório correto (raiz do projeto)
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script da pasta raiz do projeto"
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
    $NODE_CMD $(which npm || echo "/usr/bin/npm") install --production
    cd ..
fi

# Verificar se arquivo do servidor existe
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Arquivo do servidor não encontrado: server/whatsapp-multi-client-server.js"
    exit 1
fi

# Configurar variáveis de ambiente para produção
export NODE_ENV=production
export WHATSAPP_PORT=4000
export SESSIONS_PATH=./whatsapp-sessions
export LOGS_PATH=./logs
export PUPPETEER_HEADLESS=true
export PUPPETEER_NO_SANDBOX=true
export NODE_OPTIONS="--max-old-space-size=2048"

# Iniciar servidor em background
echo "🚀 Iniciando servidor WhatsApp Multi-Cliente na porta 4000..."
echo "📅 Data/Hora: $(date)"

# Verificar se PM2 está disponível
if command -v pm2 >/dev/null 2>&1; then
    echo "🔧 Usando PM2 para gerenciar o processo..."
    pm2 delete whatsapp-multi-client 2>/dev/null || true
    pm2 start server/whatsapp-multi-client-server.js --name "whatsapp-multi-client" \
        --log logs/whatsapp-multi-client.log \
        --error logs/whatsapp-error.log \
        --max-memory-restart 1G \
        --restart-delay 5000 \
        --time \
        --interpreter $NODE_CMD
    pm2 save
    sleep 5
    SERVER_PID=$(pm2 jlist | jq -r '.[] | select(.name=="whatsapp-multi-client") | .pid' 2>/dev/null || echo "")
else
    echo "🔧 Usando nohup para gerenciar o processo..."
    cd server
    nohup $NODE_CMD whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
    SERVER_PID=$!
    cd ..
    sleep 3
fi

# Salvar PID se disponível
if [ -n "$SERVER_PID" ]; then
    echo $SERVER_PID > logs/whatsapp-server.pid
fi

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
        echo "  🔧 Node.js: $NODE_VERSION"
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
echo "5. Node.js usado: $NODE_CMD ($NODE_VERSION)"
exit 1
