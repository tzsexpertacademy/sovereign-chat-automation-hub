#!/bin/bash

# Script para corrigir permissões e dependências completamente
# Execute da pasta raiz: sudo ./scripts/fix-permissions-complete.sh

echo "🔧 CORREÇÃO COMPLETA DE PERMISSÕES E DEPENDÊNCIAS"
echo "================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-permissions-complete.sh"
    exit 1
fi

echo "📂 1. Voltando para raiz do projeto..."
cd /home/ubuntu/sovereign-chat-automation-hub

echo "🛑 2. Parando servidor se estiver rodando..."
./scripts/production-stop-whatsapp.sh || true

echo "🧹 3. Limpando dependências antigas..."
rm -rf server/node_modules server/package-lock.json
rm -rf node_modules package-lock.json

echo "🔐 4. Corrigindo permissões recursivamente..."
chown -R ubuntu:ubuntu ./
chmod -R 755 ./
chmod +x scripts/*.sh

echo "📦 5. Limpando cache npm..."
npm cache clean --force

echo "📦 6. Reinstalando dependências do servidor como root..."
cd server
npm install --unsafe-perm=true --allow-root

if [ $? -ne 0 ]; then
    echo "❌ Erro durante instalação de dependências do servidor"
    echo "🔄 Tentando forçar instalação..."
    npm install --force --unsafe-perm=true --allow-root
    
    if [ $? -ne 0 ]; then
        echo "❌ Falha crítica na instalação"
        exit 1
    fi
fi

echo "✅ Dependências do servidor instaladas com sucesso!"

echo "📦 7. Verificando se dotenv está instalado..."
if ! npm list dotenv > /dev/null 2>&1; then
    echo "📦 Instalando dotenv especificamente..."
    npm install dotenv --unsafe-perm=true --allow-root
fi

echo "📦 8. Reinstalando dependências do frontend..."
cd ..
npm install --unsafe-perm=true --allow-root || npm install --force --unsafe-perm=true --allow-root

echo "🔐 9. Ajustando permissões finais..."
chown -R ubuntu:ubuntu ./
chmod -R 755 ./

echo "✅ CORREÇÃO COMPLETA CONCLUÍDA!"
echo "==============================="
echo ""
echo "🚀 Agora inicie o servidor:"
echo "   sudo -u ubuntu ./scripts/production-start-whatsapp.sh"
echo ""
echo "📋 Status das dependências críticas:"
echo "   dotenv: $(cd server && npm list dotenv 2>/dev/null | grep dotenv || echo 'NÃO INSTALADO')"
echo "   express: $(cd server && npm list express 2>/dev/null | grep express || echo 'NÃO INSTALADO')"
echo "   socket.io: $(cd server && npm list socket.io 2>/dev/null | grep socket.io || echo 'NÃO INSTALADO')"