#!/bin/bash

# 🔍 DIAGNÓSTICO COMPLETO DE COMPATIBILIDADE DO SISTEMA
# Este script verifica todas as versões e compatibilidades

echo "🔍 ===== DIAGNÓSTICO COMPLETO DE COMPATIBILIDADE ====="
echo "📅 $(date): Iniciando diagnóstico..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir com cor
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

echo "📊 ===== VERSÕES DO SISTEMA ====="

# Versão do Node.js
NODE_VERSION=$(node --version 2>/dev/null || echo "não instalado")
print_status $BLUE "🟢 Node.js: $NODE_VERSION"

# Versão do NPM
NPM_VERSION=$(npm --version 2>/dev/null || echo "não instalado")
print_status $BLUE "🟢 NPM: $NPM_VERSION"

# Sistema operacional
OS_INFO=$(uname -a)
print_status $BLUE "🟢 Sistema: $OS_INFO"

# Arquitetura
ARCH=$(uname -m)
print_status $BLUE "🟢 Arquitetura: $ARCH"

echo ""
echo "📦 ===== DEPENDÊNCIAS DO SERVIDOR ====="

cd server

# Verificar package.json do servidor
if [ -f "package.json" ]; then
    echo "📄 Analisando package.json do servidor..."
    
    # whatsapp-web.js
    WHATSAPP_VERSION=$(npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js | cut -d'@' -f2 || echo "não instalado")
    print_status $BLUE "📱 whatsapp-web.js: $WHATSAPP_VERSION"
    
    # Puppeteer
    PUPPETEER_VERSION=$(npm list puppeteer --depth=0 2>/dev/null | grep puppeteer | cut -d'@' -f2 || echo "não instalado")
    print_status $BLUE "🤖 Puppeteer: $PUPPETEER_VERSION"
    
    # Express
    EXPRESS_VERSION=$(npm list express --depth=0 2>/dev/null | grep express | cut -d'@' -f2 || echo "não instalado")
    print_status $BLUE "🌐 Express: $EXPRESS_VERSION"
    
    # Socket.io
    SOCKETIO_VERSION=$(npm list socket.io --depth=0 2>/dev/null | grep socket.io | cut -d'@' -f2 || echo "não instalado")
    print_status $BLUE "🔌 Socket.io: $SOCKETIO_VERSION"
    
    # QRCode
    QRCODE_VERSION=$(npm list qrcode --depth=0 2>/dev/null | grep qrcode | cut -d'@' -f2 || echo "não instalado")
    print_status $BLUE "🔳 QRCode: $QRCODE_VERSION"
    
    # Multer
    MULTER_VERSION=$(npm list multer --depth=0 2>/dev/null | grep multer | cut -d'@' -f2 || echo "não instalado")
    print_status $BLUE "📁 Multer: $MULTER_VERSION"
else
    print_status $RED "❌ package.json não encontrado no servidor"
fi

echo ""
echo "🔍 ===== VERIFICAÇÃO DE CHROME/CHROMIUM ====="

# Verificar Chrome executáveis
CHROME_PATHS=(
    "/usr/bin/google-chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/chromium-browser"
    "/usr/bin/chromium"
    "/snap/bin/chromium"
    "/opt/google/chrome/chrome"
)

CHROME_FOUND=""
for path in "${CHROME_PATHS[@]}"; do
    if [ -x "$path" ]; then
        CHROME_VERSION=$($path --version 2>/dev/null || echo "erro ao verificar")
        print_status $GREEN "✅ Chrome encontrado: $path ($CHROME_VERSION)"
        CHROME_FOUND="$path"
        break
    fi
done

if [ -z "$CHROME_FOUND" ]; then
    print_status $RED "❌ Chrome/Chromium não encontrado"
else
    print_status $GREEN "✅ Chrome disponível: $CHROME_FOUND"
fi

echo ""
echo "🧪 ===== ANÁLISE DE COMPATIBILIDADE ====="

# Análise de compatibilidade whatsapp-web.js vs Puppeteer
echo "🔬 Verificando compatibilidade whatsapp-web.js vs Puppeteer..."

case "$WHATSAPP_VERSION" in
    "1.25.0"*)
        print_status $YELLOW "⚠️ whatsapp-web.js 1.25.0 - PROBLEMÁTICA"
        echo "   • Conhecida por causar erro 'Evaluation failed: a'"
        echo "   • Incompatível com Puppeteer 21+"
        print_status $RED "   🚨 RECOMENDAÇÃO: Downgrade para 1.23.0 ou 1.24.0"
        ;;
    "1.24.0"*)
        if [[ "$PUPPETEER_VERSION" == "21."* ]] || [[ "$PUPPETEER_VERSION" == "22."* ]]; then
            print_status $YELLOW "⚠️ whatsapp-web.js 1.24.0 + Puppeteer $PUPPETEER_VERSION"
            echo "   • Pode causar problemas com áudio"
            print_status $YELLOW "   🔧 SUGESTÃO: Usar Puppeteer 20.x"
        else
            print_status $GREEN "✅ Combinação estável"
        fi
        ;;
    "1.23.0"*)
        print_status $GREEN "✅ whatsapp-web.js 1.23.0 - ESTÁVEL"
        echo "   • Versão mais estável para áudio/mídia"
        ;;
    "1.22."*)
        print_status $GREEN "✅ whatsapp-web.js 1.22.x - ESTÁVEL"
        ;;
    *)
        print_status $YELLOW "❓ Versão não testada: $WHATSAPP_VERSION"
        ;;
esac

echo ""
echo "🎵 ===== VERIFICAÇÃO ESPECÍFICA DE ÁUDIO ====="

# Verificar se o diretório temp existe
if [ -d "../temp" ]; then
    print_status $GREEN "✅ Diretório temp/ existe"
    TEMP_FILES=$(ls -la ../temp/ 2>/dev/null | wc -l)
    echo "   📁 Arquivos temporários: $((TEMP_FILES - 2))"
else
    print_status $RED "❌ Diretório temp/ não existe"
fi

# Verificar logs de áudio
if [ -f "logs/whatsapp-multi-client.log" ]; then
    echo "🔍 Últimos erros de áudio nos logs:"
    grep -i "evaluation failed\|audio.*error\|send-audio.*error" logs/whatsapp-multi-client.log | tail -5 | while read line; do
        print_status $RED "   ❌ $line"
    done
else
    print_status $YELLOW "⚠️ Log não encontrado"
fi

echo ""
echo "🐛 ===== PROBLEMAS CONHECIDOS ====="

# Verificar problemas conhecidos
echo "🔍 Verificando problemas comuns..."

# Problema: Evaluation failed: a
if grep -q "Evaluation failed: a" logs/whatsapp-multi-client.log 2>/dev/null; then
    print_status $RED "🚨 PROBLEMA DETECTADO: 'Evaluation failed: a'"
    echo "   • Causa: Incompatibilidade whatsapp-web.js com Chrome"
    echo "   • Solução: Downgrade whatsapp-web.js para 1.23.0"
    echo "   • Comando: npm install whatsapp-web.js@1.23.0"
fi

# Problema: Chrome não encontrado
if [ -z "$CHROME_FOUND" ]; then
    print_status $RED "🚨 PROBLEMA: Chrome não encontrado"
    echo "   • Solução: sudo apt update && sudo apt install google-chrome-stable"
fi

# Verificar se Chrome tem permissões
if [ -n "$CHROME_FOUND" ]; then
    if [ ! -x "$CHROME_FOUND" ]; then
        print_status $RED "🚨 PROBLEMA: Chrome sem permissão de execução"
        echo "   • Solução: sudo chmod +x $CHROME_FOUND"
    fi
fi

echo ""
echo "🛠️ ===== RECOMENDAÇÕES DE CORREÇÃO ====="

print_status $BLUE "📋 Baseado na análise, as seguintes ações são recomendadas:"
echo ""

# Recomendação principal baseada na versão
case "$WHATSAPP_VERSION" in
    "1.25.0"*)
        print_status $YELLOW "1. 🔧 URGENTE: Fazer downgrade do whatsapp-web.js"
        echo "   cd server && npm install whatsapp-web.js@1.23.0"
        ;;
    "1.24.0"*)
        if [[ "$PUPPETEER_VERSION" == "21."* ]] || [[ "$PUPPETEER_VERSION" == "22."* ]]; then
            print_status $YELLOW "1. 🔧 Ajustar versão do Puppeteer"
            echo "   cd server && npm install puppeteer@20.9.0"
        fi
        ;;
esac

print_status $BLUE "2. 🧹 Limpar cache e sessões"
echo "   rm -rf server/node_modules server/package-lock.json"
echo "   rm -rf server/sessions/* temp/*"

print_status $BLUE "3. 🔄 Reinstalar dependências"
echo "   cd server && npm install"

if [ -z "$CHROME_FOUND" ]; then
    print_status $BLUE "4. 📥 Instalar Chrome"
    echo "   sudo apt update && sudo apt install google-chrome-stable"
fi

echo ""
echo "🚀 ===== SCRIPT DE CORREÇÃO AUTOMÁTICA ====="
print_status $GREEN "Quer que eu crie um script de correção automática? (Recomendado)"
echo ""

# Verificar se o servidor está rodando
if pgrep -f "whatsapp-multi-client-server.js" > /dev/null; then
    print_status $YELLOW "⚠️ Servidor WhatsApp está rodando - pare antes de aplicar correções"
    echo "   ./scripts/production-stop-whatsapp.sh"
fi

echo ""
print_status $GREEN "✅ Diagnóstico completo!"
echo "📅 $(date): Diagnóstico finalizado"
echo ""
echo "📋 RESUMO DO SISTEMA:"
echo "   Node.js: $NODE_VERSION"
echo "   whatsapp-web.js: $WHATSAPP_VERSION"
echo "   Puppeteer: $PUPPETEER_VERSION"
echo "   Chrome: ${CHROME_FOUND:-"NÃO ENCONTRADO"}"
echo ""

cd ..