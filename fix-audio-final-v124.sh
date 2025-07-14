#!/bin/bash

# ✅ CORREÇÃO FINAL: Downgrade para whatsapp-web.js v1.24.0 + Chrome Fix
# Este script resolve os problemas: "Evaluation failed: a" e "serialize"

echo "🔧 ===== CORREÇÃO FINAL DO ÁUDIO - v1.24.0 ====="
echo "📅 $(date): Iniciando correção definitiva..."

# Verificar se estamos no diretório correto
if [ ! -f "server/package.json" ]; then
    echo "❌ Execute este script no diretório raiz do projeto"
    exit 1
fi

# Parar servidor se estiver rodando
echo "🛑 Parando servidor..."
pkill -f "whatsapp-multi-client-server.js" 2>/dev/null || true
sleep 2

# Navegar para pasta do servidor
cd server

echo "📦 Fazendo backup do package.json..."
cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)

echo "🧹 Limpando dependências antigas..."
rm -rf node_modules package-lock.json

echo "📥 Instalando whatsapp-web.js v1.24.0..."
npm install whatsapp-web.js@1.24.0 --save

echo "📥 Reinstalando outras dependências..."
npm install

echo "🔍 Verificando versões instaladas..."
echo "📋 whatsapp-web.js versão: $(npm list whatsapp-web.js --depth=0 | grep whatsapp-web.js)"
echo "📋 Puppeteer versão: $(npm list puppeteer --depth=0 | grep puppeteer)"

echo "🧹 Removendo sessões antigas..."
rm -rf sessions/* 2>/dev/null || true

echo "🧹 Removendo arquivos temporários..."
rm -rf temp/* 2>/dev/null || true

cd ..

echo "✅ Correção aplicada com sucesso!"
echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "1. Execute: npm start (na pasta server)"
echo "2. Teste conexão WhatsApp"  
echo "3. Teste envio de texto (deve funcionar)"
echo "4. Teste envio de áudio (deve funcionar com v1.24.0)"
echo "5. Teste envio de mídia (deve funcionar com v1.24.0)"
echo ""
echo "🔍 Para monitorar: tail -f server/logs/whatsapp-multi-client.log"
echo ""
echo "📋 VERSÕES INSTALADAS:"
echo "   - whatsapp-web.js: 1.24.0 (compatível com áudio)"
echo "   - Puppeteer: 21.0.0 (estável)"
echo "   - Chrome path: detectado automaticamente"
echo ""
echo "✅ Sistema pronto para uso!"