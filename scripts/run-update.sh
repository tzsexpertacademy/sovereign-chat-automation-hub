
#!/bin/bash

# Script para executar a atualização completa das versões
# Arquivo: scripts/run-update.sh

echo "🚀 INICIANDO ATUALIZAÇÃO COMPLETA DAS VERSÕES"
echo "=============================================="
echo "📦 WhatsApp Web.js: 1.21.0 → 1.25.0"
echo "🤖 Puppeteer: → 23.8.0"
echo "📡 Socket.io: 4.7.4 → 4.8.1"
echo "🌐 Express: 4.18.2 → 4.21.2"
echo "🎯 Chrome: → Versão mais recente"
echo ""

cd /home/ubuntu/sovereign-chat-automation-hub

# Dar permissões corretas
chmod +x scripts/*.sh

# Executar atualização como root para ter privilégios completos
echo "🔧 Executando atualização com privilégios administrativos..."
sudo ./scripts/update-to-latest-versions.sh

echo ""
echo "✅ Script de atualização concluído!"
echo "📋 Verifique os logs acima para confirmar o sucesso da operação."
