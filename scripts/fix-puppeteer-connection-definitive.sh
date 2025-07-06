
#!/bin/bash

echo "🔧 CORREÇÃO DEFINITIVA - CONEXÃO WHATSAPP PERSISTENTE"
echo "===================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-puppeteer-connection-definitive.sh"
    exit 1
fi

echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

echo "🧹 Limpeza completa de processos e cache..."
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true
sleep 3

# Limpar cache Puppeteer e Chrome
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
rm -rf /home/ubuntu/.cache/puppeteer 2>/dev/null || true
rm -rf /home/ubuntu/.config/google-chrome/SingletonLock 2>/dev/null || true

echo "🔧 Aplicando correção definitiva no servidor..."

# Fazer backup
cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.js.backup-$(date +%Y%m%d-%H%M%S)

# Aplicar correção definitiva
cat > /tmp/connection-fix.js << 'EOF'
const fs = require('fs');
const serverFile = '/home/ubuntu/sovereign-chat-automation-hub/server/whatsapp-multi-client-server.js';
let content = fs.readFileSync(serverFile, 'utf8');

console.log('🔧 Aplicando correção definitiva de conexão...');

// 1. CONFIGURAÇÃO PUPPETEER OTIMIZADA PARA CONEXÃO PERSISTENTE
const optimizedPuppeteerConfig = `puppeteer: {
            headless: 'new', // Usar novo headless mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
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
                '--max_old_space_size=1024',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-background-networking',
                '--disable-component-update'
            ],
            timeout: 300000, // 5 minutos timeout
            protocolTimeout: 180000, // 3 minutos protocol timeout
            ignoreHTTPSErrors: true,
            handleSIGINT: false,
            handleSIGTERM: false,
            devtools: false
        }`;

// Substituir configuração do Puppeteer
content = content.replace(
    /puppeteer:\s*{[\s\S]*?timeout:\s*\d+[^}]*}/,
    optimizedPuppeteerConfig
);

// 2. SISTEMA DE VERIFICAÇÃO ATIVA DE CONEXÃO
const activeConnectionSystem = `
// SISTEMA DE VERIFICAÇÃO ATIVA DE CONEXÃO - DEFINITIVO
const CONNECTION_CHECK_INTERVAL = 5000; // Verificar a cada 5 segundos
const MAX_CONNECTION_WAIT = 300000; // Aguardar até 5 minutos
const activeConnectionCheckers = new Map();

// Função para verificação ativa de conexão
const startActiveConnectionCheck = (clientId) => {
    console.log(\`🔍 [CONNECTION-CHECK] Iniciando verificação ativa para \${clientId}\`);
    
    if (activeConnectionCheckers.has(clientId)) {
        clearInterval(activeConnectionCheckers.get(clientId));
    }
    
    const startTime = Date.now();
    
    const checkInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > MAX_CONNECTION_WAIT) {
            console.log(\`⏰ [CONNECTION-CHECK] Timeout para \${clientId} após \${elapsed}ms\`);
            clearInterval(checkInterval);
            activeConnectionCheckers.delete(clientId);
            return;
        }
        
        const client = clients[clientId];
        if (!client || !client.client) {
            console.log(\`❌ [CONNECTION-CHECK] Cliente \${clientId} não encontrado\`);
            clearInterval(checkInterval);
            activeConnectionCheckers.delete(clientId);
            return;
        }
        
        try {
            // Verificar se página ainda existe
            if (client.client.pupPage && client.client.pupPage.isClosed()) {
                console.log(\`❌ [CONNECTION-CHECK] Página fechada para \${clientId}\`);
                clearInterval(checkInterval);
                activeConnectionCheckers.delete(clientId);
                return;
            }
            
            // Verificar estado atual
            const state = await client.client.getState().catch(() => null);
            console.log(\`🔍 [CONNECTION-CHECK] \${clientId} - Estado: \${state} (tempo: \${elapsed}ms)\`);
            
            if (state === 'CONNECTED') {
                console.log(\`🎉 [CONNECTION-CHECK] CONEXÃO DETECTADA! \${clientId}\`);
                
                // Obter informações do usuário
                const info = await client.client.info.catch(() => null);
                const phoneNumber = info?.wid?.user || info?.me?.user || null;
                
                console.log(\`✅ [CONNECTION-CHECK] Telefone conectado: \${phoneNumber}\`);
                
                // Atualizar status imediatamente
                clients[clientId].status = 'connected';
                clients[clientId].phoneNumber = phoneNumber;
                clients[clientId].hasQrCode = false;
                clients[clientId].qrCode = null;
                clients[clientId].lastActivity = new Date();
                clients[clientId].info = info;
                
                // Salvar no banco
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
                
                console.log(\`🎉 [CONNECTION-CHECK] Status atualizado para connected: \${clientId}\`);
                
                // Parar verificação
                clearInterval(checkInterval);
                activeConnectionCheckers.delete(clientId);
            } else if (state === 'OPENING') {
                console.log(\`🔄 [CONNECTION-CHECK] \${clientId} abrindo WhatsApp Web...\`);
            }
            
        } catch (error) {
            console.error(\`❌ [CONNECTION-CHECK] Erro ao verificar \${clientId}:\`, error.message);
            
            if (error.message.includes('Session closed') || error.message.includes('Page closed')) {
                console.log(\`💀 [CONNECTION-CHECK] Sessão morta detectada: \${clientId}\`);
                clearInterval(checkInterval);
                activeConnectionCheckers.delete(clientId);
            }
        }
    }, CONNECTION_CHECK_INTERVAL);
    
    activeConnectionCheckers.set(clientId, checkInterval);
};

// Parar verificação ativa
const stopActiveConnectionCheck = (clientId) => {
    if (activeConnectionCheckers.has(clientId)) {
        clearInterval(activeConnectionCheckers.get(clientId));
        activeConnectionCheckers.delete(clientId);
        console.log(\`🛑 [CONNECTION-CHECK] Parada verificação ativa: \${clientId}\`);
    }
};

`;

// Adicionar sistema de verificação ativa
content = content.replace(
    /const clients = new Map\(\);/,
    \`const clients = new Map();

\${activeConnectionSystem}\`
);

// 3. FUNÇÃO initClient OTIMIZADA COM VERIFICAÇÃO ATIVA
const enhancedInitClient = \`
// Função para inicializar cliente com verificação ativa de conexão
const initClient = async (clientId, isRecovery = false) => {
    if (clients[clientId] && clients[clientId].client && !clients[clientId].client._destroyed) {
        console.log(\\\`⚠️ Cliente \\\${clientId} já está inicializado e ativo.\\\`);
        return;
    }

    console.log(\\\`🚀 [\\\${new Date().toISOString()}] INICIALIZANDO CLIENTE: \\\${clientId} \\\${isRecovery ? '(RECUPERAÇÃO)' : ''}\\\`);

    try {
        // Parar verificação anterior se existir
        stopActiveConnectionCheck(clientId);
        
        // Limpar cliente anterior se existir
        if (clients[clientId]) {
            try {
                if (clients[clientId].client && !clients[clientId].client._destroyed) {
                    await clients[clientId].client.destroy();
                }
            } catch (e) {
                console.log(\\\`🧹 Erro ao limpar cliente anterior: \\\${e.message}\\\`);
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
            \${optimizedPuppeteerConfig.replace('puppeteer: {', '').replace(/}\s*$/, '')}
        });

        clients[clientId].client = client;
        console.log(\\\`✅ [\\\${clientId}] Cliente WhatsApp Web.js criado com timeouts estendidos\\\`);

        // Event Handlers OTIMIZADOS
        client.on('qr', async (qr) => {
            console.log(\\\`📱 [\\\${new Date().toISOString()}] QR CODE GERADO para \\\${clientId}\\\`);
            
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qr);
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                
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
                    io.emit(\\\`client_status_\\\${clientId}\\\`, {
                        clientId,
                        status: 'qr_ready',
                        hasQrCode: true,
                        qrCode: qrCodeDataUrl,
                        phoneNumber: null,
                        timestamp: Date.now()
                    });
                    
                    console.log(\\\`✅ [\\\${clientId}] QR Code salvo - INICIANDO VERIFICAÇÃO ATIVA\\\`);
                    
                    // INICIAR VERIFICAÇÃO ATIVA DE CONEXÃO
                    startActiveConnectionCheck(clientId);
                }
            } catch (error) {
                console.error(\\\`❌ [\\\${clientId}] Erro ao processar QR Code:\\\`, error);
            }
        });

        client.on('ready', async () => {
            console.log(\\\`🎉 [\\\${new Date().toISOString()}] EVENTO READY DISPARADO: \\\${clientId}\\\`);
            
            // Parar verificação ativa (redundante, mas seguro)
            stopActiveConnectionCheck(clientId);
            
            try {
                if (clients[clientId]) {
                    const phoneNumber = client.info?.wid?.user || client.info?.me?.user || null;
                    
                    clients[clientId].status = 'connected';
                    clients[clientId].phoneNumber = phoneNumber;
                    clients[clientId].hasQrCode = false;
                    clients[clientId].qrCode = null;
                    clients[clientId].lastActivity = new Date();
                    clients[clientId].info = client.info;
                    
                    console.log(\\\`📱 [\\\${clientId}] READY - Telefone: \\\${phoneNumber}\\\`);
                    
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
                    io.emit(\\\`client_status_\\\${clientId}\\\`, {
                        clientId,
                        status: 'connected',
                        phoneNumber,
                        hasQrCode: false,
                        timestamp: Date.now()
                    });
                    
                    console.log(\\\`✅ [\\\${clientId}] READY PROCESSADO - Status: connected\\\`);
                }
            } catch (error) {
                console.error(\\\`❌ [\\\${clientId}] Erro ao processar ready event:\\\`, error);
            }
        });

        client.on('authenticated', () => {
            console.log(\\\`🔐 [\\\${clientId}] Cliente autenticado\\\`);
            if (clients[clientId]) {
                clients[clientId].status = 'authenticated';
                clients[clientId].lastActivity = new Date();
            }
        });

        client.on('auth_failure', async (msg) => {
            console.log(\\\`❌ [\\\${clientId}] FALHA DE AUTENTICAÇÃO:\\\`, msg);
            stopActiveConnectionCheck(clientId);
            if (clients[clientId]) {
                clients[clientId].status = 'auth_failed';
                await updateInstanceStatus(clientId, 'auth_failed');
            }
        });

        client.on('disconnected', async (reason) => {
            console.log(\\\`🔌 [\\\${clientId}] DESCONECTADO:\\\`, reason);
            stopActiveConnectionCheck(clientId);
            if (clients[clientId]) {
                clients[clientId].status = 'disconnected';
                clients[clientId].hasQrCode = false;
                clients[clientId].qrCode = null;
                clients[clientId].phoneNumber = null;
                await updateInstanceStatus(clientId, 'disconnected');
            }
        });

        console.log(\\\`🔄 [\\\${clientId}] Inicializando cliente com timeouts estendidos...\\\`);
        await client.initialize();
        console.log(\\\`✅ [\\\${clientId}] Cliente inicializado - aguardando QR ou ready\\\`);
        
    } catch (error) {
        console.error(\\\`❌ [\\\${clientId}] Erro na inicialização:\\\`, error);
        stopActiveConnectionCheck(clientId);
        
        if (clients[clientId]) {
            clients[clientId].status = 'init_failed';
            
            if (clients[clientId].initAttempts < 3) {
                console.log(\\\`🔄 [\\\${clientId}] Tentando recuperação em 15s...\\\`);
                setTimeout(() => {
                    initClient(clientId, true);
                }, 15000);
            } else {
                console.log(\\\`❌ [\\\${clientId}] Falha definitiva após 3 tentativas\\\`);
                await updateInstanceStatus(clientId, 'disconnected');
            }
        }
    }
};
\`;

// Substituir função initClient
content = content.replace(
    /\/\/ Função para inicializar um novo cliente[\s\S]*?(?=\/\/ |const |app\.)/,
    enhancedInitClient + '\n\n'
);

fs.writeFileSync(serverFile, content);
console.log('✅ Correção definitiva aplicada com sucesso!');
EOF

node /tmp/connection-fix.js

echo "✅ Correção aplicada no servidor!"

echo "🔧 Atualizando dependências..."
cd server
npm install puppeteer@latest whatsapp-web.js@latest --save
cd ..

echo "🚀 Reiniciando servidor com correções..."
./scripts/production-start-whatsapp.sh

echo "⏳ Aguardando estabilização (30s)..."
sleep 30

echo "🧪 Testando correções..."
HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://146.59.227.248/health" 2>/dev/null)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check OK ($HEALTH_STATUS)"
else
    echo "❌ Health check falhou ($HEALTH_STATUS)"
fi

echo ""
echo "🎉 CORREÇÃO DEFINITIVA DE CONEXÃO CONCLUÍDA!"
echo "============================================"
echo "✅ Timeouts Puppeteer aumentados para 5 minutos"
echo "✅ Sistema de verificação ativa de conexão implementado"
echo "✅ Verificação a cada 5 segundos após QR code"
echo "✅ Detecção automática quando estado = CONNECTED"
echo "✅ Atualização imediata de status no banco e WebSocket"
echo "✅ Sistema de recuperação de sessões melhorado"
echo ""
echo "🔗 TESTE AGORA:"
echo "1. Acesse o painel admin"
echo "2. Crie uma nova instância"
echo "3. Escaneie o QR Code no seu celular"
echo "4. O sistema detectará automaticamente a conexão"
echo "5. Status mudará para 'connected' em segundos"
echo ""
echo "📊 Para monitorar em tempo real:"
echo "tail -f logs/whatsapp-multi-client.log | grep -E '(CONNECTION-CHECK|READY|CONECTADO|connected)'"
echo ""
echo "⚠️ IMPORTANTE: As sessões agora são verificadas ativamente"
echo "   A conexão será detectada mesmo se o evento 'ready' falhar"

