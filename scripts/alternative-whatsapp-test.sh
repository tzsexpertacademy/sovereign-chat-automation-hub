
#!/bin/bash

echo "🧪 TESTE ALTERNATIVO - DIFERENTES ABORDAGENS WHATSAPP"
echo "===================================================="

if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/alternative-whatsapp-test.sh"
    exit 1
fi

echo "1️⃣ TESTANDO CONECTIVIDADE DIRETA COM WHATSAPP WEB..."
echo "==================================================="

echo "🌐 Teste de conectividade básica:"
curl -I --connect-timeout 10 --max-time 15 https://web.whatsapp.com 2>/dev/null | head -5

echo ""
echo "🌐 Teste de conectividade com User-Agent específico:"
curl -I --connect-timeout 10 --max-time 15 \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  https://web.whatsapp.com 2>/dev/null | head -5

echo ""
echo "2️⃣ TESTANDO VERSÕES ALTERNATIVAS WHATSAPP WEB.JS..."
echo "=================================================="

cd server

echo "📦 Versão atual instalada:"
npm list whatsapp-web.js 2>/dev/null | grep whatsapp-web.js || echo "Não encontrado"

echo ""
echo "📦 Versões disponíveis (últimas 5):"
npm view whatsapp-web.js versions --json 2>/dev/null | tail -10 | head -5 || echo "Erro ao consultar versões"

echo ""
echo "3️⃣ CRIANDO TESTE COM CONFIGURAÇÃO ALTERNATIVA..."
echo "=============================================="

# Criar teste com configuração completamente diferente
cat > test-alternative-config.js << 'EOF'
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

console.log('🧪 TESTE COM CONFIGURAÇÃO ALTERNATIVA');
console.log('=====================================');

// CONFIGURAÇÃO 1: Modo não-headless (com display virtual)
const config1 = {
    headless: false,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--display=:99'
    ],
    timeout: 120000
};

// CONFIGURAÇÃO 2: Headless com flags diferentes
const config2 = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720',
        '--user-data-dir=/tmp/chrome-whatsapp-test',
        '--remote-debugging-port=9222'
    ],
    timeout: 120000
};

// CONFIGURAÇÃO 3: Modo compatibilidade
const config3 = {
    headless: true, // Headless antigo
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
    ],
    timeout: 120000
};

async function testConfig(configName, puppeteerConfig) {
    console.log(`\n🔧 TESTANDO ${configName}:`);
    console.log('=' + '='.repeat(configName.length + 10));
    
    try {
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `test_${configName.toLowerCase().replace(/\s/g, '_')}`
            }),
            puppeteer: puppeteerConfig
        });

        let qrReceived = false;
        let readyReceived = false;
        let errorOccurred = false;

        client.on('qr', async (qr) => {
            console.log(`✅ [${configName}] QR Code recebido!`);
            qrReceived = true;
            
            try {
                const qrDataUrl = await qrcode.toDataURL(qr);
                console.log(`✅ [${configName}] QR Code convertido para DataURL (length: ${qrDataUrl.length})`);
            } catch (error) {
                console.error(`❌ [${configName}] Erro ao converter QR:`, error.message);
            }
        });

        client.on('ready', () => {
            console.log(`🎉 [${configName}] Cliente PRONTO!`);
            readyReceived = true;
        });

        client.on('auth_failure', (msg) => {
            console.log(`❌ [${configName}] Falha de autenticação:`, msg);
            errorOccurred = true;
        });

        client.on('disconnected', (reason) => {
            console.log(`🔌 [${configName}] Desconectado:`, reason);
        });

        console.log(`🚀 [${configName}] Inicializando cliente...`);
        
        // Timeout personalizado para teste
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout 2 minutos')), 120000);
        });

        await Promise.race([initPromise, timeoutPromise]);
        
        // Aguardar um pouco para eventos
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        console.log(`📊 [${configName}] RESULTADO:`);
        console.log(`   QR Recebido: ${qrReceived ? '✅' : '❌'}`);
        console.log(`   Ready Disparado: ${readyReceived ? '✅' : '❌'}`);
        console.log(`   Erro Ocorreu: ${errorOccurred ? '❌' : '✅'}`);
        
        await client.destroy();
        
        return {
            config: configName,
            qrReceived,
            readyReceived,
            errorOccurred
        };
        
    } catch (error) {
        console.error(`❌ [${configName}] ERRO CRÍTICO:`, error.message);
        return {
            config: configName,
            qrReceived: false,
            readyReceived: false,
            errorOccurred: true,
            error: error.message
        };
    }
}

async function runAllTests() {
    const results = [];
    
    console.log('🧪 Iniciando bateria de testes...\n');
    
    // Teste 1
    const result1 = await testConfig('CONFIGURAÇÃO 1 (Non-Headless)', config1);
    results.push(result1);
    
    // Aguardar um pouco entre testes
    console.log('\n⏳ Aguardando 10s antes do próximo teste...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Teste 2
    const result2 = await testConfig('CONFIGURAÇÃO 2 (New Headless)', config2);
    results.push(result2);
    
    // Aguardar um pouco entre testes
    console.log('\n⏳ Aguardando 10s antes do próximo teste...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Teste 3
    const result3 = await testConfig('CONFIGURAÇÃO 3 (Old Headless)', config3);
    results.push(result3);
    
    console.log('\n\n📊 RESUMO DOS TESTES:');
    console.log('=====================');
    
    results.forEach(result => {
        console.log(`\n🔧 ${result.config}:`);
        console.log(`   QR Recebido: ${result.qrReceived ? '✅' : '❌'}`);
        console.log(`   Ready Disparado: ${result.readyReceived ? '✅' : '❌'}`);
        console.log(`   Sem Erros: ${!result.errorOccurred ? '✅' : '❌'}`);
        if (result.error) {
            console.log(`   Erro: ${result.error}`);
        }
    });
    
    // Encontrar melhor configuração
    const bestConfig = results.find(r => r.qrReceived && !r.errorOccurred);
    if (bestConfig) {
        console.log(`\n🏆 MELHOR CONFIGURAÇÃO: ${bestConfig.config}`);
    } else {
        console.log('\n❌ NENHUMA CONFIGURAÇÃO FUNCIONOU COMPLETAMENTE');
    }
}

runAllTests().catch(console.error);
EOF

echo "🧪 Executando teste com configurações alternativas..."
echo "⚠️ Isso pode levar até 10 minutos..."

# Instalar display virtual se necessário para teste non-headless
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 > /dev/null 2>&1 &
XVFB_PID=$!

# Executar teste
timeout 600 node test-alternative-config.js

# Limpar processo Xvfb
kill $XVFB_PID 2>/dev/null || true

echo ""
echo "4️⃣ VERIFICANDO DEPENDÊNCIAS ESPECÍFICAS..."
echo "========================================"

echo "🔍 Verificando se todas as dependências estão instaladas:"
npm ls --depth=0 2>/dev/null | grep -E "(whatsapp-web.js|puppeteer|qrcode)" || echo "⚠️ Algumas dependências podem estar faltando"

echo ""
echo "5️⃣ TESTANDO DOWNGRADE PARA VERSÃO ESTÁVEL..."
echo "==========================================="

echo "📦 Fazendo backup das versões atuais..."
cp package.json package.json.backup-$(date +%Y%m%d-%H%M%S)
cp package-lock.json package-lock.json.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

echo "📦 Instalando versão estável conhecida do whatsapp-web.js..."
npm uninstall whatsapp-web.js
npm install whatsapp-web.js@1.23.0 --save

echo "📦 Verificando versão instalada:"
npm list whatsapp-web.js

echo ""
echo "6️⃣ CRIANDO CONFIGURAÇÃO DE EMERGÊNCIA..."
echo "======================================"

# Criar versão de emergência do servidor
cat > ../server/whatsapp-emergency-config.js << 'EOF'
// CONFIGURAÇÃO DE EMERGÊNCIA - WHATSAPP WEB.JS
// Usar apenas se a configuração principal não funcionar

const EMERGENCY_PUPPETEER_CONFIG = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-plugins',
        '--window-size=1366,768',
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    timeout: 300000, // 5 minutos apenas
    protocolTimeout: 180000,
    ignoreHTTPSErrors: true,
    handleSIGINT: false,
    handleSIGTERM: false
};

module.exports = { EMERGENCY_PUPPETEER_CONFIG };
EOF

# Limpar arquivos temporários
rm -f test-alternative-config.js

cd ..

echo ""
echo "✅ TESTE ALTERNATIVO CONCLUÍDO!"
echo "==============================="
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. Reiniciar servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Testar com a nova versão estável do whatsapp-web.js"
echo "3. Se ainda não funcionar, verificar se é bloqueio de rede"
echo "4. Considerar usar a configuração de emergência criada"
echo ""
echo "📋 Arquivos criados:"
echo "• server/whatsapp-emergency-config.js (configuração de emergência)"
echo "• Backup dos package.json originais"
echo ""
echo "⚠️ Se nada funcionar, o problema pode ser:"
echo "• WhatsApp bloqueando conexões do seu IP/servidor"
echo "• Necessidade de usar proxy/VPN"
echo "• Ambiente do servidor incompatível com Puppeteer"
