
#!/bin/bash

# Script para instalar dependências do WhatsApp Multi-Cliente
# Arquivo: scripts/install-dependencies.sh

echo "📦 Instalando dependências do WhatsApp Multi-Cliente..."

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ package.json não encontrado. Execute do diretório raiz."
    exit 1
fi

# Instalar dependências do servidor
echo "🔧 Instalando dependências do servidor..."
cd server
if [ ! -f "package.json" ]; then
    echo "❌ package.json do servidor não encontrado!"
    exit 1
fi

npm install

# Voltar para diretório raiz
cd ..

# Instalar socket.io-client no frontend se necessário
echo "🔧 Verificando socket.io-client..."
if ! npm list socket.io-client > /dev/null 2>&1; then
    echo "📦 Instalando socket.io-client..."
    npm install socket.io-client@^4.8.1
fi

echo "✅ Dependências instaladas com sucesso!"
