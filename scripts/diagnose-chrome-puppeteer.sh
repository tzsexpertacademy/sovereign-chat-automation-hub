#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO - CHROME/PUPPETEER"
echo "=========================================="

echo ""
echo "1️⃣ VERIFICAÇÃO DE INSTALAÇÃO"
echo "============================"

echo "🌐 Verificando Google Chrome..."
if command -v google-chrome &> /dev/null; then
    CHROME_VERSION=$(google-chrome --version 2>/dev/null || echo "Chrome encontrado mas sem versão")
    echo "✅ Chrome: $CHROME_VERSION"
else
    echo "❌ Google Chrome não encontrado"
fi

echo ""
echo "🌐 Verificando Chromium..."
if command -v chromium-browser &> /dev/null; then
    CHROMIUM_VERSION=$(chromium-browser --version 2>/dev/null || echo "Chromium encontrado mas sem versão")
    echo "✅ Chromium: $CHROMIUM_VERSION"
elif command -v chromium &> /dev/null; then
    CHROMIUM_VERSION=$(chromium --version 2>/dev/null || echo "Chromium encontrado mas sem versão")
    echo "✅ Chromium: $CHROMIUM_VERSION"
else
    echo "❌ Chromium não encontrado"
fi

echo ""
echo "2️⃣ TESTE DE PUPPETEER NO NODE.JS"
echo "================================"

cd /home/ubuntu/sovereign-chat-automation-hub/server

echo "📦 Verificando se Puppeteer está disponível..."
node -e "
try {
    const puppeteer = require('puppeteer');
    console.log('✅ Puppeteer carregado com sucesso');
    console.log('📍 Executável do Chrome:', puppeteer.executablePath ? puppeteer.executablePath() : 'Não definido');
} catch (error) {
    console.log('❌ Erro ao carregar Puppeteer:', error.message);
}
" 2>/dev/null || echo "❌ Erro crítico no teste do Puppeteer"

echo ""
echo "3️⃣ TESTE BÁSICO DE PUPPETEER"
echo "============================"

echo "🧪 Testando abertura básica do Chrome via Puppeteer..."

node -e "
(async () => {
    try {
        const puppeteer = require('puppeteer');
        console.log('🚀 Iniciando Puppeteer...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            timeout: 30000
        });
        
        console.log('✅ Puppeteer iniciado com sucesso');
        
        const page = await browser.newPage();
        console.log('✅ Página criada');
        
        await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 10000 });
        console.log('✅ Navegação para Google bem-sucedida');
        
        const title = await page.title();
        console.log('✅ Título da página:', title);
        
        await browser.close();
        console.log('✅ Browser fechado - TESTE BEM-SUCEDIDO!');
        
    } catch (error) {
        console.log('❌ ERRO NO TESTE:', error.message);
        process.exit(1);
    }
})();
" 2>/dev/null || echo "❌ Teste de Puppeteer falhou"

echo ""
echo "4️⃣ VERIFICAÇÃO DE DEPENDÊNCIAS"
echo "==============================="

echo "📦 Verificando dependências instaladas..."
if [ -f "package.json" ]; then
    echo "✅ package.json encontrado"
    
    if [ -d "node_modules" ]; then
        echo "✅ node_modules existe"
        
        if [ -d "node_modules/whatsapp-web.js" ]; then
            echo "✅ whatsapp-web.js instalado"
            WWEBJS_VERSION=$(node -e "console.log(require('./node_modules/whatsapp-web.js/package.json').version)" 2>/dev/null || echo "Versão não detectada")
            echo "   Versão: $WWEBJS_VERSION"
        else
            echo "❌ whatsapp-web.js não encontrado"
        fi
        
        if [ -d "node_modules/puppeteer" ]; then
            echo "✅ puppeteer instalado"
            PUPPETEER_VERSION=$(node -e "console.log(require('./node_modules/puppeteer/package.json').version)" 2>/dev/null || echo "Versão não detectada")
            echo "   Versão: $PUPPETEER_VERSION"
        else
            echo "⚠️ puppeteer não instalado como dependência direta (pode estar no whatsapp-web.js)"
        fi
    else
        echo "❌ node_modules não existe - execute npm install"
    fi
else
    echo "❌ package.json não encontrado"
fi

echo ""
echo "5️⃣ VERIFICAÇÃO DE PROCESSOS"
echo "=========================="

echo "🔍 Processos Chrome ativos:"
CHROME_PROCESSES=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)
echo "   Quantidade: $CHROME_PROCESSES"

if [ "$CHROME_PROCESSES" -gt 0 ]; then
    echo "   Detalhes:"
    ps aux | grep -E "(chrome|chromium)" | grep -v grep | head -5
fi

echo ""
echo "🔍 Processos Node.js ativos:"
NODE_PROCESSES=$(ps aux | grep node | grep -v grep | wc -l)
echo "   Quantidade: $NODE_PROCESSES"

echo ""
echo "6️⃣ VERIFICAÇÃO DE RECURSOS"
echo "========================="

echo "💾 Memória disponível:"
free -h | head -2

echo ""
echo "💾 Espaço em disco:"
df -h | head -2

echo ""
echo "🖥️ Informações do sistema:"
echo "   SO: $(uname -a)"
echo "   CPU: $(nproc) cores"

echo ""
echo "7️⃣ RECOMENDAÇÕES"
echo "================"

# Verificar se Chrome está instalado
if ! command -v google-chrome &> /dev/null && ! command -v chromium &> /dev/null; then
    echo "❌ PROBLEMA: Nenhum browser Chrome/Chromium encontrado"
    echo "💡 SOLUÇÃO: Instale o Chrome:"
    echo "   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -"
    echo "   echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' | sudo tee /etc/apt/sources.list.d/google-chrome.list"
    echo "   sudo apt-get update"
    echo "   sudo apt-get install -y google-chrome-stable"
fi

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "❌ PROBLEMA: Dependências não instaladas"
    echo "💡 SOLUÇÃO: Execute 'npm install' no diretório server/"
fi

# Verificar memória baixa
MEM_AVAILABLE=$(free -m | grep Mem | awk '{print $7}')
if [ "$MEM_AVAILABLE" -lt 512 ]; then
    echo "⚠️ ATENÇÃO: Pouca memória disponível ($MEM_AVAILABLE MB)"
    echo "💡 RECOMENDAÇÃO: Otimizar argumentos do Chrome ou aumentar RAM"
fi

echo ""
echo "✅ Diagnóstico Chrome/Puppeteer concluído!"