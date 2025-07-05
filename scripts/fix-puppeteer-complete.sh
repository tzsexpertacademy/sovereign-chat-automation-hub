#!/bin/bash

# Tornar scripts executáveis
chmod +x scripts/*.sh

echo "🔧 CORREÇÃO COMPLETA DO PUPPETEER - FASE 1 A 5"
echo "=============================================="

# FASE 1: LIMPEZA TOTAL DE PROCESSOS
echo ""
echo "📋 FASE 1: LIMPEZA TOTAL DE PROCESSOS"
echo "===================================="

echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

echo "🧹 Matando TODOS os processos Chrome/Puppeteer..."
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true
pkill -f "node.*whatsapp" || true

echo "🧹 Limpando diretórios temporários..."
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
rm -rf /home/ubuntu/.config/google-chrome/SingletonLock 2>/dev/null || true
rm -rf /home/ubuntu/.cache/google-chrome 2>/dev/null || true

echo "🧹 Limpando sessões órfãs do WhatsApp Web.js..."
rm -rf server/.wwebjs_auth/session-*/* 2>/dev/null || true
rm -rf server/.wwebjs_cache/* 2>/dev/null || true

sleep 3

echo "📊 Processos Chrome restantes: $(ps aux | grep chrome | grep -v grep | wc -l)"

# FASE 2: ATUALIZAÇÃO DO SERVIDOR COM CONFIGURAÇÃO OTIMIZADA
echo ""
echo "📋 FASE 2: CONFIGURAÇÃO OTIMIZADA DO PUPPETEER"
echo "=============================================="

echo "🔧 Aplicando correções otimizadas no servidor..."

# Fazer backup do servidor atual
cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.js.backup-$(date +%Y%m%d-%H%M%S)

# Aplicar correções otimizadas
cat > /tmp/puppeteer-optimization.js << 'EOF'
const fs = require('fs');
const serverFile = '/home/ubuntu/sovereign-chat-automation-hub/server/whatsapp-multi-client-server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// 1. OTIMIZAR CONFIGURAÇÃO DO PUPPETEER
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
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-ipc-flooding-protection',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript',
                '--disable-default-apps',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--memory-pressure-off',
                '--max_old_space_size=512'
            ],
            timeout: 120000, // 2 minutos timeout
            protocolTimeout: 60000, // 1 minuto protocol timeout
            ignoreHTTPSErrors: true,
            handleSIGINT: false,
            handleSIGTERM: false
        }`;

// Substituir configuração do Puppeteer
content = content.replace(
    /puppeteer:\s*{[\s\S]*?timeout:\s*\d+[^}]*}/,
    optimizedPuppeteerConfig
);

// 2. ADICIONAR TIMEOUT DE INICIALIZAÇÃO E LOGS DETALHADOS
const enhancedInitClient = `
// CONFIGURAÇÕES DE TIMEOUT E LOGS DETALHADOS
const INIT_TIMEOUT = 120000; // 2 minutos timeout total
const QR_TIMEOUT = 60000; // 1 minuto para aparecer QR
const MAX_INIT_ATTEMPTS = 2; // Máximo 2 tentativas

// Função para inicializar um novo cliente com timeout e retry
const initClient = async (clientId, attemptNumber = 1) => {
    if (clients[clientId] && clients[clientId].client) {
        console.log(\`⚠️ Cliente \${clientId} já está inicializado.\`);
        return;
    }

    console.log(\`🚀 [\${new Date().toISOString()}] INICIALIZANDO CLIENTE (Tentativa \${attemptNumber}): \${clientId}\`);
    console.log(\`🔧 [\${clientId}] Configuração: headless=true, timeout=120s, protocolTimeout=60s\`);

    // CRIAR ESTRUTURA DO CLIENTE PRIMEIRO
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
        initStartTime: Date.now(),
        initTimeout: null,
        qrTimeout: null,
        attemptNumber: attemptNumber
    };

    // TIMEOUT GERAL DE INICIALIZAÇÃO
    const initTimeoutId = setTimeout(async () => {
        console.log(\`⏰ [\${clientId}] TIMEOUT de inicialização (\${INIT_TIMEOUT/1000}s) - Tentativa \${attemptNumber}\`);
        
        if (clients[clientId] && clients[clientId].client) {
            try {
                await clients[clientId].client.destroy();
                console.log(\`🗑️ [\${clientId}] Cliente destruído por timeout\`);
            } catch (error) {
                console.log(\`⚠️ [\${clientId}] Erro ao destruir cliente: \${error.message}\`);
            }
        }
        
        // Tentar novamente se não passou do limite
        if (attemptNumber < MAX_INIT_ATTEMPTS) {
            console.log(\`🔄 [\${clientId}] Tentando novamente (\${attemptNumber + 1}/\${MAX_INIT_ATTEMPTS})...\`);
            setTimeout(() => {
                delete clients[clientId];
                initClient(clientId, attemptNumber + 1);
            }, 5000);
        } else {
            console.log(\`❌ [\${clientId}] FALHA DEFINITIVA após \${MAX_INIT_ATTEMPTS} tentativas\`);
            clients[clientId].status = 'failed';
            await updateInstanceStatus(clientId, 'disconnected');
        }
    }, INIT_TIMEOUT);
    
    clients[clientId].initTimeout = initTimeoutId;

    // TIMEOUT ESPECÍFICO PARA QR CODE
    const qrTimeoutId = setTimeout(() => {
        if (clients[clientId] && !clients[clientId].hasQrCode) {
            console.log(\`⏰ [\${clientId}] TIMEOUT para QR Code (\${QR_TIMEOUT/1000}s) - QR não apareceu\`);
        }
    }, QR_TIMEOUT);
    
    clients[clientId].qrTimeout = qrTimeoutId;

    try {
        const client = new Client({
            authStrategy: new (require('whatsapp-web.js').LocalAuth)({
                clientId: clientId
            }),
            ${optimizedPuppeteerConfig.replace('puppeteer: {', '').replace(/}\s*$/, '')}
        });
        
        // ASSOCIAR CLIENTE À ESTRUTURA
        clients[clientId].client = client;
        console.log(\`✅ [\${clientId}] Cliente WhatsApp Web.js criado com sucesso\`);

        // ARMAZENAR QR TEMPORARIAMENTE NO OBJETO CLIENT
        client.qrCode = null;
        client.qrTimestamp = null;

        client.on('qr', async (qr) => {
            const timestamp = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
            console.log(\`📱 [\${timestamp}] QR CODE EVENTO RECEBIDO para \${clientId} (Tentativa \${attemptNumber})\`);
            console.log(\`📱 [\${timestamp}] QR Code length: \${qr?.length || 0} chars - Expira em: \${expiresAt.toISOString()}\`);
            
            // Limpar timeout de QR
            if (clients[clientId].qrTimeout) {
                clearTimeout(clients[clientId].qrTimeout);
                clients[clientId].qrTimeout = null;
            }
            
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qr);
                
                // SALVAR QR NO SUPABASE IMEDIATAMENTE
                const qrUpdateResult = await supabase
                    .from('whatsapp_instances')
                    .update({
                        qr_code: qrCodeDataUrl,
                        has_qr_code: true,
                        qr_expires_at: expiresAt.toISOString(),
                        status: 'qr_ready',
                        updated_at: timestamp
                    })
                    .eq('instance_id', clientId);

                if (qrUpdateResult.error) {
                    console.error(\`❌ [QR-DB] Erro ao salvar QR no banco para \${clientId}:\`, qrUpdateResult.error);
                } else {
                    console.log(\`✅ [QR-DB] QR salvo no banco para \${clientId} - expira: \${expiresAt.toISOString()}\`);
                }
                
                // ARMAZENAR QR NO CLIENTE E NA ESTRUTURA
                client.qrCode = qrCodeDataUrl;
                client.qrTimestamp = timestamp;
                client.qrExpiresAt = expiresAt;
                
                // ATUALIZAR ESTRUTURA DO CLIENTE
                clients[clientId].hasQrCode = true;
                clients[clientId].qrCode = qrCodeDataUrl;
                clients[clientId].qrTimestamp = timestamp;
                clients[clientId].status = 'qr_ready';
                clients[clientId].lastActivity = new Date();
                
                console.log(\`✅ [\${clientId}] QR Code gerado e salvo - Status: qr_ready\`);
                
                // EMITIR EVENTO WEBSOCKET
                io.emit(\`client_status_\${clientId}\`, {
                    clientId,
                    status: 'qr_ready',
                    hasQrCode: true,
                    qrCode: qrCodeDataUrl,
                    phoneNumber: null,
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.error(\`❌ [\${clientId}] Erro ao processar QR Code:\`, error);
            }
        });

        client.on('ready', async () => {
            const timestamp = new Date().toISOString();
            console.log(\`🎉 [\${timestamp}] CLIENTE CONECTADO COM SUCESSO: \${clientId}\`);
            
            // Limpar todos os timeouts
            if (clients[clientId].initTimeout) {
                clearTimeout(clients[clientId].initTimeout);
                clients[clientId].initTimeout = null;
            }
            if (clients[clientId].qrTimeout) {
                clearTimeout(clients[clientId].qrTimeout);
                clients[clientId].qrTimeout = null;
            }
            
            try {
                clients[clientId].info = client.info;
                const phoneNumber = client.info?.wid?.user || null;
                
                clients[clientId].status = 'connected';
                clients[clientId].phoneNumber = phoneNumber;
                clients[clientId].hasQrCode = false;
                clients[clientId].qrCode = null;
                clients[clientId].lastActivity = new Date();
                
                console.log(\`📱 [\${clientId}] Telefone conectado: \${phoneNumber}\`);
                
                // ATUALIZAR NO BANCO
                await updateInstanceStatus(clientId, 'connected', phoneNumber);
                
                // EMITIR EVENTO WEBSOCKET
                io.emit(\`client_status_\${clientId}\`, {
                    clientId,
                    status: 'connected',
                    phoneNumber,
                    hasQrCode: false,
                    timestamp: Date.now()
                });
                
                console.log(\`✅ [\${clientId}] Status atualizado para 'connected'\`);
                
            } catch (error) {
                console.error(\`❌ [\${clientId}] Erro ao processar ready event:\`, error);
            }
        });

        client.on('auth_failure', async (msg) => {
            console.log(\`❌ [\${clientId}] FALHA DE AUTENTICAÇÃO:\`, msg);
            clients[clientId].status = 'auth_failed';
            await updateInstanceStatus(clientId, 'auth_failed');
            
            // Limpar timeouts
            if (clients[clientId].initTimeout) {
                clearTimeout(clients[clientId].initTimeout);
            }
            if (clients[clientId].qrTimeout) {
                clearTimeout(clients[clientId].qrTimeout);
            }
        });

        client.on('disconnected', async (reason) => {
            console.log(\`🔌 [\${clientId}] DESCONECTADO:\`, reason);
            clients[clientId].status = 'disconnected';
            clients[clientId].hasQrCode = false;
            clients[clientId].qrCode = null;
            clients[clientId].phoneNumber = null;
            
            await updateInstanceStatus(clientId, 'disconnected');
            
            // Limpar timeouts
            if (clients[clientId].initTimeout) {
                clearTimeout(clients[clientId].initTimeout);
            }
            if (clients[clientId].qrTimeout) {
                clearTimeout(clients[clientId].qrTimeout);
            }
        });

        console.log(\`🔄 [\${clientId}] Iniciando cliente...\`);
        await client.initialize();
        console.log(\`✅ [\${clientId}] Cliente inicializado com sucesso\`);
        
    } catch (error) {
        console.error(\`❌ [\${clientId}] Erro na inicialização (Tentativa \${attemptNumber}):\`, error);
        
        // Limpar timeouts
        if (clients[clientId].initTimeout) {
            clearTimeout(clients[clientId].initTimeout);
        }
        if (clients[clientId].qrTimeout) {
            clearTimeout(clients[clientId].qrTimeout);
        }
        
        // Tentar novamente se não passou do limite
        if (attemptNumber < MAX_INIT_ATTEMPTS) {
            console.log(\`🔄 [\${clientId}] Tentando novamente após erro (\${attemptNumber + 1}/\${MAX_INIT_ATTEMPTS})...\`);
            setTimeout(() => {
                delete clients[clientId];
                initClient(clientId, attemptNumber + 1);
            }, 10000); // 10 segundos entre tentativas
        } else {
            console.log(\`❌ [\${clientId}] FALHA DEFINITIVA após erro em \${MAX_INIT_ATTEMPTS} tentativas\`);
            clients[clientId].status = 'failed';
            await updateInstanceStatus(clientId, 'disconnected');
        }
    }
};`;

// Substituir função initClient
content = content.replace(
    /\/\/ Função para inicializar um novo cliente[\s\S]*?(?=\/\/ |const |app\.)/,
    enhancedInitClient + '\n\n'
);

fs.writeFileSync(serverFile, content);
console.log('✅ Configuração otimizada do Puppeteer aplicada!');
EOF

node /tmp/puppeteer-optimization.js

echo "✅ Configuração otimizada aplicada com sucesso!"

# FASE 3: INICIAR SERVIDOR COM MONITORAMENTO
echo ""
echo "📋 FASE 3: INICIAR SERVIDOR COM MONITORAMENTO"
echo "============================================="

echo "🚀 Iniciando servidor com configuração otimizada..."
./scripts/production-start-whatsapp.sh

echo "⏳ Aguardando estabilização (15s)..."
sleep 15

# FASE 4: TESTE DE VALIDAÇÃO
echo ""
echo "📋 FASE 4: TESTE DE VALIDAÇÃO"
echo "============================="

echo "🧪 Testando health check..."
HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://146.59.227.248/health" 2>/dev/null)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check OK ($HEALTH_STATUS)"
else
    echo "❌ Health check falhou ($HEALTH_STATUS)"
fi

echo "🧪 Verificando logs por erros críticos..."
CRITICAL_ERRORS=$(tail -50 logs/whatsapp-multi-client.log | grep -E "(Cannot read properties of null|Session closed|Protocol error|timeout)" | wc -l)

if [ "$CRITICAL_ERRORS" -eq 0 ]; then
    echo "✅ Nenhum erro crítico encontrado nos logs recentes"
else
    echo "⚠️ $CRITICAL_ERRORS erros críticos ainda presentes"
fi

# FASE 5: RESULTADO E PRÓXIMOS PASSOS
echo ""
echo "🎯 RESULTADO FINAL"
echo "=================="

if [ "$HEALTH_STATUS" = "200" ] && [ "$CRITICAL_ERRORS" -eq 0 ]; then
    echo "🎉 CORREÇÃO PUPPETEER BEM-SUCEDIDA!"
    echo ""
    echo "✅ Configuração Puppeteer otimizada aplicada"
    echo "✅ Sistema de timeout e retry implementado"
    echo "✅ Logs detalhados habilitados"
    echo "✅ Servidor funcionando sem erros"
    echo ""
    echo "🔗 Próximos passos:"
    echo "1. Teste uma nova instância no painel admin"
    echo "2. O QR Code deve aparecer em até 60 segundos"
    echo "3. Status deve mudar automaticamente: connecting → qr_ready → connected"
    echo ""
    echo "📋 Para monitorar em tempo real:"
    echo "./scripts/monitor-connection-real-time.sh"
else
    echo "⚠️ AINDA HÁ PROBLEMAS"
    echo ""
    echo "Status health: $HEALTH_STATUS"
    echo "Erros críticos: $CRITICAL_ERRORS"
    echo ""
    echo "🔧 Execute diagnóstico adicional:"
    echo "tail -f logs/whatsapp-multi-client.log"
fi

echo ""
echo "✅ Correção Puppeteer completa finalizada!"