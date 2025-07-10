#!/bin/bash

# Script para correção completa do Puppeteer
# Arquivo: scripts/fix-puppeteer-complete.sh

echo "🔧 CORREÇÃO COMPLETA DO PUPPETEER"
echo "================================="

echo ""
echo "🔍 PROBLEMA IDENTIFICADO: Puppeteer não está instalado"
echo "📋 Erro: Cannot find module 'puppeteer-core'"
echo ""

cd server

echo "🧹 LIMPANDO CACHE DO NPM"
echo "========================"
npm cache clean --force

echo ""
echo "📦 INSTALANDO DEPENDÊNCIAS DO PUPPETEER"
echo "======================================="

# Instalar puppeteer-core e puppeteer
echo "1️⃣ Instalando puppeteer-core..."
npm install puppeteer-core

echo "2️⃣ Instalando puppeteer completo..."
npm install puppeteer

echo "3️⃣ Verificando dependências..."
npm ls | grep puppeteer

echo ""
echo "🔧 INSTALANDO DEPENDÊNCIAS ADICIONAIS"
echo "====================================="

# Instalar dependências relacionadas ao Chrome/Chromium
echo "4️⃣ Instalando whatsapp-web.js..."
npm install whatsapp-web.js

echo "5️⃣ Atualizando outras dependências..."
npm install qrcode-terminal

echo ""
echo "🛡️ VERIFICAÇÃO FINAL"
echo "===================="

echo "📋 Puppeteer-core:"
node -e "console.log(require('puppeteer-core'))" 2>/dev/null && echo "✅ Instalado" || echo "❌ Falta"

echo "📋 Puppeteer:"
node -e "console.log(require('puppeteer'))" 2>/dev/null && echo "✅ Instalado" || echo "❌ Falta"

echo "📋 WhatsApp-web.js:"
node -e "console.log(require('whatsapp-web.js'))" 2>/dev/null && echo "✅ Instalado" || echo "❌ Falta"

echo ""
echo "🚀 REINICIANDO SERVIDOR COM PUPPETEER"
echo "===================================="

cd ..

# Parar servidor atual
echo "🛑 Parando servidor atual..."
./scripts/force-stop-whatsapp.sh

sleep 3

# Iniciar servidor
echo "🚀 Iniciando servidor com Puppeteer..."
./scripts/robust-start-whatsapp.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 PUPPETEER INSTALADO E SERVIDOR INICIADO!"
    echo "=========================================="
    echo ""
    echo "✅ Agora o WhatsApp deve conectar sem erro 500"
    echo "✅ O QR Code deve aparecer quando conectar"
    echo ""
    echo "🧪 TESTE AGORA:"
    echo "1. Acesse: http://146.59.227.248:8080/admin/instances"
    echo "2. Clique em 'Conectar HTTPS' numa instância"
    echo "3. Deve aparecer o QR Code para escanear"
    echo ""
    echo "📱 Escaneie o QR com WhatsApp para conectar"
else
    echo "❌ Falha ao reiniciar servidor"
    echo "💡 Verifique os logs: tail -f logs/whatsapp-multi-client.log"
fi

echo ""
echo "📅 Correção Puppeteer concluída em: $(date)"