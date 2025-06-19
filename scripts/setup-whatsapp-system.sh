
#!/bin/bash

# Script de setup completo do sistema WhatsApp Multi-Cliente
# Arquivo: scripts/setup-whatsapp-system.sh

echo "🚀 Setup Sistema WhatsApp Multi-Cliente"
echo "======================================"

# Verificar sistema operacional
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "✅ Sistema: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✅ Sistema: macOS"
else
    echo "⚠️ Sistema não testado. Continuando..."
fi

# Verificar Node.js
echo "🔍 Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js encontrado: $NODE_VERSION"
    
    # Verificar versão mínima
    REQUIRED_VERSION="v18.0.0"
    if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]]; then
        echo "✅ Versão do Node.js é adequada"
    else
        echo "⚠️ Node.js versão $REQUIRED_VERSION ou superior recomendada"
    fi
else
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi

# Verificar npm
echo "🔍 Verificando npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm encontrado: $NPM_VERSION"
else
    echo "❌ npm não encontrado."
    exit 1
fi

# Criar estrutura de diretórios
echo "📁 Criando estrutura de diretórios..."
mkdir -p server
mkdir -p logs
mkdir -p scripts
mkdir -p whatsapp-sessions

# Ir para diretório server
cd server

# Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
if [ -f "package.json" ]; then
    npm install
else
    echo "❌ package.json não encontrado no diretório server/"
    exit 1
fi

# Voltar para diretório raiz
cd ..

# Instalar dependências do frontend (se necessário)
echo "📦 Verificando dependências do frontend..."
if [ -f "package.json" ]; then
    npm install
    echo "✅ Dependências do frontend instaladas"
fi

# Configurar permissões dos scripts
echo "🔧 Configurando permissões dos scripts..."
chmod +x scripts/*.sh

# Verificar portas
echo "🔍 Verificando portas..."
PORTS=(3000 4000 4001 5173)
for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️ Porta $port está em uso"
    else
        echo "✅ Porta $port está livre"
    fi
done

# Criar arquivo de configuração
echo "⚙️ Criando arquivo de configuração..."
cat > config.env << EOL
# Configuração do Sistema WhatsApp Multi-Cliente
WHATSAPP_PORT=4000
SWAGGER_PORT=4001
FRONTEND_PORT=5173
LOG_LEVEL=info
SESSION_PATH=./whatsapp-sessions
EOL

echo "✅ Arquivo config.env criado"

# Teste de conectividade
echo "🔗 Testando dependências..."
node -e "
try {
  require('express');
  require('socket.io');
  require('whatsapp-web.js');
  console.log('✅ Todas as dependências estão disponíveis');
} catch(e) {
  console.log('❌ Erro nas dependências:', e.message);
  process.exit(1);
}
"

echo ""
echo "🎉 Setup concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Execute: ./scripts/start-whatsapp-server.sh"
echo "2. Acesse: http://localhost:4000/api-docs"
echo "3. Teste: http://localhost:4000/health"
echo ""
echo "📝 Comandos úteis:"
echo "• Iniciar: ./scripts/start-whatsapp-server.sh"
echo "• Parar: ./scripts/stop-whatsapp-server.sh"
echo "• Reiniciar: ./scripts/restart-whatsapp-server.sh"
echo "• Logs: tail -f logs/whatsapp-server.log"
echo ""
echo "🔌 Portas utilizadas:"
echo "• Backend WhatsApp: 4000"
echo "• Swagger API: 4000/api-docs"
echo "• Frontend: 5173 (se aplicável)"
