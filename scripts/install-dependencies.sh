
#!/bin/bash

# Script para instalar dependências do WhatsApp Multi-Cliente
# Arquivo: scripts/install-dependencies.sh

echo "📦 INSTALANDO DEPENDÊNCIAS WHATSAPP MULTI-CLIENTE"
echo "================================================"

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js primeiro."
    echo "💡 sudo apt update && sudo apt install nodejs npm"
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Instale o npm primeiro."
    exit 1
fi

echo "✅ Node.js versão: $(node -v)"
echo "✅ npm versão: $(npm -v)"

# Criar diretório server se não existir
if [ ! -d "server" ]; then
    echo "📁 Criando diretório server/"
    mkdir -p server
fi

# Verificar se package.json do servidor existe
if [ ! -f "server/package.json" ]; then
    echo "📄 Criando package.json do servidor..."
    cd server
    cat > package.json << 'EOF'
{
  "name": "whatsapp-multi-client-server",
  "version": "1.0.0",
  "description": "Servidor WhatsApp Multi-Cliente para gerenciamento de múltiplas instâncias",
  "main": "whatsapp-multi-client-server.js",
  "scripts": {
    "start": "node whatsapp-multi-client-server.js",
    "dev": "nodemon whatsapp-multi-client-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.5",
    "cors": "^2.8.5",
    "whatsapp-web.js": "^1.23.1",
    "qrcode": "^1.5.3",
    "swagger-ui-express": "^5.0.0",
    "swagger-jsdoc": "^6.2.8"
  },
  "keywords": ["whatsapp", "multi-client", "api", "websocket"],
  "author": "Sistema WhatsApp Multi-Cliente",
  "license": "MIT"
}
EOF
    cd ..
fi

# Instalar dependências do servidor
echo "📦 Instalando dependências do servidor..."
cd server
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependências do servidor instaladas com sucesso"
else
    echo "❌ Erro ao instalar dependências do servidor"
    exit 1
fi

cd ..

# Instalar dependências do frontend se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências do frontend..."
    npm install
    
    if [ $? -eq 0 ]; then
        echo "✅ Dependências do frontend instaladas com sucesso"
    else
        echo "❌ Erro ao instalar dependências do frontend"
        exit 1
    fi
fi

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
mkdir -p logs
mkdir -p whatsapp-sessions

# Tornar scripts executáveis
echo "🔧 Configurando permissões dos scripts..."
chmod +x scripts/*.sh

echo ""
echo "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "======================================"
echo ""
echo "🚀 Próximos passos:"
echo "1. Inicie o servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Verifique o status: ./scripts/check-whatsapp-health.sh"
echo "3. Acesse o admin: http://seu-ip:5173/admin/instances"
echo ""
echo "📝 Arquivos importantes:"
echo "• Logs: logs/whatsapp-multi-client.log"
echo "• Sessões: whatsapp-sessions/"
echo "• Servidor: server/whatsapp-multi-client-server.js"
