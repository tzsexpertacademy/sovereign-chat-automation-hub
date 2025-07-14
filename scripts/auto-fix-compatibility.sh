#!/bin/bash

# 🛠️ CORREÇÃO AUTOMÁTICA DE COMPATIBILIDADE
# Este script aplica as correções baseadas no diagnóstico

echo "🛠️ ===== CORREÇÃO AUTOMÁTICA DE COMPATIBILIDADE ====="
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

# Parar servidor se estiver rodando
echo "🛑 Parando servidor..."
if pgrep -f "whatsapp-multi-client-server.js" > /dev/null; then
    print_status $YELLOW "⚠️ Parando servidor WhatsApp..."
    ./scripts/production-stop-whatsapp.sh
    sleep 3
fi

cd server

print_status $BLUE "📦 Fazendo backup do package.json..."
cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)

print_status $BLUE "🧹 Limpando instalação atual..."
rm -rf node_modules package-lock.json

print_status $BLUE "🧹 Limpando sessões e arquivos temporários..."
rm -rf sessions/* ../temp/*

print_status $BLUE "🔧 Instalando versões compatíveis..."

# Versões testadas e compatíveis
WHATSAPP_VERSION="1.23.0"
PUPPETEER_VERSION="20.9.0"

print_status $GREEN "📱 Instalando whatsapp-web.js@$WHATSAPP_VERSION..."
npm install whatsapp-web.js@$WHATSAPP_VERSION --save

print_status $GREEN "🤖 Instalando puppeteer@$PUPPETEER_VERSION..."
npm install puppeteer@$PUPPETEER_VERSION --save

print_status $BLUE "📦 Instalando outras dependências..."
npm install

print_status $BLUE "🔍 Verificando instalação..."
echo ""
echo "📋 Versões instaladas:"
echo "   whatsapp-web.js: $(npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js | cut -d'@' -f2)"
echo "   puppeteer: $(npm list puppeteer --depth=0 2>/dev/null | grep puppeteer | cut -d'@' -f2)"
echo ""

# Verificar Chrome
print_status $BLUE "🔍 Verificando Chrome..."
CHROME_PATHS=(
    "/usr/bin/google-chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/chromium-browser"
    "/usr/bin/chromium"
)

CHROME_FOUND=""
for path in "${CHROME_PATHS[@]}"; do
    if [ -x "$path" ]; then
        CHROME_FOUND="$path"
        print_status $GREEN "✅ Chrome encontrado: $path"
        break
    fi
done

if [ -z "$CHROME_FOUND" ]; then
    print_status $YELLOW "⚠️ Chrome não encontrado - instalando..."
    
    # Detectar sistema
    if command -v apt > /dev/null; then
        # Ubuntu/Debian
        print_status $BLUE "📥 Instalando Chrome (Ubuntu/Debian)..."
        wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
        echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
        sudo apt update
        sudo apt install -y google-chrome-stable
    elif command -v yum > /dev/null; then
        # CentOS/RHEL
        print_status $BLUE "📥 Instalando Chrome (CentOS/RHEL)..."
        sudo yum install -y wget
        wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
        sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm
        rm google-chrome-stable_current_x86_64.rpm
    else
        print_status $RED "❌ Sistema não suportado para instalação automática do Chrome"
        print_status $YELLOW "🔧 Instale manualmente: https://www.google.com/chrome/"
    fi
fi

# Criar diretórios necessários
print_status $BLUE "📁 Criando diretórios necessários..."
mkdir -p sessions logs ../temp

# Ajustar permissões
print_status $BLUE "🔐 Ajustando permissões..."
chmod 755 sessions logs ../temp
chmod +x ../scripts/*.sh

cd ..

print_status $GREEN "✅ Correção automática concluída!"
echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "1. Iniciar servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Testar conexão WhatsApp"
echo "3. Testar envio de texto"
echo "4. Testar envio de áudio"
echo ""
print_status $BLUE "🔍 Para monitorar: ./scripts/monitor-whatsapp-logs.sh"
echo ""
print_status $GREEN "📋 CONFIGURAÇÃO OTIMIZADA:"
echo "   • whatsapp-web.js: 1.23.0 (estável para áudio)"
echo "   • Puppeteer: 20.9.0 (compatível)"
echo "   • Chrome: instalado automaticamente"
echo "   • Sessões: limpas"
echo "   • Temp: limpo"
echo ""
echo "📅 $(date): Correção finalizada"