#!/bin/bash

# Tornar script executável
chmod +x "$0"

# 🚨 DIAGNÓSTICO AVANÇADO PUPPETEER - WhatsApp SaaS
# Objetivo: Identificar causa real do "Evaluation failed: a"

echo "🔍 ===== DIAGNÓSTICO AVANÇADO PUPPETEER ====="
echo "🕐 Iniciado em: $(date)"
echo ""

# FASE 1: VERSÕES E DEPENDÊNCIAS
echo "📦 ===== FASE 1: VERSÕES E DEPENDÊNCIAS ====="

echo "🔧 Versão do Node.js:"
node --version
echo ""

echo "🌐 Versão do Chrome/Chromium instalado:"
if command -v google-chrome &> /dev/null; then
    google-chrome --version
elif command -v chromium-browser &> /dev/null; then
    chromium-browser --version
elif command -v chromium &> /dev/null; then
    chromium --version
else
    echo "❌ Chrome/Chromium não encontrado no PATH"
fi
echo ""

echo "📋 Verificando dependências do projeto:"
cd /home/ubuntu/sovereign-chat-automation-hub/server
if [ -f package.json ]; then
    echo "🎯 whatsapp-web.js:"
    npm list whatsapp-web.js 2>/dev/null || echo "❌ Não encontrado"
    
    echo "🎯 puppeteer:"
    npm list puppeteer 2>/dev/null || echo "❌ Não encontrado"
    
    echo "🎯 puppeteer-core:"
    npm list puppeteer-core 2>/dev/null || echo "❌ Não encontrado"
else
    echo "❌ package.json não encontrado"
fi
echo ""

# FASE 2: RECURSOS DO SISTEMA
echo "💾 ===== FASE 2: RECURSOS DO SISTEMA ====="

echo "🖥️ Memória disponível:"
free -h
echo ""

echo "⚡ CPU e carga:"
lscpu | grep -E "CPU\(s\):|Model name:"
uptime
echo ""

echo "💽 Espaço em disco:"
df -h /
echo ""

echo "🔍 Processos Chrome/Chromium ativos:"
ps aux | grep -E "(chrome|chromium)" | grep -v grep || echo "❌ Nenhum processo encontrado"
echo ""

# FASE 3: TESTE PUPPETEER SIMPLES
echo "🧪 ===== FASE 3: TESTE PUPPETEER SIMPLES ====="

echo "🎯 Testando Puppeteer básico..."
node -e "
const puppeteer = require('puppeteer');
(async () => {
  try {
    console.log('🚀 Iniciando browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    console.log('📄 Criando página...');
    const page = await browser.newPage();
    
    console.log('🌐 Navegando para google.com...');
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
    
    console.log('📸 Testando screenshot...');
    await page.screenshot({ path: '/tmp/test-puppeteer.png' });
    
    console.log('🔍 Testando evaluate...');
    const title = await page.evaluate(() => document.title);
    console.log('✅ Título da página:', title);
    
    console.log('🧹 Fechando browser...');
    await browser.close();
    
    console.log('✅ TESTE PUPPETEER: SUCESSO');
  } catch (error) {
    console.error('❌ TESTE PUPPETEER: FALHOU');
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);
  }
})();
" 2>&1
echo ""

# FASE 4: TESTE WHATSAPP-WEB.JS ISOLADO
echo "📱 ===== FASE 4: TESTE WHATSAPP-WEB.JS ISOLADO ====="

echo "🎯 Testando inicialização do WhatsApp Client..."
node -e "
const { Client, LocalAuth } = require('whatsapp-web.js');
(async () => {
  try {
    console.log('🚀 Criando cliente WhatsApp...');
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: 'test-diagnostico' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      }
    });
    
    console.log('🔗 Configurando eventos...');
    client.on('qr', () => console.log('📱 QR Code gerado'));
    client.on('ready', () => console.log('✅ Cliente pronto'));
    client.on('authenticated', () => console.log('🔐 Autenticado'));
    client.on('auth_failure', () => console.log('❌ Falha na autenticação'));
    client.on('disconnected', () => console.log('🔌 Desconectado'));
    
    console.log('🎬 Inicializando cliente...');
    await client.initialize();
    
    // Aguardar 10 segundos para eventos
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('🧹 Destruindo cliente...');
    await client.destroy();
    
    console.log('✅ TESTE WHATSAPP CLIENT: SUCESSO');
  } catch (error) {
    console.error('❌ TESTE WHATSAPP CLIENT: FALHOU');
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);
  }
})();
" 2>&1
echo ""

# FASE 5: VERIFICAÇÃO DE PERMISSÕES
echo "🔐 ===== FASE 5: VERIFICAÇÃO DE PERMISSÕES ====="

echo "👤 Usuário atual:"
whoami
id
echo ""

echo "📂 Permissões do diretório de sessões:"
ls -la ~/.wwebjs_auth/ 2>/dev/null || echo "❌ Diretório de sessões não existe"
echo ""

echo "📁 Permissões do diretório temp:"
ls -la /tmp/ | head -10
echo ""

echo "🔍 Verificando se /dev/shm está disponível:"
ls -la /dev/shm/ | head -5
df -h /dev/shm 2>/dev/null || echo "❌ /dev/shm não disponível"
echo ""

# FASE 6: LOGS DO SISTEMA
echo "📋 ===== FASE 6: LOGS DO SISTEMA ====="

echo "🔍 Últimos logs do sistema relacionados a Chrome/Puppeteer:"
journalctl --no-pager -n 20 | grep -i -E "(chrome|chromium|puppeteer|evaluation)" || echo "❌ Nenhum log relevante encontrado"
echo ""

echo "🔍 Verificando dmesg para problemas de memória:"
dmesg | tail -20 | grep -i -E "(memory|oom|killed)" || echo "✅ Nenhum problema de memória detectado"
echo ""

# FASE 7: TESTE DE FALLBACK DOCUMENTO
echo "📄 ===== FASE 7: TESTE FALLBACK DOCUMENTO ====="

echo "🎯 Criando arquivo de teste..."
echo "Teste de upload" > /tmp/test-document.txt

echo "🧪 Testando se upload de documento funciona..."
# Este teste seria executado em um contexto real do WhatsApp
echo "📝 NOTA: Este teste deve ser executado manualmente com uma instância ativa"
echo "   - Verificar se client.sendMessage() com attachment funciona"
echo "   - Testar document em vez de audio"
echo "   - Confirmar se o problema é específico do tipo audio"
echo ""

# FASE 8: RESUMO E RECOMENDAÇÕES
echo "📊 ===== FASE 8: RESUMO E DIAGNÓSTICO ====="

echo "🔍 Verificações realizadas:"
echo "   ✓ Versões de dependências"
echo "   ✓ Recursos do sistema"
echo "   ✓ Teste Puppeteer básico"
echo "   ✓ Teste WhatsApp Client"
echo "   ✓ Permissões de sistema"
echo "   ✓ Logs de erro"
echo "   ✓ Preparação para teste de fallback"
echo ""

echo "🎯 Próximos passos recomendados:"
echo "1. ⚡ Se Puppeteer básico falhou: Problema na instalação do Chrome/Puppeteer"
echo "2. 📱 Se WhatsApp Client falhou: Problema na configuração do whatsapp-web.js"
echo "3. 💾 Se memória baixa (<2GB): Adicionar swap ou otimizar recursos"
echo "4. 🔐 Se problemas de permissão: Ajustar proprietário dos diretórios"
echo "5. 🧪 Testar fallback como documento para isolar problema de audio"
echo ""

echo "📝 Para logs detalhados em tempo real, execute:"
echo "   tail -f ~/sovereign-chat-automation-hub/logs/whatsapp-multi-client.log"
echo ""

echo "🕐 Diagnóstico finalizado em: $(date)"
echo "🚨 ===== FIM DO DIAGNÓSTICO AVANÇADO ====="