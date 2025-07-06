#!/bin/bash

# Script para correção DEFINITIVA do whatsapp-web.js
# Arquivo: scripts/fix-whatsapp-webjs-definitive.sh

echo "🔧 CORREÇÃO DEFINITIVA DO WHATSAPP-WEB.JS"
echo "=========================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-whatsapp-webjs-definitive.sh"
    exit 1
fi

echo "🛑 1. Parando servidor..."
./scripts/production-stop-whatsapp.sh

echo ""
echo "🧹 2. Limpando cache e dependências problemáticas..."

cd /home/ubuntu/sovereign-chat-automation-hub/server

# Limpar node_modules e cache
echo "🗑️ Removendo node_modules..."
rm -rf node_modules
rm -rf package-lock.json

# Limpar cache npm
echo "🧹 Limpando cache npm..."
npm cache clean --force

echo ""
echo "📦 3. Reinstalando dependências com versões estáveis..."

# Instalar versão específica estável do whatsapp-web.js
echo "📥 Instalando whatsapp-web.js versão estável..."
npm install whatsapp-web.js@1.21.0 --save

# Instalar puppeteer compatível
echo "📥 Instalando puppeteer compatível..."
npm install puppeteer@19.11.1 --save

# Reinstalar outras dependências
echo "📥 Reinstalando outras dependências..."
npm install

echo ""
echo "🔧 4. Corrigindo configuração do Chrome..."

# Instalar Chrome estável se necessário
if ! command -v google-chrome &> /dev/null; then
    echo "📥 Instalando Google Chrome..."
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update
    apt-get install -y google-chrome-stable
fi

# Verificar versão do Chrome
CHROME_VERSION=$(google-chrome --version 2>/dev/null || echo "Chrome não encontrado")
echo "🌐 Chrome: $CHROME_VERSION"

echo ""
echo "🧹 5. Limpando processos Chrome órfãos..."

# Matar todos os processos Chrome
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true

# Limpar diretórios temporários
rm -rf /tmp/.org.chromium.Chromium.* 2>/dev/null || true
rm -rf /home/ubuntu/.config/google-chrome/SingletonLock 2>/dev/null || true

echo ""
echo "📂 6. Criando diretórios necessários..."

# Criar diretórios de sessão se não existir
mkdir -p /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_auth
mkdir -p /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_cache
mkdir -p /home/ubuntu/sovereign-chat-automation-hub/logs

# Definir permissões corretas
chown -R ubuntu:ubuntu /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_auth
chown -R ubuntu:ubuntu /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_cache
chown -R ubuntu:ubuntu /home/ubuntu/sovereign-chat-automation-hub/logs

echo ""
echo "🚀 7. Testando instalação..."

cd /home/ubuntu/sovereign-chat-automation-hub/server

# Verificar se whatsapp-web.js foi instalado corretamente
if [ -d "node_modules/whatsapp-web.js" ]; then
    echo "✅ whatsapp-web.js instalado corretamente"
    WWEB_VERSION=$(node -e "console.log(require('./node_modules/whatsapp-web.js/package.json').version)")
    echo "📋 Versão: $WWEB_VERSION"
else
    echo "❌ Erro na instalação do whatsapp-web.js"
    exit 1
fi

# Verificar puppeteer
if [ -d "node_modules/puppeteer" ]; then
    echo "✅ Puppeteer instalado corretamente"
    PUPPETEER_VERSION=$(node -e "console.log(require('./node_modules/puppeteer/package.json').version)")
    echo "📋 Versão: $PUPPETEER_VERSION"
else
    echo "❌ Erro na instalação do Puppeteer"
    exit 1
fi

echo ""
echo "🚀 8. Iniciando servidor com configuração corrigida..."

./scripts/production-start-whatsapp.sh

echo ""
echo "⏳ 9. Aguardando estabilização..."
sleep 10

echo ""
echo "🧪 10. TESTE FINAL"
echo "=================="

# Testar health check
echo "🔍 Testando health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health 2>/dev/null)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check OK ($HEALTH_STATUS)"
else
    echo "❌ Health check falhou ($HEALTH_STATUS)"
fi

# Verificar logs por erros
echo "🔍 Verificando logs por erros críticos..."
CRITICAL_ERRORS=$(pm2 logs whatsapp-multi-client --lines 20 --nostream 2>/dev/null | grep -E "(Cannot read properties of null|Session closed|Protocol error)" | wc -l)

if [ "$CRITICAL_ERRORS" -eq 0 ]; then
    echo "✅ Nenhum erro crítico encontrado nos logs recentes"
else
    echo "⚠️ $CRITICAL_ERRORS erros críticos ainda presentes"
fi

echo ""
echo "🎯 RESULTADO FINAL"
echo "=================="

if [ "$HEALTH_STATUS" = "200" ] && [ "$CRITICAL_ERRORS" -eq 0 ]; then
    echo "🎉 CORREÇÃO BEM-SUCEDIDA!"
    echo ""
    echo "✅ whatsapp-web.js versão estável instalada"
    echo "✅ Puppeteer compatível instalado"
    echo "✅ Chrome configurado corretamente"
    echo "✅ Servidor funcionando sem erros"
    echo ""
    echo "🔗 Próximos passos:"
    echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    echo "2. Crie uma nova instância"
    echo "3. O QR Code deve aparecer sem erros"
    echo "4. Conecte o WhatsApp normalmente"
else
    echo "⚠️ AINDA HÁ PROBLEMAS"
    echo ""
    echo "Status health: $HEALTH_STATUS"
    echo "Erros críticos: $CRITICAL_ERRORS"
    echo ""
    echo "🔧 Soluções adicionais:"
    echo "1. Reiniciar VPS: sudo reboot"
    echo "2. Verificar espaço em disco: df -h"
    echo "3. Verificar memória: free -m"
fi

echo ""
echo "📋 Para monitorar:"
echo "pm2 logs whatsapp-multi-client"
echo ""
echo "✅ Script concluído!"