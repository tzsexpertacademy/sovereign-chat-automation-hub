#!/bin/bash

# Script de backup e correção definitiva do Puppeteer
# Arquivo: scripts/backup-and-fix-puppeteer.sh

echo "🔥 ===== CORREÇÃO DEFINITIVA DO PUPPETEER ====="
echo "================================================"

# Verificar se está no diretório correto
if [ ! -f "server/package.json" ]; then
    echo "❌ Execute este script na raiz do projeto!"
    exit 1
fi

# FASE 1: BACKUP TOTAL
echo ""
echo "📦 FASE 1: BACKUP COMPLETO DO NODE_MODULES"
echo "==========================================="

BACKUP_DIR="server/node_modules.backup.$(date +%Y%m%d_%H%M%S)"

if [ -d "server/node_modules" ]; then
    echo "🔄 Fazendo backup para: $BACKUP_DIR"
    cp -r server/node_modules "$BACKUP_DIR"
    echo "✅ Backup criado com sucesso: $BACKUP_DIR"
else
    echo "⚠️ Diretório node_modules não encontrado"
fi

# FASE 2: VERIFICAÇÃO DO SISTEMA ATUAL
echo ""
echo "🔍 FASE 2: VERIFICAÇÃO DO SISTEMA ATUAL"
echo "======================================"

echo "🌐 Chrome no sistema:"
which google-chrome || echo "❌ google-chrome não encontrado"
which chromium-browser || echo "❌ chromium-browser não encontrado"

echo ""
echo "📦 Puppeteer atual:"
cd server
npm list puppeteer 2>/dev/null || echo "❌ puppeteer não listado"
npm list puppeteer-core 2>/dev/null || echo "❌ puppeteer-core não listado"
npm list whatsapp-web.js 2>/dev/null || echo "❌ whatsapp-web.js não listado"
cd ..

# FASE 3: DETECTAR CHROME DISPONÍVEL
echo ""
echo "🎯 FASE 3: DETECTANDO CHROME DISPONÍVEL"
echo "======================================"

CHROME_PATH=""

# Tentar encontrar Chrome/Chromium
if command -v google-chrome >/dev/null 2>&1; then
    CHROME_PATH=$(which google-chrome)
    echo "✅ Google Chrome encontrado: $CHROME_PATH"
elif command -v chromium-browser >/dev/null 2>&1; then
    CHROME_PATH=$(which chromium-browser)
    echo "✅ Chromium encontrado: $CHROME_PATH"
elif command -v chromium >/dev/null 2>&1; then
    CHROME_PATH=$(which chromium)
    echo "✅ Chromium encontrado: $CHROME_PATH"
else
    echo "❌ ERRO: Nenhum Chrome/Chromium encontrado no sistema!"
    echo "💡 SOLUÇÃO: Instalar Google Chrome:"
    echo "   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -"
    echo "   echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/google-chrome.list"
    echo "   apt update && apt install -y google-chrome-stable"
    exit 1
fi

echo "🎯 Chrome a ser usado: $CHROME_PATH"

# FASE 4: APLICAR CORREÇÃO NO CÓDIGO
echo ""
echo "🔧 FASE 4: APLICANDO CORREÇÃO NO CÓDIGO"
echo "====================================="

echo "📝 Modificando server/modules/whatsapp-client.js..."

# Backup do arquivo original
cp server/modules/whatsapp-client.js server/modules/whatsapp-client.js.backup

echo "✅ Backup do arquivo original criado"
echo "🔄 Aplicando correção do executablePath..."

# A correção será feita pelo script principal
echo "📋 Configuração que será aplicada:"
echo "   executablePath: '$CHROME_PATH'"
echo "   headless: true"
echo "   timeout: 120000"

echo ""
echo "✅ BACKUP E PREPARAÇÃO CONCLUÍDOS!"
echo "================================="
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. ✅ Backup criado em: $BACKUP_DIR"
echo "2. ✅ Chrome detectado em: $CHROME_PATH"
echo "3. 🔄 Aplicando correção no código..."
echo ""
echo "🚨 ROLLBACK DISPONÍVEL:"
echo "   Se algo der errado: mv $BACKUP_DIR server/node_modules"
echo ""