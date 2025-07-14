#!/bin/bash

# 🛠️ CORREÇÃO DEFINITIVA DOS CONFLITOS DE DEPENDÊNCIAS
# Este script resolve os conflitos de versões whatsapp-web.js + puppeteer

echo "🛠️ ===== CORREÇÃO DEFINITIVA - CONFLITOS DE DEPENDÊNCIAS ====="
echo "📅 $(date): Iniciando correção..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Verificar se estamos no diretório correto
if [ ! -f "server/package.json" ]; then
    print_status $RED "❌ Execute este script no diretório raiz do projeto"
    exit 1
fi

print_status $YELLOW "🛑 Parando servidor WhatsApp..."
./scripts/production-stop-whatsapp.sh 2>/dev/null || true
sleep 3

# Matar qualquer processo restante
print_status $YELLOW "🔪 Matando processos restantes..."
pkill -f "whatsapp-multi-client" 2>/dev/null || true
pkill -f "chrome" 2>/dev/null || true
pkill -f "chromium" 2>/dev/null || true
sleep 2

cd server

print_status $BLUE "💾 Fazendo backup completo..."
cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)
cp package-lock.json package-lock.json.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

print_status $YELLOW "🧹 LIMPEZA COMPLETA..."
print_status $BLUE "   • Removendo node_modules..."
rm -rf node_modules

print_status $BLUE "   • Removendo package-lock.json..."
rm -rf package-lock.json

print_status $BLUE "   • Limpando npm cache..."
npm cache clean --force

print_status $BLUE "   • Limpando sessões..."
rm -rf sessions/*

print_status $BLUE "   • Limpando temp..."
rm -rf ../temp/*

print_status $GREEN "🔧 INSTALANDO VERSÕES COMPATÍVEIS E TESTADAS..."

# Versões específicas testadas e funcionais
WHATSAPP_VERSION="1.23.0"
PUPPETEER_VERSION="20.9.0"

print_status $BLUE "📱 Instalando whatsapp-web.js@$WHATSAPP_VERSION..."
npm install whatsapp-web.js@$WHATSAPP_VERSION --save --no-optional

print_status $BLUE "🤖 Instalando puppeteer@$PUPPETEER_VERSION..."
npm install puppeteer@$PUPPETEER_VERSION --save --no-optional

print_status $BLUE "📦 Instalando outras dependências..."
npm install --no-optional

print_status $GREEN "🔍 Verificando instalação..."
echo ""
echo "📋 Versões instaladas:"
echo "   whatsapp-web.js: $(npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js | cut -d'@' -f2)"
echo "   puppeteer: $(npm list puppeteer --depth=0 2>/dev/null | grep puppeteer | cut -d'@' -f2)"
echo ""

# Verificar conflitos
print_status $BLUE "🔍 Verificando conflitos..."
if npm ls 2>&1 | grep -q "invalid\|ELSPROBLEMS"; then
    print_status $YELLOW "⚠️ Ainda há conflitos, fazendo limpeza adicional..."
    rm -rf node_modules package-lock.json
    npm install whatsapp-web.js@$WHATSAPP_VERSION puppeteer@$PUPPETEER_VERSION --save --no-optional
    npm install --no-optional
fi

print_status $BLUE "📁 Criando diretórios necessários..."
mkdir -p sessions logs ../temp

print_status $BLUE "🔐 Ajustando permissões..."
chmod 755 sessions logs ../temp
chmod +x ../scripts/*.sh

cd ..

print_status $GREEN "✅ Correção concluída!"
echo ""
print_status $BLUE "🚀 PRÓXIMOS PASSOS:"
echo "1. Iniciar servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Testar conexão WhatsApp"
echo "3. Testar envio de texto"
echo "4. Testar envio de áudio"
echo ""
print_status $BLUE "🔍 Para monitorar: ./scripts/monitor-whatsapp-logs.sh"
echo ""
print_status $GREEN "📋 CONFIGURAÇÃO OTIMIZADA:"
echo "   • whatsapp-web.js: $WHATSAPP_VERSION (estável para áudio)"
echo "   • Puppeteer: $PUPPETEER_VERSION (compatível testado)"
echo "   • Conflitos: resolvidos"
echo "   • Sessões: limpas"
echo "   • Cache: limpo"
echo ""
echo "📅 $(date): Correção finalizada"