#!/bin/bash

# Script robusto para iniciar WhatsApp Multi-Cliente
# Execute: ./scripts/robust-start-whatsapp.sh

echo "🚀 INÍCIO ROBUSTO - WHATSAPP MULTI-CLIENTE"
echo "========================================"

# Verificar se está no diretório correto
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Execute este script da pasta raiz do projeto"
    exit 1
fi

# Função para verificar se porta está livre
check_port_free() {
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Porta ocupada
    else
        return 0  # Porta livre
    fi
}

# Função para aguardar porta ficar livre
wait_for_port_free() {
    local max_attempts=15
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if check_port_free; then
            echo "✅ Porta 4000 confirmada como livre"
            return 0
        fi
        
        echo "⏳ Tentativa $attempt/$max_attempts - Aguardando porta 4000 ficar livre..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Timeout: Porta 4000 ainda ocupada"
    return 1
}

# 1. Verificar Node.js
echo "🔍 1. Verificando Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

NODE_VERSION=$(node --version 2>/dev/null)
echo "✅ Node.js encontrado: $NODE_VERSION"

# 2. Parar qualquer instância anterior
echo "🛑 2. Garantindo que nenhuma instância anterior está rodando..."
./scripts/force-stop-whatsapp.sh

# 3. Verificar se porta está realmente livre
echo "🔍 3. Verificando se porta 4000 está livre..."
if ! wait_for_port_free; then
    echo "❌ Porta 4000 ainda ocupada. Execute primeiro:"
    echo "   ./scripts/force-stop-whatsapp.sh"
    exit 1
fi

# 4. Verificar dependências críticas
echo "🔍 4. Verificando dependências críticas..."
cd server

if [ ! -d "node_modules" ]; then
    echo "❌ node_modules não encontrado. Execute:"
    echo "   cd server && npm install"
    exit 1
fi

# Verificar dotenv especificamente
if ! npm list dotenv >/dev/null 2>&1; then
    echo "❌ dotenv não encontrado. Instalando..."
    npm install dotenv
fi

# Verificar .env
if [ ! -f ".env" ]; then
    echo "❌ Arquivo .env não encontrado"
    exit 1
fi

echo "✅ Dependências verificadas"

# 5. Criar diretórios necessários
echo "📁 5. Criando diretórios necessários..."
mkdir -p ../logs
mkdir -p sessions
mkdir -p uploads
mkdir -p temp

# 6. Configurar variáveis de ambiente
echo "⚙️ 6. Configurando ambiente..."
export NODE_ENV=production
export WHATSAPP_PORT=4000
export NODE_OPTIONS="--max-old-space-size=2048"

# 7. Iniciar servidor com nohup (sem PM2)
echo "🚀 7. Iniciando servidor WhatsApp Multi-Cliente..."
echo "📅 Data/Hora: $(date)"

# Usar nohup diretamente para evitar problemas com PM2
nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
SERVER_PID=$!

# Salvar PID
echo $SERVER_PID > ../logs/whatsapp-server.pid

echo "🆔 PID do servidor: $SERVER_PID"
echo "⏳ Aguardando inicialização..."

# 8. Verificar se servidor iniciou corretamente
sleep 5

# Verificar se processo ainda está rodando
if ! ps -p $SERVER_PID >/dev/null 2>&1; then
    echo "❌ Processo terminou inesperadamente!"
    echo "📝 Últimas linhas do log:"
    tail -20 ../logs/whatsapp-multi-client.log 2>/dev/null
    exit 1
fi

# 9. Testar conectividade
echo "🧪 8. Testando conectividade..."
MAX_ATTEMPTS=20
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔍 Tentativa $ATTEMPT/$MAX_ATTEMPTS - Testando servidor..."
    
    if curl -s --max-time 10 http://localhost:4000/health >/dev/null; then
        echo "✅ SERVIDOR INICIADO COM SUCESSO!"
        echo ""
        echo "📊 Informações do servidor:"
        echo "  🆔 PID: $SERVER_PID"
        echo "  🌐 Porta: 4000"
        echo "  📍 IP: 146.59.227.248"
        echo "  🔧 Node.js: $NODE_VERSION"
        echo ""
        echo "🌐 URLs de acesso:"
        echo "  • Health: http://146.59.227.248:4000/health"
        echo "  • Swagger: http://146.59.227.248:4000/api-docs"
        echo "  • Frontend: http://146.59.227.248:8080/admin/instances"
        echo ""
        echo "📝 Logs em tempo real:"
        echo "  tail -f logs/whatsapp-multi-client.log"
        echo ""
        echo "🛑 Para parar:"
        echo "  ./scripts/force-stop-whatsapp.sh"
        
        # Mostrar status de saúde
        echo ""
        echo "📊 Status atual:"
        curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health
        
        cd ..
        exit 0
    fi
    
    # Verificar se processo ainda está rodando
    if ! ps -p $SERVER_PID >/dev/null 2>&1; then
        echo "❌ Processo terminou durante a inicialização!"
        echo "📝 Últimas linhas do log:"
        tail -20 ../logs/whatsapp-multi-client.log 2>/dev/null
        cd ..
        exit 1
    fi
    
    echo "⏳ Servidor ainda inicializando..."
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ FALHA: Servidor não respondeu após $MAX_ATTEMPTS tentativas"
echo "📝 Últimas linhas do log:"
tail -30 ../logs/whatsapp-multi-client.log 2>/dev/null

echo ""
echo "🔍 Status do processo:"
ps -p $SERVER_PID -o pid,command --no-headers 2>/dev/null || echo "Processo não encontrado"

echo ""
echo "💡 Possíveis causas:"
echo "1. Erro na inicialização - verifique logs acima"
echo "2. Porta 4000 bloqueada por firewall"
echo "3. Dependências faltando"
echo "4. Configuração .env incorreta"

cd ..
exit 1