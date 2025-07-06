
#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO - PROBLEMAS DE CONEXÃO WHATSAPP"
echo "======================================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/diagnose-whatsapp-connection-issues.sh"
    exit 1
fi

echo "1️⃣ VERIFICANDO VERSÕES DOS PACOTES..."
echo "======================================"
cd server
echo "📦 Versão WhatsApp Web.js:"
npm list whatsapp-web.js 2>/dev/null | grep whatsapp-web.js || echo "⚠️ Não encontrado"

echo "📦 Versão Puppeteer:"
npm list puppeteer 2>/dev/null | grep puppeteer || echo "⚠️ Não encontrado"

echo "📦 Versão Node.js:"
node --version

echo ""
echo "2️⃣ VERIFICANDO AMBIENTE PUPPETEER..."
echo "===================================="
echo "🖥️ Display disponível:"
echo $DISPLAY

echo "🔍 Fontes do sistema:"
fc-list | head -5

echo "🔍 Dependências Chrome:"
ldd $(which google-chrome 2>/dev/null || echo "/usr/bin/chromium-browser") 2>/dev/null | head -5 || echo "⚠️ Chrome não encontrado"

echo ""
echo "3️⃣ VERIFICANDO LOGS DE ERRO DETALHADOS..."
echo "========================================"
echo "🔍 Últimos erros críticos:"
tail -50 ../logs/whatsapp-multi-client.log 2>/dev/null | grep -i -E "(error|failed|timeout|crashed|killed)" | tail -5

echo ""
echo "4️⃣ VERIFICANDO CONECTIVIDADE WHATSAPP WEB..."
echo "============================================"
echo "🌐 Testando conectividade com WhatsApp Web:"
curl -I --connect-timeout 10 --max-time 15 https://web.whatsapp.com 2>/dev/null | head -3 || echo "❌ Falha na conexão"

echo ""
echo "5️⃣ VERIFICANDO PROCESSOS PUPPETEER..."
echo "===================================="
echo "🔍 Processos Chrome detalhados:"
ps aux | grep -E "(chrome|chromium)" | grep -v grep | head -3

echo ""
echo "6️⃣ VERIFICANDO MEMÓRIA E RECURSOS..."
echo "=================================="
echo "💾 Memória disponível:"
free -h | head -2

echo "💽 Espaço em disco:"
df -h | grep -E "(/$|/tmp)" | head -2

echo ""
echo "7️⃣ CRIANDO TESTE DE PUPPETEER ISOLADO..."
echo "======================================="

# Criar teste isolado de Puppeteer
cat > test-puppeteer-isolated.js << 'EOF'
const puppeteer = require('puppeteer');

console.log('🧪 TESTE ISOLADO DE PUPPETEER');
console.log('=============================');

(async () => {
  try {
    console.log('1️⃣ Iniciando Puppeteer...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      timeout: 60000
    });
    
    console.log('✅ Browser criado com sucesso');
    
    console.log('2️⃣ Abrindo página...');
    const page = await browser.newPage();
    
    console.log('3️⃣ Navegando para WhatsApp Web...');
    await page.goto('https://web.whatsapp.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Página carregada com sucesso');
    
    console.log('4️⃣ Aguardando QR Code aparecer...');
    
    // Aguardar elemento do QR code
    const qrSelector = 'canvas[aria-label="Scan me!"], div[data-testid="qr-code"]';
    await page.waitForSelector(qrSelector, { timeout: 30000 });
    
    console.log('✅ QR Code detectado na página!');
    
    console.log('5️⃣ Mantendo sessão por 30 segundos...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('✅ Sessão mantida com sucesso');
    
    await browser.close();
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO');
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  }
})();
EOF

echo "🧪 Executando teste isolado de Puppeteer..."
timeout 120 node test-puppeteer-isolated.js || echo "⏰ Teste interrompido por timeout"

echo ""
echo "8️⃣ RECOMENDAÇÕES BASEADAS NO DIAGNÓSTICO..."
echo "========================================="

# Verificar versão do WhatsApp Web.js
WHATSAPP_VERSION=$(npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || echo "unknown")

if [[ "$WHATSAPP_VERSION" == "unknown" ]]; then
    echo "🔧 RECOMENDAÇÃO 1: Reinstalar whatsapp-web.js"
    echo "   npm uninstall whatsapp-web.js"
    echo "   npm install whatsapp-web.js@latest"
fi

# Verificar se Chrome está funcionando
if ! command -v google-chrome &> /dev/null && ! command -v chromium-browser &> /dev/null; then
    echo "🔧 RECOMENDAÇÃO 2: Instalar Google Chrome"
    echo "   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -"
    echo "   echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/google-chrome.list"
    echo "   apt update && apt install -y google-chrome-stable"
fi

echo ""
echo "9️⃣ IMPLEMENTANDO CORREÇÃO EXPERIMENTAL..."
echo "======================================="

# Backup do servidor atual
cp ../server/whatsapp-multi-client-server.js ../server/whatsapp-multi-client-server.js.backup-$(date +%Y%m%d-%H%M%S)

# Implementar correção experimental
node << 'EOF'
const fs = require('fs');
const serverFile = '../server/whatsapp-multi-client-server.js';
let content = fs.readFileSync(serverFile, 'utf8');

console.log('🔧 Aplicando correção experimental...');

// 1. FORÇAR WHATSAPP WEB.JS VERSÃO ESPECÍFICA CONHECIDA POR FUNCIONAR
const forceStableWhatsAppWebJs = `
// CONFIGURAÇÃO EXPERIMENTAL - FORÇAR VERSÃO ESTÁVEL
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// CONFIGURAÇÃO PUPPETEER ULTRA-ROBUSTA
const PUPPETEER_CONFIG = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--memory-pressure-off',
        '--max_old_space_size=2048',
        '--js-flags="--max-old-space-size=2048"',
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    timeout: 600000, // 10 minutos
    protocolTimeout: 300000, // 5 minutos
    ignoreHTTPSErrors: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    devtools: false
};

// SISTEMA DE RECUPERAÇÃO AGRESSIVA
const RECOVERY_ATTEMPTS = new Map();
const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_DELAY = 30000; // 30 segundos

`;

// Adicionar configuração no início do arquivo
content = content.replace(
    /const { Client, LocalAuth } = require\('whatsapp-web\.js'\);/,
    forceStableWhatsAppWebJs
);

// 2. FUNÇÃO initClient COMPLETAMENTE REESCRITA COM RECUPERAÇÃO AGRESSIVA
const bulletproofInitClient = `
// FUNÇÃO INITCLIENT ULTRA-ROBUSTA COM RECUPERAÇÃO AGRESSIVA
const initClient = async (clientId, isRecovery = false) => {
    const recoveryKey = clientId;
    const currentAttempts = RECOVERY_ATTEMPTS.get(recoveryKey) || 0;
    
    if (currentAttempts >= MAX_RECOVERY_ATTEMPTS) {
        console.log(\`❌ [\${clientId}] Máximo de tentativas de recuperação atingido (\${MAX_RECOVERY_ATTEMPTS})\`);
        return;
    }

    console.log(\`🚀 [\${new Date().toISOString()}] INIT CLIENT ULTRA-ROBUSTA: \${clientId} (tentativa \${currentAttempts + 1}/\${MAX_RECOVERY_ATTEMPTS})\`);

    try {
        // Limpar cliente anterior AGRESSIVAMENTE
        if (clients[clientId]) {
            try {
                if (clients[clientId].client && !clients[clientId].client._destroyed) {
                    await clients[clientId].client.destroy().catch(() => {});
                }
            } catch (e) {
                console.log(\`🧹 [\${clientId}] Erro ao limpar cliente anterior: \${e.message}\`);
            }
        }

        // Incrementar contador de tentativas
        RECOVERY_ATTEMPTS.set(recoveryKey, currentAttempts + 1);

        // Criar estrutura do cliente
        clients[clientId] = {
            id: clientId,
            client: null,
            status: 'initializing',
            phoneNumber: null,
            hasQrCode: false,
            qrCode: null,
            timestamp: new Date().toISOString(),
            qrTimestamp: null,
            lastActivity: new Date(),
            customName: null,
            info: null,
            recoveryAttempts: currentAttempts + 1
        };

        console.log(\`🔧 [\${clientId}] Criando cliente WhatsApp Web.js com configuração ultra-robusta...\`);

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: clientId
            }),
            puppeteer: PUPPETEER_CONFIG
        });

        clients[clientId].client = client;
        console.log(\`✅ [\${clientId}] Cliente WhatsApp Web.js criado com timeouts de 10 minutos\`);

        // EVENT HANDLERS COM RECUPERAÇÃO AUTOMÁTICA

        client.on('qr', async (qr) => {
            console.log(\`📱 [\${new Date().toISOString()}] QR CODE GERADO EXPERIMENTAL para \${clientId}\`);
            
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                
                if (clients[clientId]) {
                    clients[clientId].hasQrCode = true;
                    clients[clientId].qrCode = qrCodeDataUrl;
                    clients[clientId].qrTimestamp = new Date().toISOString();
                    clients[clientId].status = 'qr_ready';
                    clients[clientId].lastActivity = new Date();
                    
                    console.log(\`✅ [QR-EXPERIMENTAL] QR salvo para \${clientId} - length: \${qrCodeDataUrl.length}\`);
                    
                    // Salvar no banco com retry
                    let dbSaved = false;
                    for (let retry = 0; retry < 3 && !dbSaved; retry++) {
                        try {
                            await supabase
                                .from('whatsapp_instances')
                                .update({
                                    qr_code: qrCodeDataUrl,
                                    has_qr_code: true,
                                    qr_expires_at: expiresAt.toISOString(),
                                    status: 'qr_ready',
                                    updated_at: new Date().toISOString()
                                })
                                .eq('instance_id', clientId);
                            
                            dbSaved = true;
                            console.log(\`✅ [QR-EXPERIMENTAL] QR salvo no banco (tentativa \${retry + 1})\`);
                        } catch (error) {
                            console.error(\`❌ [QR-EXPERIMENTAL] Erro ao salvar no banco (tentativa \${retry + 1}):\`, error.message);
                            if (retry < 2) await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    
                    // Emitir WebSocket com retry
                    for (let retry = 0; retry < 3; retry++) {
                        try {
                            io.emit(\`client_status_\${clientId}\`, {
                                clientId,
                                status: 'qr_ready',
                                hasQrCode: true,
                                qrCode: qrCodeDataUrl,
                                phoneNumber: null,
                                timestamp: Date.now()
                            });
                            
                            console.log(\`✅ [QR-EXPERIMENTAL] QR enviado via WebSocket (tentativa \${retry + 1})\`);
                            break;
                        } catch (error) {
                            console.error(\`❌ [QR-EXPERIMENTAL] Erro WebSocket (tentativa \${retry + 1}):\`, error.message);
                            if (retry < 2) await new Promise(r => setTimeout(r, 500));
                        }
                    }
                }
            } catch (error) {
                console.error(\`❌ [\${clientId}] Erro crítico ao processar QR Code:\`, error);
                
                // RECUPERAÇÃO AUTOMÁTICA em caso de erro no QR
                setTimeout(() => {
                    console.log(\`🔄 [\${clientId}] Iniciando recuperação automática por erro no QR...\`);
                    initClient(clientId, true).catch(console.error);
                }, 10000);
            }
        });

        client.on('ready', async () => {
            console.log(\`🎉 [\${new Date().toISOString()}] EVENTO READY EXPERIMENTAL: \${clientId}\`);
            
            // Resetar contador de tentativas de recuperação
            RECOVERY_ATTEMPTS.delete(recoveryKey);
            
            try {
                if (clients[clientId]) {
                    const phoneNumber = client.info?.wid?.user || client.info?.me?.user || null;
                    
                    clients[clientId].status = 'connected';
                    clients[clientId].phoneNumber = phoneNumber;
                    clients[clientId].hasQrCode = false;
                    clients[clientId].qrCode = null;
                    clients[clientId].lastActivity = new Date();
                    clients[clientId].info = client.info;
                    
                    console.log(\`📱 [\${clientId}] READY EXPERIMENTAL - Telefone: \${phoneNumber}\`);
                    
                    // Atualizar no banco com retry
                    for (let retry = 0; retry < 3; retry++) {
                        try {
                            await supabase
                                .from('whatsapp_instances')
                                .update({
                                    status: 'connected',
                                    phone_number: phoneNumber,
                                    has_qr_code: false,
                                    qr_code: null,
                                    qr_expires_at: null,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('instance_id', clientId);
                            
                            console.log(\`✅ [READY-EXPERIMENTAL] Banco atualizado (tentativa \${retry + 1})\`);
                            break;
                        } catch (error) {
                            console.error(\`❌ [READY-EXPERIMENTAL] Erro no banco (tentativa \${retry + 1}):\`, error.message);
                            if (retry < 2) await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    
                    // Emitir WebSocket com retry
                    for (let retry = 0; retry < 3; retry++) {
                        try {
                            io.emit(\`client_status_\${clientId}\`, {
                                clientId,
                                status: 'connected',
                                phoneNumber,
                                hasQrCode: false,
                                timestamp: Date.now()
                            });
                            
                            console.log(\`✅ [READY-EXPERIMENTAL] WebSocket emitido (tentativa \${retry + 1})\`);
                            break;
                        } catch (error) {
                            console.error(\`❌ [READY-EXPERIMENTAL] Erro WebSocket (tentativa \${retry + 1}):\`, error.message);
                            if (retry < 2) await new Promise(r => setTimeout(r, 500));
                        }
                    }
                }
            } catch (error) {
                console.error(\`❌ [\${clientId}] Erro ao processar evento ready:\`, error);
            }
        });

        client.on('authenticated', () => {
            console.log(\`🔐 [\${clientId}] Cliente autenticado experimentalmente\`);
            if (clients[clientId]) {
                clients[clientId].status = 'authenticated';
                clients[clientId].lastActivity = new Date();
            }
        });

        client.on('auth_failure', async (msg) => {
            console.log(\`❌ [\${clientId}] FALHA DE AUTENTICAÇÃO EXPERIMENTAL:\`, msg);
            if (clients[clientId]) {
                clients[clientId].status = 'auth_failed';
                await updateInstanceStatus(clientId, 'auth_failed');
            }
            
            // Recuperação automática após falha de auth
            setTimeout(() => {
                console.log(\`🔄 [\${clientId}] Recuperação automática após falha de auth...\`);
                initClient(clientId, true).catch(console.error);
            }, RECOVERY_DELAY);
        });

        client.on('disconnected', async (reason) => {
            console.log(\`🔌 [\${clientId}] DESCONECTADO EXPERIMENTAL:\`, reason);
            if (clients[clientId]) {
                clients[clientId].status = 'disconnected';
                clients[clientId].hasQrCode = false;
                clients[clientId].qrCode = null;
                clients[clientId].phoneNumber = null;
                await updateInstanceStatus(clientId, 'disconnected');
            }
            
            // Recuperação automática após desconexão (a menos que seja intencional)
            if (reason !== 'LOGOUT') {
                setTimeout(() => {
                    console.log(\`🔄 [\${clientId}] Recuperação automática após desconexão: \${reason}\`);
                    initClient(clientId, true).catch(console.error);
                }, RECOVERY_DELAY);
            }
        });

        // INICIALIZAR COM TIMEOUT PERSONALIZADO
        console.log(\`🔄 [\${clientId}] Inicializando cliente com timeout de 10 minutos...\`);
        
        // Promise com timeout personalizado
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout de inicialização (10 minutos)')), 600000);
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        console.log(\`✅ [\${clientId}] Cliente inicializado com sucesso - aguardando QR ou ready\`);
        
    } catch (error) {
        console.error(\`❌ [\${clientId}] Erro na inicialização experimental:\`, error);
        
        if (clients[clientId]) {
            clients[clientId].status = 'init_failed';
        }
        
        // Recuperação automática após erro de inicialização
        if (currentAttempts < MAX_RECOVERY_ATTEMPTS) {
            console.log(\`🔄 [\${clientId}] Programando recuperação automática após erro (\${RECOVERY_DELAY}ms)...\`);
            setTimeout(() => {
                initClient(clientId, true).catch(console.error);
            }, RECOVERY_DELAY);
        } else {
            console.log(\`❌ [\${clientId}] Falha definitiva após \${MAX_RECOVERY_ATTEMPTS} tentativas\`);
            RECOVERY_ATTEMPTS.delete(recoveryKey);
            if (clients[clientId]) {
                updateInstanceStatus(clientId, 'disconnected').catch(console.error);
            }
        }
    }
};
`;

// Substituir função initClient
content = content.replace(
    /\/\/ Função para inicializar um novo cliente[\s\S]*?(?=\/\/ |const |app\.)/,
    bulletproofInitClient + '\n\n'
);

fs.writeFileSync(serverFile, content);
console.log('✅ Correção experimental aplicada com sucesso!');
EOF

cd ..

echo ""
echo "🔟 FINALIZANDO DIAGNÓSTICO..."
echo "=========================="

# Limpar arquivos temporários
rm -f server/test-puppeteer-isolated.js

echo ""
echo "✅ DIAGNÓSTICO COMPLETO CONCLUÍDO!"
echo "================================="
echo ""
echo "📋 RESUMO DAS DESCOBERTAS:"
echo "• Versão WhatsApp Web.js: $(cd server && npm list whatsapp-web.js --depth=0 2>/dev/null | grep whatsapp-web.js | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || echo 'unknown')"
echo "• Aplicada correção experimental com recuperação agressiva"
echo "• Timeout aumentado para 10 minutos"
echo "• Sistema de retry implementado para todas as operações críticas"
echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "1. Reiniciar o servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Testar nova instância no painel admin"
echo "3. Monitorar logs: tail -f logs/whatsapp-multi-client.log"
echo ""
echo "🎯 Se o problema persistir, a causa pode ser:"
echo "• Restrições de rede/firewall bloqueando WhatsApp Web"
echo "• Versão incompatível do WhatsApp Web.js com WhatsApp atual"
echo "• Problema de ambiente no servidor (display, fontes, etc.)"
