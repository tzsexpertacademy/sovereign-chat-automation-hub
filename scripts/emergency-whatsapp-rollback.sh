#!/bin/bash

# Script de Rollback de Emergência para WhatsApp-Web.js
# Arquivo: scripts/emergency-whatsapp-rollback.sh

echo "🚨 ===== ROLLBACK DE EMERGÊNCIA WHATSAPP-WEB.JS ====="
echo "📅 $(date): Iniciando rollback para versão estável..."

# Ir para diretório do servidor
cd "$(dirname "$0")/../server" || exit 1

# Parar servidor
echo "🛑 Parando servidor..."
../scripts/production-stop-whatsapp.sh

# Backup do package.json atual
echo "📦 Fazendo backup..."
cp package.json package.json.backup-$(date +%Y%m%d_%H%M%S)

# Remover node_modules problemático
echo "🧹 Removendo node_modules problemático..."
rm -rf node_modules
rm -f package-lock.json

# Instalar versão estável anterior
echo "📥 Instalando whatsapp-web.js versão estável (1.23.0)..."
npm install whatsapp-web.js@1.23.0 --save

# Reinstalar outras dependências
echo "📥 Reinstalando outras dependências..."
npm install

# Verificar versões
echo "🔍 Verificando versões instaladas..."
echo "📋 whatsapp-web.js versão: $(npm list whatsapp-web.js --depth=0)"

# Limpar sessões antigas
echo "🧹 Limpando sessões antigas..."
rm -rf sessions/*
rm -rf .wwebjs_auth/*
rm -rf .wwebjs_cache/*

# Limpar arquivos temporários do Chrome
echo "🧹 Limpando arquivos temporários..."
rm -rf /tmp/.com.google.Chrome.*
rm -rf /tmp/puppeteer_dev_chrome_profile-*

echo "✅ Rollback concluído!"
echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "1. Execute: npm start (na pasta server)"
echo "2. Teste conexão WhatsApp"
echo "3. Se funcionar, mantenha esta versão"
echo "4. Se não funcionar, tente whatsapp-web.js@1.22.1"
echo ""
echo "🔍 Para monitorar: tail -f server/logs/whatsapp-multi-client.log"
echo ""
echo "📋 VERSÃO INSTALADA:"
echo "   - whatsapp-web.js: 1.23.0 (estável)"
echo ""
echo "✅ Sistema pronto para teste!"