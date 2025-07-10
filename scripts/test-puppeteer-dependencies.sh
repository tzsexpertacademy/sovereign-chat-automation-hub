#!/bin/bash

# Script para testar dependências do Puppeteer/Chrome
# Arquivo: scripts/test-puppeteer-dependencies.sh

echo "🔍 TESTANDO DEPENDÊNCIAS PUPPETEER/CHROME"
echo "========================================"

# Verificar se Node.js está disponível
echo ""
echo "1️⃣ VERIFICANDO NODE.JS"
echo "====================="
if command -v node &> /dev/null; then
    echo "✅ Node.js versão: $(node --version)"
else
    echo "❌ Node.js não encontrado!"
    exit 1
fi

# Verificar se estamos no diretório correto
echo ""
echo "2️⃣ VERIFICANDO DIRETÓRIO"
echo "======================="
if [ -f "server/package.json" ]; then
    echo "✅ Diretório do projeto OK"
else
    echo "❌ Execute este script da pasta raiz do projeto"
    exit 1
fi

# Verificar dependências do servidor
echo ""
echo "3️⃣ VERIFICANDO DEPENDÊNCIAS DO SERVIDOR"
echo "======================================"
cd server

if [ ! -d "node_modules" ]; then
    echo "❌ node_modules não encontrado. Executando npm install..."
    npm install
fi

echo "✅ Verificando whatsapp-web.js..."
if [ -d "node_modules/whatsapp-web.js" ]; then
    echo "✅ whatsapp-web.js encontrado"
else
    echo "❌ whatsapp-web.js não encontrado"
fi

echo "✅ Verificando puppeteer..."
if [ -d "node_modules/puppeteer" ] || [ -d "node_modules/puppeteer-core" ]; then
    echo "✅ Puppeteer encontrado"
else
    echo "❌ Puppeteer não encontrado"
fi

# Verificar se Chrome/Chromium está disponível
echo ""
echo "4️⃣ VERIFICANDO CHROME/CHROMIUM"
echo "============================="

# Tentar encontrar executáveis do Chrome
CHROME_PATHS=(
    "/usr/bin/google-chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
    "/opt/google/chrome/chrome"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

CHROME_FOUND=false
for chrome_path in "${CHROME_PATHS[@]}"; do
    if [ -f "$chrome_path" ]; then
        echo "✅ Chrome encontrado: $chrome_path"
        
        # Verificar versão
        if "$chrome_path" --version 2>/dev/null; then
            echo "✅ Versão: $("$chrome_path" --version 2>/dev/null)"
        fi
        
        CHROME_FOUND=true
        break
    fi
done

if [ "$CHROME_FOUND" = false ]; then
    echo "❌ Chrome/Chromium não encontrado nos caminhos padrão"
    echo ""
    echo "🔧 INSTALAÇÃO DO CHROME/CHROMIUM:"
    echo "================================"
    echo "Ubuntu/Debian:"
    echo "  sudo apt update"
    echo "  sudo apt install -y google-chrome-stable"
    echo ""
    echo "Ou instalar Chromium:"
    echo "  sudo apt install -y chromium-browser"
    echo ""
    echo "CentOS/RHEL:"
    echo "  sudo yum install -y chromium"
fi

# Verificar dependências do sistema para Chrome
echo ""
echo "5️⃣ VERIFICANDO DEPENDÊNCIAS DO SISTEMA"
echo "====================================="

# Lista de bibliotecas essenciais para Chrome headless
REQUIRED_LIBS=(
    "libX11.so.6"
    "libXcomposite.so.1"
    "libXdamage.so.1"
    "libXext.so.6"
    "libXfixes.so.3"
    "libXrandr.so.2"
    "libXss.so.1"
    "libXtst.so.6"
    "libatspi.so.0"
    "libdrm.so.2"
    "libgtk-3.so.0"
    "libgdk-3.so.0"
)

MISSING_LIBS=()
for lib in "${REQUIRED_LIBS[@]}"; do
    if ldconfig -p | grep -q "$lib"; then
        echo "✅ $lib encontrada"
    else
        echo "❌ $lib NÃO encontrada"
        MISSING_LIBS+=("$lib")
    fi
done

if [ ${#MISSING_LIBS[@]} -gt 0 ]; then
    echo ""
    echo "⚠️ DEPENDÊNCIAS FALTANDO:"
    echo "========================"
    printf '❌ %s\n' "${MISSING_LIBS[@]}"
    echo ""
    echo "🔧 Para instalar no Ubuntu/Debian:"
    echo "sudo apt update"
    echo "sudo apt install -y \\"
    echo "  libx11-6 libxcomposite1 libxdamage1 libxext6 \\"
    echo "  libxfixes3 libxrandr2 libxss1 libxtst6 \\"
    echo "  libatspi2.0-0 libdrm2 libgtk-3-0 libgdk-pixbuf2.0-0 \\"
    echo "  libasound2 libatk-bridge2.0-0 libcairo-gobject2 \\"
    echo "  libgbm1 libnss3 libxkbcommon0"
fi

# Teste prático do Puppeteer
echo ""
echo "6️⃣ TESTE PRÁTICO DO PUPPETEER"
echo "============================"

# Criar script de teste temporário
cat > test-puppeteer.js << 'EOF'
const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('🔍 Testando criação do cliente WhatsApp...');

try {
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: 'test-puppeteer'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        }
    });
    
    console.log('✅ Cliente WhatsApp criado com sucesso');
    
    // Não inicializar, apenas testar a criação
    console.log('✅ Teste de Puppeteer passou!');
    process.exit(0);
    
} catch (error) {
    console.error('❌ Erro no teste do Puppeteer:', error.message);
    console.error('💡 Tipo do erro:', error.name);
    process.exit(1);
}
EOF

echo "🚀 Executando teste prático..."
if node test-puppeteer.js; then
    echo "✅ Teste prático passou!"
else
    echo "❌ Teste prático falhou!"
fi

# Limpar arquivo de teste
rm -f test-puppeteer.js

echo ""
echo "7️⃣ VERIFICAÇÕES FINAIS"
echo "===================="

# Verificar espaço em disco
DISK_USAGE=$(df /tmp | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "⚠️ Espaço em disco baixo: ${DISK_USAGE}% usado"
else
    echo "✅ Espaço em disco OK: ${DISK_USAGE}% usado"
fi

# Verificar memória
MEMORY_USAGE=$(free | awk 'FNR==2{printf "%.0f", $3/($3+$4)*100}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
    echo "⚠️ Uso de memória alto: ${MEMORY_USAGE}%"
else
    echo "✅ Memória OK: ${MEMORY_USAGE}% usado"
fi

# Verificar processos Chrome existentes
CHROME_PROCESSES=$(pgrep -f "chrome|chromium" | wc -l)
if [ "$CHROME_PROCESSES" -gt 0 ]; then
    echo "⚠️ $CHROME_PROCESSES processos Chrome/Chromium já rodando"
    echo "💡 Pode ser necessário limpar: pkill -f chrome"
else
    echo "✅ Nenhum processo Chrome/Chromium rodando"
fi

cd ..

echo ""
echo "📅 Teste concluído em: $(date)"
echo ""
echo "🎯 RESUMO:"
echo "========="
if [ "$CHROME_FOUND" = true ] && [ ${#MISSING_LIBS[@]} -eq 0 ]; then
    echo "✅ Todas as dependências estão OK!"
    echo "💡 O Puppeteer deve funcionar corretamente"
else
    echo "❌ Existem problemas que precisam ser corrigidos"
    echo "💡 Instale as dependências faltando antes de tentar novamente"
fi