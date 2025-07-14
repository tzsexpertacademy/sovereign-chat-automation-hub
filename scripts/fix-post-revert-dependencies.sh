#!/bin/bash

# Script para corrigir dependências após revert
# Execute da pasta raiz: ./scripts/fix-post-revert-dependencies.sh

echo "🔄 CORREÇÃO PÓS-REVERT - DEPENDÊNCIAS"
echo "====================================="

# Verificar se estamos na pasta raiz
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script da pasta raiz do projeto"
    exit 1
fi

# Parar servidor se estiver rodando
echo "🛑 Parando servidor WhatsApp..."
pkill -f "whatsapp-multi-client-server.js" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true

# Etapa 1: Limpar tudo
echo ""
echo "🧹 LIMPEZA COMPLETA..."
echo "====================="

# Limpar frontend
echo "🧹 Limpando frontend..."
rm -rf node_modules package-lock.json

# Limpar servidor
echo "🧹 Limpando servidor..."
cd server
rm -rf node_modules package-lock.json sessions/* temp/* .wwebjs_auth/* .wwebjs_cache/*
cd ..

# Limpar cache npm
echo "🧹 Limpando cache npm..."
npm cache clean --force

# Etapa 2: Corrigir conflito date-fns
echo ""
echo "📅 CORRIGINDO CONFLITO DATE-FNS..."
echo "================================="

# Downgrade date-fns para versão compatível
echo "📅 Instalando date-fns@3.6.0 (compatível com react-day-picker)..."
npm install date-fns@3.6.0 --save

# Etapa 3: Instalar dependências frontend
echo ""
echo "🎨 INSTALANDO FRONTEND..."
echo "========================"

echo "📦 Instalando dependências do frontend com --legacy-peer-deps..."
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo "⚠️ Tentando com --force..."
    npm install --force
fi

# Etapa 4: Configurar servidor
echo ""
echo "🔧 CONFIGURANDO SERVIDOR..."
echo "=========================="

cd server

# Instalar dependências base primeiro
echo "📦 Instalando dependências base do servidor..."
npm install express cors socket.io dotenv qrcode swagger-ui-express swagger-jsdoc uuid express-fileupload multer mime-types

# Instalar whatsapp-web.js e puppeteer com versões estáveis
echo "📱 Instalando whatsapp-web.js@1.23.0 (versão estável)..."
npm install whatsapp-web.js@1.23.0

echo "🤖 Instalando puppeteer@20.9.0 (compatível)..."
npm install puppeteer@20.9.0

# Verificar se instalação foi bem sucedida
if [ $? -eq 0 ]; then
    echo "✅ Dependências do servidor instaladas com sucesso"
else
    echo "❌ Erro na instalação do servidor"
    cd ..
    exit 1
fi

cd ..

# Etapa 5: Criar diretórios necessários
echo ""
echo "📁 CRIANDO ESTRUTURA..."
echo "======================"

mkdir -p logs temp server/sessions server/temp

# Etapa 6: Verificar instalação
echo ""
echo "🔍 VERIFICANDO INSTALAÇÃO..."
echo "============================"

echo "📊 Versões instaladas:"
echo "   Node.js: $(node -v)"
echo "   NPM: $(npm -v)"

cd server
echo "   whatsapp-web.js: $(npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js || echo 'não encontrado')"
echo "   puppeteer: $(npm list puppeteer --depth=0 2>/dev/null | grep puppeteer || echo 'não encontrado')"
cd ..

echo "   date-fns: $(npm list date-fns --depth=0 2>/dev/null | grep date-fns || echo 'não encontrado')"

# Etapa 7: Testar servidor
echo ""
echo "🚀 TESTANDO SERVIDOR..."
echo "======================"

cd server
timeout 10s node -e "
const express = require('express');
const app = express();
console.log('✅ Express OK');
const { Client } = require('whatsapp-web.js');
console.log('✅ WhatsApp-web.js OK');
const puppeteer = require('puppeteer');
console.log('✅ Puppeteer OK');
console.log('🎉 Todas as dependências carregaram com sucesso!');
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Teste de dependências passou!"
else
    echo "⚠️ Algumas dependências podem ter problemas"
fi

cd ..

echo ""
echo "🎉 CORREÇÃO CONCLUÍDA!"
echo "====================="
echo ""
echo "🚀 Para iniciar o sistema:"
echo "1. ./scripts/production-start-whatsapp.sh"
echo ""
echo "🔍 Para monitorar:"
echo "2. tail -f logs/whatsapp-multi-client.log"
echo ""
echo "📊 Para verificar saúde:"
echo "3. curl http://localhost:4000/health"