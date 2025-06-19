
#!/bin/bash

# Script para iniciar servidor WhatsApp Multi-Cliente
# Arquivo: scripts/start-whatsapp-server.sh

echo "🚀 Iniciando Servidor WhatsApp Multi-Cliente..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js primeiro."
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Instale o npm primeiro."
    exit 1
fi

# Ir para o diretório do servidor
cd "$(dirname "$0")/../server" || exit 1

# Verificar se package.json existe
if [ ! -f "package.json" ]; then
    echo "❌ package.json não encontrado no diretório server/"
    exit 1
fi

# Instalar dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Verificar se a porta 4000 está livre
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️ Porta 4000 já está em uso. Parando processo..."
    pkill -f "whatsapp-multi-client-server.js"
    sleep 2
fi

# Criar diretório de logs se não existir
mkdir -p ../logs

# Iniciar o servidor
echo "🚀 Iniciando servidor na porta 4000..."
nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-server.log 2>&1 &

# Guardar PID
echo $! > ../logs/whatsapp-server.pid

sleep 3

# Verificar se o servidor está rodando
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor WhatsApp iniciado com sucesso!"
    echo "📚 Swagger API: http://localhost:4000/api-docs"
    echo "❤️ Health Check: http://localhost:4000/health"
    echo "📝 Logs: tail -f logs/whatsapp-server.log"
else
    echo "❌ Falha ao iniciar o servidor. Verifique os logs:"
    echo "📝 cat logs/whatsapp-server.log"
    exit 1
fi
