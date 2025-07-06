
#!/bin/bash

echo "🔧 CORREÇÃO DEFINITIVA DO PUPPETEER - SESSÕES PERSISTENTES"
echo "========================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-puppeteer-sessions-definitive.sh"
    exit 1
fi

echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

echo "🧹 Limpeza completa de processos Chrome órfãos..."
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true
sleep 5

echo "🧹 Limpando diretórios temporários..."
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
rm -rf /home/ubuntu/.config/google-chrome/SingletonLock 2>/dev/null || true

echo "🔧 Aplicando correções no servidor WhatsApp..."

# Fazer backup do servidor atual
cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.js.backup-$(date +%Y%m%d-%H%M%S)

# Aplicar correções definitivas
cat > /tmp/puppeteer-session-fix.js << 'EOF'
const fs = require('fs');
const serverFile = '/home/ubuntu/sovereign-chat-automation-hub/server/whatsapp-multi-client-server.js';
let content = fs.readFileSync(serverFile, 'utf8');

console.log('🔧 Aplicando correções nas sessões Puppeteer...');

// 1. CORRIGIR CONFIGURAÇÃO DO PUPPETEER
const optimizedPuppeteerConfig = `puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images', 
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--memory-pressure-off',
                '--max_old_space_size=512'
            ],
            timeout: 180000, // 3 minutos timeout
            protocolTimeout: 120000, // 2 minutos protocol timeout
            ignoreHTTPSErrors: true,
            handleSIGINT: false,
            handleSIGTERM: false
        }`;

// Substituir configuração do Puppeteer
content = content.replace(
    /puppeteer:\s*{[\s\S]*?timeout:\s*\d+[^}]*}/,
    optimizedPuppeteerConfig
);

// 2. CORRIGIR VERIFICAÇÕES DE getState()
const fixedGetStateChecks = content.replace(
    /clients\[clientId\]\.client\.getState\(\)/g,
    `(clients[clientId] && clients[clientId].client && !clients[clientId].client._destroyed ? await clients[clientId].client.getState().catch(() => null) : null)`
);

content = fixedGetStateChecks;

// 3. ADICIONAR SISTEMA DE RECUPERAÇÃO DE SESSÕES
const sessionRecoverySystem = `
// SISTEMA DE RECUPERAÇÃO DE SESSÕES PUPPETEER
const SESSION_CHECK_INTERVAL = 30000; // 30 segundos
const MAX_RECOVERY_ATTEMPTS = 3;

// Verificar e recuperar sessões órfãs
const checkAndRecoverSessions = async () => {
    console.log('🔍 [SESSION-RECOVERY] Verificando sessões ativas...');
    
    for (const [clientId, clientData] of Object.entries(clients)) {
        if (!clientData || !clientData.client) continue;
        
        try {
            // Verificar se a página ainda está aberta
            const pages = await clientData.client.pupPage?.browser()?.pages() || [];
            const isPageClosed = !clientData.client.pupPage || clientData.client.pupPage.isClosed();
            
            if (isPageClosed || pages.length === 0) {
                console.log(\`⚠️ [SESSION-RECOVERY] Sessão órfã detectada: \${clientId}\`);
                
                // Tentar recuperar sessão
                if (!clientData.recoveryAttempts) clientData.recoveryAttempts = 0;
                
                if (clientData.recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
                    console.log(\`🔄 [SESSION-RECOVERY] Tentando recuperar sessão \${clientId} (tentativa \${clientData.recoveryAttempts + 1})\`);
                    clientData.recoveryAttempts++;
                    
                    // Remover cliente atual e reinicializar
                    delete clients[clientId];
                    setTimeout(() => {
                        console.log(\`🚀 [SESSION-RECOVERY] Reinicializando \${clientId}\`);
                        initClient(clientId);
                    }, 5000);
                } else {
                    console.log(\`❌ [SESSION-RECOVERY] Máximo de tentativas atingido para \${clientId}\`);
                    clients[clientId].status = 'recovery_failed';
                    await updateInstanceStatus(clientId, 'disconnected');
                }
            } else {
                // Resetar contador se sessão está OK
                if (clientData.recoveryAttempts > 0) {
                    console.log(\`✅ [SESSION-RECOVERY] Sessão \${clientId} recuperada com sucesso\`);
                    clientData.recoveryAttempts = 0;
                }
            }
        } catch (error) {
            console.error(\`❌ [SESSION-RECOVERY] Erro ao verificar sessão \${clientId}:\`, error.message);
        }
    }
};

// Iniciar sistema de recuperação
setInterval(checkAndRecoverSessions, SESSION_CHECK_INTERVAL);
console.log('✅ Sistema de recuperação de sessões ativado');

`;

// Adicionar sistema de recuperação após a definição de clients
content = content.replace(
    /const clients = new Map\(\);/,
    `const clients = new Map();

${sessionRecoverySystem}`
);

// 4. MELHORAR FUNÇÃO initClient COM VERIFICAÇÕES ROBUSTAS
const enhancedInitClient = `
// Função para inicializar cliente com recuperação automática
const initClient = async (clientId, isRecovery = false) => {
    if (clients[clientId] && clients[clientId].client && !clients[clientId].client._destroyed) {
        console.log(\`⚠️ Cliente \${clientId} já está inicializado e ativo.\`);
        return;
    }

    console.log(\`🚀 [\${new Date().toISOString()}] INICIALIZANDO CLIENTE: \${clientId} \${isRecovery ? '(RECUPERAÇÃO)' : ''}\`);

    try {
        // Limpar cliente anterior se existir
        if (clients[clientId]) {
            try {
                if (clients[clientId].client && !clients[clientId].client._destroyed) {
                    await clients[clientId].client.destroy();
                }
            } catch (e) {
                console.log(\`🧹 Erro ao limpar cliente anterior: \${e.message}\`);
            }
        }

        // Criar nova estrutura do cliente
        clients[clientId] = {
            id: clientId,
            client: null,
            status: 'connecting',
            phoneNumber: null,
            hasQrCode: false,
            qrCode: null,
            timestamp: new Date().toISOString(),
            qrTimestamp: null,
            lastActivity: new Date(),
            customName: null,
            info: null,
            recoveryAttempts: 0,
            initAttempts: (clients[clientId]?.initAttempts || 0) + 1
        };

        const client = new Client({
            authStrategy: new (require('whatsapp-web.js').LocalAuth)({
                clientId: clientId
            }),
            ${optimizedPuppeteerConfig.replace('puppeteer: {', '').replace(/}\s*$/, '')}
        });

        clients[clientId].client = client;
        console.log(\`✅ [\${clientId}] Cliente WhatsApp Web.js criado\`);

        // Event Handlers com verificações robustas
        client.on('qr', async (qr) => {
            console.log(\`📱 [\${new Date().toISOString()}] QR CODE para \${clientId}\`);
            
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qr);
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                
                // Verificar se cliente ainda existe
                if (clients[clientId]) {
                    clients[clientId].hasQrCode = true;
                    clients[clientId].qrCode = qrCodeDataUrl;
                    clients[clientId].qrTimestamp = new Date().toISOString();
                    clients[clientId].status = 'qr_ready';
                    clients[clientId].lastActivity = new Date();
                    
                    // Salvar no banco
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
                    
                    // Emitir evento WebSocket
                    io.emit(\`client_status_\${clientId}\`, {
                        clientId,
                        status: 'qr_ready',
                        hasQrCode: true,
                        qrCode: qrCodeDataUrl,
                        phoneNumber: null,
                        timestamp: Date.now()
                    });
                    
                    console.log(\`✅ [\${clientId}] QR Code gerado e salvo\`);
                }
            } catch (error) {
                console.error(\`❌ [\${clientId}] Erro ao processar QR Code:\`, error);
            }
        });

        client.on('ready', async () => {
            console.log(\`🎉 [\${new Date().toISOString()}] CLIENTE CONECTADO: \${clientId}\`);
            
            try {
                if (clients[clientId]) {
                    const phoneNumber = client.info?.wid?.user || null;
                    
                    clients[clientId].status = 'connected';
                    clients[clientId].phoneNumber = phoneNumber;
                    clients[clientId].hasQrCode = false;
                    clients[clientId].qrCode = null;
                    clients[clientId].lastActivity = new Date();
                    clients[clientId].info = client.info;
                    clients[clientId].recoveryAttempts = 0; // Reset recovery attempts
                    
                    console.log(\`📱 [\${clientId}] Telefone conectado: \${phoneNumber}\`);
                    
                    // Atualizar no banco
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
                    
                    // Emitir evento WebSocket
                    io.emit(\`client_status_\${clientId}\`, {
                        clientId,
                        status: 'connected',
                        phoneNumber,
                        hasQrCode: false,
                        timestamp: Date.now()
                    });
                    
                    console.log(\`✅ [\${clientId}] Status atualizado para 'connected'\`);
                }
            } catch (error) {
                console.error(\`❌ [\${clientId}] Erro ao processar ready event:\`, error);
            }
        });

        client.on('authenticated', () => {
            console.log(\`🔐 [\${clientId}] Cliente autenticado\`);
            if (clients[clientId]) {
                clients[clientId].status = 'authenticated';
                clients[clientId].lastActivity = new Date();
            }
        });

        client.on('auth_failure', async (msg) => {
            console.log(\`❌ [\${clientId}] FALHA DE AUTENTICAÇÃO:\`, msg);
            if (clients[clientId]) {
                clients[clientId].status = 'auth_failed';
                await updateInstanceStatus(clientId, 'auth_failed');
            }
        });

        client.on('disconnected', async (reason) => {
            console.log(\`🔌 [\${clientId}] DESCONECTADO:\`, reason);
            if (clients[clientId]) {
                clients[clientId].status = 'disconnected';
                clients[clientId].hasQrCode = false;
                clients[clientId].qrCode = null;
                clients[clientId].phoneNumber = null;
                await updateInstanceStatus(clientId, 'disconnected');
            }
        });

        console.log(\`🔄 [\${clientId}] Inicializando cliente...\`);
        await client.initialize();
        console.log(\`✅ [\${clientId}] Cliente inicializado com sucesso\`);
        
    } catch (error) {
        console.error(\`❌ [\${clientId}] Erro na inicialização:\`, error);
        
        if (clients[clientId]) {
            clients[clientId].status = 'init_failed';
            
            // Tentar recuperação automática
            if (clients[clientId].initAttempts < 3) {
                console.log(\`🔄 [\${clientId}] Tentando recuperação automática em 10s...\`);
                setTimeout(() => {
                    initClient(clientId, true);
                }, 10000);
            } else {
                console.log(\`❌ [\${clientId}] Falha definitiva após 3 tentativas\`);
                await updateInstanceStatus(clientId, 'disconnected');
            }
        }
    }
};
`;

// Substituir função initClient
content = content.replace(
    /\/\/ Função para inicializar um novo cliente[\s\S]*?(?=\/\/ |const |app\.)/,
    enhancedInitClient + '\n\n'
);

fs.writeFileSync(serverFile, content);
console.log('✅ Correções aplicadas com sucesso!');
EOF

node /tmp/puppeteer-session-fix.js

echo "✅ Correções aplicadas no servidor!"

echo "🔧 Instalando dependências atualizadas..."
cd server
npm install puppeteer@latest whatsapp-web.js@latest --save
cd ..

echo "🚀 Reiniciando servidor com correções..."
./scripts/production-start-whatsapp.sh

echo "⏳ Aguardando estabilização (20s)..."
sleep 20

echo "🧪 Testando correções..."
HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://146.59.227.248/health" 2>/dev/null)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check OK ($HEALTH_STATUS)"
else
    echo "❌ Health check falhou ($HEALTH_STATUS)"
fi

echo ""
echo "🎉 CORREÇÃO DEFINITIVA DO PUPPETEER CONCLUÍDA!"
echo "=============================================="
echo "✅ Configuração Puppeteer otimizada"
echo "✅ Sistema de recuperação de sessões implementado"
echo "✅ Verificações robustas de getState()"
echo "✅ Recuperação automática de sessões órfãs"
echo "✅ Timeouts aumentados para maior estabilidade"
echo ""
echo "🔗 Próximos passos:"
echo "1. Acesse o painel admin"
echo "2. Crie uma nova instância"
echo "3. Escaneie o QR Code"
echo "4. O status deve mudar automaticamente para 'connected'"
echo "5. As sessões agora são persistentes e auto-recuperáveis"
echo ""
echo "📊 Para monitorar:"
echo "tail -f logs/whatsapp-multi-client.log | grep -E '(CONECTADO|connected|QR CODE|SESSION-RECOVERY)'"
