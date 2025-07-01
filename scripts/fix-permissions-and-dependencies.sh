#!/bin/bash

# Script para corrigir permissões e dependências
# Arquivo: scripts/fix-permissions-and-dependencies.sh

echo "🔧 CORREÇÃO DE PERMISSÕES E DEPENDÊNCIAS"
echo "======================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-permissions-and-dependencies.sh"
    exit 1
fi

echo "📂 1. Voltando para raiz do projeto..."
cd /home/ubuntu/sovereign-chat-automation-hub

echo "🧹 2. Limpando dependências antigas..."
rm -rf server/node_modules server/package-lock.json

echo "🔐 3. Corrigindo permissões..."
chown -R ubuntu:ubuntu server/
chown -R ubuntu:ubuntu logs/
chown -R ubuntu:ubuntu scripts/

echo "📦 4. Reinstalando dependências como ubuntu..."
cd server
sudo -u ubuntu npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro durante instalação de dependências"
    exit 1
fi

echo "✅ Dependências instaladas com sucesso!"

echo "🚀 5. Iniciando servidor..."
cd ..
sudo -u ubuntu ./scripts/production-start-whatsapp.sh

echo "✅ Script de correção concluído!"