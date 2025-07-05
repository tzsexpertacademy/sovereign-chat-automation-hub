const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: false
    }
});

const port = process.env.PORT || 4000;

// CONFIGURAÇÃO SUPABASE PARA ATUALIZAÇÃO DO BANCO
const supabaseUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI';
const supabase = createClient(supabaseUrl, supabaseKey);

// FUNÇÃO PARA CARREGAR INSTÂNCIAS EXISTENTES DO SUPABASE
const loadExistingInstances = async () => {
    console.log('🔄 [SYNC] Carregando instâncias existentes do Supabase...');
    
    try {
        const { data: instances, error } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ [SYNC] Erro ao carregar instâncias:', error);
            return { success: false, instances: [] };
        }
        
        console.log(`📊 [SYNC] Encontradas ${instances?.length || 0} instâncias no banco`);
        
        for (const instance of instances || []) {
            const { instance_id, status, custom_name, phone_number } = instance;
            
            console.log(`📋 [SYNC] Instância ${instance_id}: status=${status}, name=${custom_name}, phone=${phone_number}`);
            
            // Verificar se já existe no servidor
            if (!clients[instance_id]) {
                console.log(`🔄 [SYNC] Inicializando cliente ${instance_id} do banco...`);
                
                // Inicializar estrutura do cliente sem conectar automaticamente
                clients[instance_id] = {
                    id: instance_id,
                    client: null,
                    status: 'disconnected',
                    phoneNumber: phone_number || null,
                    hasQrCode: false,
                    qrCode: null,
                    timestamp: new Date().toISOString(),
                    qrTimestamp: null,
                    lastActivity: new Date(),
                    customName: custom_name || null,
                    fromDatabase: true,
                    needsReconnect: status === 'connected' || status === 'qr_ready'
                };
                
                console.log(`✅ [SYNC] Cliente ${instance_id} carregado do banco (status=${status})`);
            } else {
                console.log(`ℹ️ [SYNC] Cliente ${instance_id} já existe no servidor`);
            }
        }
        
        return { success: true, instances: instances || [] };
    } catch (error) {
        console.error('❌ [SYNC] Erro crítico ao carregar instâncias:', error);
        return { success: false, instances: [] };
    }
};

// FUNÇÃO PARA SINCRONIZAR ESTADO COM BANCO
const syncWithDatabase = async () => {
    console.log('🔄 [SYNC] Executando sincronização completa...');
    
    try {
        // Buscar instâncias do banco
        const { data: dbInstances, error } = await supabase
            .from('whatsapp_instances')
            .select('*');
        
        if (error) {
            console.error('❌ [SYNC] Erro na sincronização:', error);
            return false;
        }
        
        const dbInstanceIds = new Set(dbInstances?.map(i => i.instance_id) || []);
        const serverInstanceIds = new Set(Object.keys(clients));
        
        console.log(`📊 [SYNC] Banco: ${dbInstanceIds.size} instâncias | Servidor: ${serverInstanceIds.size} instâncias`);
        
        // Instâncias no banco mas não no servidor
        const missingInServer = [...dbInstanceIds].filter(id => !serverInstanceIds.has(id));
        console.log(`📥 [SYNC] ${missingInServer.length} instâncias faltando no servidor:`, missingInServer);
        
        // Instâncias no servidor mas não no banco
        const missingInDatabase = [...serverInstanceIds].filter(id => !dbInstanceIds.has(id));
        console.log(`📤 [SYNC] ${missingInDatabase.length} instâncias faltando no banco:`, missingInDatabase);
        
        // Carregar instâncias faltantes no servidor
        for (const instanceId of missingInServer) {
            const dbInstance = dbInstances.find(i => i.instance_id === instanceId);
            if (dbInstance) {
                clients[instanceId] = {
                    id: instanceId,
                    client: null,
                    status: 'disconnected',
                    phoneNumber: dbInstance.phone_number || null,
                    hasQrCode: false,
                    qrCode: null,
                    timestamp: new Date().toISOString(),
                    qrTimestamp: null,
                    lastActivity: new Date(),
                    customName: dbInstance.custom_name || null,
                    fromDatabase: true,
                    needsReconnect: dbInstance.status === 'connected' || dbInstance.status === 'qr_ready'
                };
                console.log(`✅ [SYNC] Adicionada instância ${instanceId} do banco`);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ [SYNC] Erro crítico na sincronização:', error);
        return false;
    }
};

// FUNÇÃO PARA ATUALIZAR STATUS NO BANCO SUPABASE - MELHORADA
const updateInstanceStatus = async (instanceId, status, phoneNumber = null, retryCount = 0) => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 segundo
    
    try {
        console.log(`💾 [UPDATE-DB] Tentativa ${retryCount + 1}/${maxRetries + 1} - Atualizando ${instanceId}: status=${status}, phone=${phoneNumber}`);
        
        const updateData = {
            status: status,
            updated_at: new Date().toISOString()
        };
        
        // Adicionar phone_number se fornecido
        if (phoneNumber) {
            updateData.phone_number = phoneNumber;
        }
        
        // Adicionar campos QR baseado no status
        if (status === 'qr_ready') {
            updateData.has_qr_code = true;
        } else if (status === 'connected') {
            updateData.has_qr_code = false;
            updateData.qr_code = null;
        }
        
        const { data, error } = await supabase
            .from('whatsapp_instances')
            .update(updateData)
            .eq('instance_id', instanceId);
            
        if (error) {
            console.error(`❌ [UPDATE-DB] Erro tentativa ${retryCount + 1} - ${instanceId}:`, error);
            
            // Retry com exponential backoff
            if (retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                console.log(`🔄 [UPDATE-DB] Retry em ${delay}ms para ${instanceId}`);
                
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(updateInstanceStatus(instanceId, status, phoneNumber, retryCount + 1));
                    }, delay);
                });
            } else {
                console.error(`❌ [UPDATE-DB] FALHA DEFINITIVA após ${maxRetries + 1} tentativas para ${instanceId}`);
                throw error;
            }
        } else {
            console.log(`✅ [UPDATE-DB] Sucesso tentativa ${retryCount + 1} - ${instanceId} -> ${status}`);
            
            // VERIFICAR SE UPDATE FOI APLICADO
            const { data: verification, error: verifyError } = await supabase
                .from('whatsapp_instances')
                .select('status, phone_number, updated_at')
                .eq('instance_id', instanceId)
                .single();
                
            if (verification && !verifyError) {
                console.log(`🔍 [UPDATE-DB] Verificação ${instanceId}: DB status=${verification.status}, phone=${verification.phone_number}`);
            }
        }
        
        return { success: !error, data, error };
    } catch (error) {
        console.error(`❌ [UPDATE-DB] Erro crítico tentativa ${retryCount + 1} - ${instanceId}:`, error);
        
        // Retry com exponential backoff
        if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.log(`🔄 [UPDATE-DB] Retry crítico em ${delay}ms para ${instanceId}`);
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(updateInstanceStatus(instanceId, status, phoneNumber, retryCount + 1));
                }, delay);
            });
        } else {
            console.error(`❌ [UPDATE-DB] FALHA CRÍTICA DEFINITIVA após ${maxRetries + 1} tentativas para ${instanceId}`);
            return { success: false, error };
        }
    }
};

// CORS REMOVIDO - NGINX VAI CONFIGURAR
console.log('🔧 CORS removido do Node.js - Nginx vai configurar...');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MIDDLEWARE PARA UPLOAD DE ARQUIVOS
const fileUpload = require('express-fileupload');
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    createParentPath: true
}));

// Configuração do Swagger UI para HTTPS
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'WhatsApp Multi-Client API',
        version: '2.2.3',
        description: 'API para gerenciar múltiplas instâncias do WhatsApp com CORS ÚNICO definitivo'
    },
    servers: [
        {
            url: 'https://146.59.227.248',
            description: 'Servidor HTTPS de Produção com CORS ÚNICO'
        },
        {
            url: 'http://localhost:4000',
            description: 'Servidor de Desenvolvimento'
        }
    ],
    paths: {
        '/health': {
            get: {
                summary: 'Health Check',
                responses: {
                    '200': {
                        description: 'Status do servidor'
                    }
                }
            }
        },
        '/clients': {
            get: {
                summary: 'Listar todos os clientes',
                responses: {
                    '200': {
                        description: 'Lista de clientes'
                    }
                }
            }
        },
        '/clients/{clientId}/connect': {
            post: {
                summary: 'Conectar cliente WhatsApp',
                parameters: [
                    {
                        name: 'clientId',
                        in: 'path',
                        required: true,
                        schema: {
                            type: 'string'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Cliente conectando com CORS ÚNICO'
                    }
                }
            }
        },
        '/clients/{clientId}/status': {
            get: {
                summary: 'Status do cliente',
                parameters: [
                    {
                        name: 'clientId',
                        in: 'path',
                        required: true,
                        schema: {
                            type: 'string'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Status do cliente com QR Code se disponível'
                    }
                }
            }
        }
    }
};

// Swagger UI com configuração HTTPS definitiva
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'WhatsApp Multi-Client API - CORS ÚNICO',
    swaggerOptions: {
        url: 'https://146.59.227.248/api-docs.json'
    }
}));

// Endpoint para servir o JSON do Swagger
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDocument);
});

// Authentication is now handled by LocalAuth - no need for session files
console.log('🔧 Usando LocalAuth - sistema de autenticação moderno iniciado');

const clients = {};

// Função para limpar processos Chrome órfãos
const cleanupOrphanedChromeProcesses = () => {
    console.log('🧹 Limpando processos Chrome órfãos...');
    const { exec } = require('child_process');
    
    exec('pkill -f "chrome.*--remote-debugging-port"', (error) => {
        if (error && error.code !== 1) { // code 1 = no processes found, which is OK
            console.warn('⚠️ Erro ao limpar Chrome:', error.message);
        } else {
            console.log('✅ Processos Chrome órfãos limpos');
        }
    });
};

// Função para emitir atualização de todos os clientes
const emitClientsUpdate = () => {
    const clientList = Object.keys(clients).map(clientId => {
        const client = clients[clientId];
        const isConnected = client.info?.wid;
        return {
            clientId: clientId,
            status: isConnected ? 'connected' : 'connecting',
            phoneNumber: isConnected ? phoneNumberFormatter(client.info.wid.user) : null,
            hasQrCode: false
        };
    });
    
    io.emit('clients_update', clientList);
    console.log(`📡 Clientes atualizados enviados via WebSocket: ${clientList.length} clientes`);
};

const phoneNumberFormatter = function(number) {
    let formatted = number.replace(/\D/g, '');
    
    if (formatted.startsWith('0')) {
        formatted = '55' + formatted;
    }
    
    if (!formatted.endsWith('@c.us')) {
        formatted += '@c.us';
    }
    
    return formatted;
};


// Função para inicializar um novo cliente
const initClient = (clientId) => {
    if (clients[clientId] && clients[clientId].client) {
        console.log(`⚠️ Cliente ${clientId} já está inicializado.`);
        return;
    }

    console.log(`🚀 [${new Date().toISOString()}] INICIALIZANDO CLIENTE: ${clientId}`);

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
        info: null
    };

    const client = new Client({
        authStrategy: new (require('whatsapp-web.js').LocalAuth)({
            clientId: clientId
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            timeout: 120000 // 120 segundos timeout
        }
    });
    
    // ASSOCIAR CLIENTE À ESTRUTURA
    clients[clientId].client = client;

    // ARMAZENAR QR TEMPORARIAMENTE NO OBJETO CLIENT
    client.qrCode = null;
    client.qrTimestamp = null;

    client.on('qr', async (qr) => {
        const timestamp = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
        console.log(`📱 [${timestamp}] QR CODE EVENTO RECEBIDO para ${clientId}`);
        console.log(`📱 [${timestamp}] QR Code length: ${qr?.length || 0} chars - Expira em: ${expiresAt.toISOString()}`);
        
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
                console.error(`❌ [QR-DB] Erro ao salvar QR no banco para ${clientId}:`, qrUpdateResult.error);
            } else {
                console.log(`✅ [QR-DB] QR salvo no banco para ${clientId} - expira: ${expiresAt.toISOString()}`);
            }
            
            // ARMAZENAR QR NO CLIENTE E NA ESTRUTURA
            client.qrCode = qrCodeDataUrl;
            client.qrTimestamp = timestamp;
            client.qrExpiresAt = expiresAt;
            
            if (clients[clientId]) {
                clients[clientId].qrCode = qrCodeDataUrl;
                clients[clientId].qrTimestamp = timestamp;
                clients[clientId].qrExpiresAt = expiresAt;
                clients[clientId].hasQrCode = true;
                clients[clientId].status = 'qr_ready';
            }
            
            console.log(`📱 [${timestamp}] QR Code gerado DATA URL length: ${qrCodeDataUrl?.length || 0}`);
            
            // EMITIR PARA SALA ESPECÍFICA DO CLIENTE
            io.to(clientId).emit(`client_status_${clientId}`, { 
                clientId: clientId, 
                status: 'qr_ready', 
                qrCode: qrCodeDataUrl,
                hasQrCode: true,
                timestamp: timestamp,
                qrExpiresAt: expiresAt.toISOString()
            });
            
            // EMITIR TAMBÉM GERAL COMO BACKUP
            io.emit(`client_status_${clientId}`, { 
                clientId: clientId, 
                status: 'qr_ready',
                qrCode: qrCodeDataUrl,
                hasQrCode: true,
                timestamp: timestamp
            });
            
            console.log(`✅ [${timestamp}] QR Code ENVIADO VIA WEBSOCKET para sala: ${clientId}`);
            console.log(`✅ [${timestamp}] Clientes na sala ${clientId}: ${io.sockets.adapter.rooms.get(clientId)?.size || 0}`);
            
            // ATUALIZAR BANCO COM STATUS QR_READY
            await updateInstanceStatus(clientId, 'qr_ready');
            
        } catch (error) {
            console.error(`❌ [${timestamp}] ERRO ao gerar QR Code para ${clientId}:`, error);
        }
    });

    client.on('authenticated', async () => {
        const timestamp = new Date().toISOString();
        console.log(`🎉 [${timestamp}] ====== EVENTO AUTHENTICATED DISPARADO para ${clientId} ======`);
        console.log(`✅ [${timestamp}] Cliente ${clientId} AUTENTICADO - aguardando ready...`);
        
        // PARAR AUTO-RECOVERY TEMPORARIAMENTE PARA DAR ESPAÇO AO PROCESSO
        if (client.autoRecoveryInterval) {
            clearInterval(client.autoRecoveryInterval);
            client.autoRecoveryInterval = null;
            console.log(`⏸️ [${timestamp}] Auto-recovery pausado para ${clientId} durante authenticated`);
        }
        
        // MARCAR COMO PROCESSADO PARA EVITAR DUPLICAÇÕES
        if (client.authenticatedProcessed) {
            console.log(`⚠️ [${timestamp}] Authenticated já processado para ${clientId}`);
            return;
        }
        client.authenticatedProcessed = true;
        
        // ATUALIZAR STATUS IMEDIATAMENTE
        if (clients[clientId]) {
            clients[clientId].status = 'authenticated';
        }
        
        // EMITIR STATUS AUTHENTICATED
        const authStatusData = { 
            clientId: clientId, 
            status: 'authenticated',
            phoneNumber: null,
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        };
        
        io.to(clientId).emit(`client_status_${clientId}`, authStatusData);
        console.log(`📡 [${timestamp}] Status AUTHENTICATED enviado para ${clientId}`);
        
        // ATUALIZAR BANCO
        await updateInstanceStatus(clientId, 'authenticated');
        
        console.log(`🔄 [${timestamp}] Aguardando evento READY para finalizar conexão...`);
    });

    // ===== FASE 1: SISTEMA DE VERIFICAÇÃO DE SAÚDE DAS SESSÕES =====
    const isSessionHealthy = (client) => {
        try {
            // Verificar se o cliente existe e tem página ativa
            if (!client || !client.pupPage) {
                return false;
            }
            
            // Verificar se a página não foi fechada
            if (client.pupPage.isClosed && client.pupPage.isClosed()) {
                return false;
            }
            
            // Verificar se ainda tem contexto de execução
            if (!client.pupPage.mainFrame) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.log(`⚠️ Erro ao verificar saúde da sessão: ${error.message}`);
            return false;
        }
    };

    // ===== FASE 2: SISTEMA DE DETECÇÃO ATIVA COM MÚLTIPLAS FONTES =====
    const getClientStatus = async (client) => {
        try {
            // Fonte 1: Verificar info.wid (mais confiável)
            if (client.info && client.info.wid) {
                return { status: 'connected', phoneNumber: client.info.wid.user };
            }
            
            // Fonte 2: Verificar getState apenas se sessão está saudável
            if (isSessionHealthy(client)) {
                try {
                    const state = await client.getState();
                    if (state === 'CONNECTED') {
                        return { status: 'connected', phoneNumber: null };
                    }
                } catch (stateError) {
                    console.log(`⚠️ Erro ao chamar getState (esperado se sessão fechou): ${stateError.message}`);
                }
            }
            
            // Fonte 3: Verificar authStrategy
            if (client.authStrategy && client.authStrategy.authenticated) {
                return { status: 'authenticated', phoneNumber: null };
            }
            
            // Fonte 4: Verificar se tem QR code armazenado
            if (client.qrCode) {
                return { status: 'qr_ready', phoneNumber: null };
            }
            
            return { status: 'connecting', phoneNumber: null };
        } catch (error) {
            console.log(`⚠️ Erro geral na detecção de status: ${error.message}`);
            return { status: 'error', phoneNumber: null };
        }
    };

    // ===== FASE 3: SISTEMA DE RECUPERAÇÃO AUTOMÁTICA =====
    const autoRecoverySystem = async () => {
        try {
            // Verificar se o cliente ainda deve existir
            if (!clients[clientId]) {
                console.log(`🗑️ Auto-recovery parado - cliente ${clientId} foi removido`);
                return true; // Parar sistema
            }

            const statusResult = await getClientStatus(client);
            const timestamp = new Date().toISOString();
            
            console.log(`🔍 [${timestamp}] Auto-recovery check ${clientId}: ${statusResult.status}`);

            // DETECTAR CONEXÃO ESTABELECIDA
            if (statusResult.status === 'connected' && !client.manuallyConnected) {
                client.manuallyConnected = true;
                
                const phoneNumber = statusResult.phoneNumber ? phoneNumberFormatter(statusResult.phoneNumber) : null;
                console.log(`🎉 [${timestamp}] CONEXÃO DETECTADA via auto-recovery: ${clientId}, phone=${phoneNumber}`);
                
                // LIMPAR QR CODE APÓS CONEXÃO CONFIRMADA
                client.qrCode = null;
                client.qrTimestamp = null;
                client.qrExpiresAt = null;
                
                const statusData = { 
                    clientId: clientId, 
                    status: 'connected',
                    phoneNumber: phoneNumber,
                    hasQrCode: false,
                    qrCode: null,
                    timestamp: timestamp
                };
                
                // EMITIR STATUS CONNECTED
                io.to(clientId).emit(`client_status_${clientId}`, statusData);
                io.emit(`client_status_${clientId}`, statusData);
                
                console.log(`📡 [${timestamp}] Status CONNECTED enviado via AUTO-RECOVERY para ${clientId}`);
                
                // ATUALIZAR BANCO
                try {
                    await updateInstanceStatus(clientId, 'connected', phoneNumber);
                    console.log(`✅ [${timestamp}] Banco atualizado via auto-recovery para ${clientId}`);
                } catch (error) {
                    console.error(`❌ Erro ao atualizar banco via auto-recovery:`, error);
                }
                
                return true; // Parar sistema - conexão estabelecida
            }
            
            // DETECTAR SESSÃO MORTA - IMPLEMENTAR RECUPERAÇÃO
            if (statusResult.status === 'error' || !isSessionHealthy(client)) {
                console.log(`⚠️ [${timestamp}] Sessão morta detectada para ${clientId} - tentando recuperação`);
                
                // Increment recovery attempts
                client.recoveryAttempts = (client.recoveryAttempts || 0) + 1;
                
                if (client.recoveryAttempts <= 2) { // Máximo 2 tentativas
                    console.log(`🔄 [${timestamp}] Tentativa de recuperação ${client.recoveryAttempts}/2 para ${clientId}`);
                    
                    try {
                        // Destruir cliente atual
                        client.destroy();
                        delete clients[clientId];
                        
                        // Aguardar e reinicializar
                        setTimeout(() => {
                            console.log(`🚀 [${timestamp}] Reinicializando cliente ${clientId} após recuperação`);
                            initClient(clientId);
                        }, 3000);
                        
                        return true; // Parar este sistema - novo será criado
                    } catch (recoveryError) {
                        console.error(`❌ Erro na recuperação de ${clientId}:`, recoveryError);
                    }
                } else {
                    console.log(`❌ [${timestamp}] Máximo de tentativas de recuperação atingido para ${clientId}`);
                    
                    // Marcar como falha definitiva
                    await updateInstanceStatus(clientId, 'error');
                    
                    const errorStatusData = { 
                        clientId: clientId, 
                        status: 'error',
                        phoneNumber: null,
                        hasQrCode: false,
                        qrCode: null,
                        timestamp: timestamp
                    };
                    
                    io.to(clientId).emit(`client_status_${clientId}`, errorStatusData);
                    io.emit(`client_status_${clientId}`, errorStatusData);
                    
                    return true; // Parar sistema
                }
            }
            
            return false; // Continuar verificando
        } catch (error) {
            console.error(`❌ Erro no sistema de auto-recovery:`, error);
            return false; // Continuar tentando
        }
    };

    // INICIAR SISTEMA DE AUTO-RECOVERY (REDUZIDO)
    const recoveryInterval = setInterval(async () => {
        const shouldStop = await autoRecoverySystem();
        if (shouldStop) {
            clearInterval(recoveryInterval);
            console.log(`✅ Sistema de auto-recovery finalizado para ${clientId}`);
        }
    }, 15000); // Verificar a cada 15 segundos - menos intrusivo

    // Limpar sistema quando cliente for removido
    client.autoRecoveryInterval = recoveryInterval;

    client.on('auth_failure', async function (session) {
        console.error(`❌ Falha de autenticação para ${clientId}`);
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'auth_failed',
            hasQrCode: false
        });
        
        // ATUALIZAR BANCO PARA STATUS AUTH_FAILED
        try {
            await updateInstanceStatus(clientId, 'auth_failed');
        } catch (error) {
            console.error(`❌ Erro ao atualizar banco para auth_failed ${clientId}:`, error);
        }
    });

    client.on('ready', async () => {
        const timestamp = new Date().toISOString();
        const phoneNumber = client.info?.wid?.user ? phoneNumberFormatter(client.info.wid.user) : null;
        
        console.log(`🎉 [${timestamp}] ====== EVENTO READY DISPARADO para ${clientId} ======`);
        console.log(`🎉 [${timestamp}] Cliente ${clientId} READY! Telefone: ${phoneNumber}`);
        console.log(`🔍 [${timestamp}] Dados do cliente - WID: ${client.info?.wid ? 'Presente' : 'Ausente'}`);
        
        // PARAR AUTO-RECOVERY DEFINITIVAMENTE - CONEXÃO ESTABELECIDA
        if (client.autoRecoveryInterval) {
            clearInterval(client.autoRecoveryInterval);
            client.autoRecoveryInterval = null;
            console.log(`✅ [${timestamp}] Auto-recovery finalizado para ${clientId} - conexão estabelecida`);
        }
        
        // VERIFICAR SE JÁ FOI PROCESSADO
        if (client.connectedProcessed) {
            console.log(`⚠️ [${timestamp}] READY já processado para ${clientId}`);
            return;
        }
        client.connectedProcessed = true;
        
        // LIMPAR QR CODE APÓS CONEXÃO CONFIRMADA (READY)
        client.qrCode = null;
        client.qrTimestamp = null;
        client.qrExpiresAt = null;
        
        // ATUALIZAR SUPABASE PARA LIMPAR QR CODE
        await supabase
            .from('whatsapp_instances')
            .update({
                qr_code: null,
                has_qr_code: false,
                qr_expires_at: null,
                status: 'connected',
                phone_number: phoneNumber,
                updated_at: timestamp
            })
            .eq('instance_id', clientId);
        
        const statusData = { 
            clientId: clientId, 
            status: 'connected',
            phoneNumber: phoneNumber,
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        };
        
        console.log(`📡 [${timestamp}] Enviando status CONNECTED para ${clientId}:`, statusData);
        
        // EMITIR PARA SALA ESPECÍFICA COM CONFIRMAÇÃO
        io.to(clientId).emit(`client_status_${clientId}`, statusData);
        console.log(`✅ [${timestamp}] Evento enviado para sala ${clientId} - clientes na sala: ${io.sockets.adapter.rooms.get(clientId)?.size || 0}`);
        
        // ATUALIZAR ESTRUTURA LOCAL
        if (clients[clientId]) {
            clients[clientId].status = 'connected';
            clients[clientId].phoneNumber = phoneNumber;
            clients[clientId].hasQrCode = false;
            clients[clientId].qrCode = null;
        }
        
        console.log(`🎉 [${timestamp}] ====== CONEXÃO ${clientId} FINALIZADA COM SUCESSO ======`);
    });

    client.on('disconnected', async (reason) => {
        const timestamp = new Date().toISOString();
        console.log(`🔌 [${timestamp}] ====== DISCONNECTED para ${clientId} ======`);
        console.log(`🔌 [${timestamp}] Motivo: ${reason}`);
        
        if (clients[clientId]) {
            clients[clientId].status = 'disconnected';
        }
        
        const disconnectedData = { 
            clientId: clientId, 
            status: 'disconnected',
            phoneNumber: null,
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        };
        
        io.to(clientId).emit(`client_status_${clientId}`, disconnectedData);
        await updateInstanceStatus(clientId, 'disconnected');
    });

    client.on('loading_screen', (percent, message) => {
        const timestamp = new Date().toISOString();
        console.log(`⏳ [${timestamp}] LOADING ${clientId}: ${percent}% - ${message}`);
    });

    client.on('message', msg => {
        console.log(`📩 Mensagem recebida em ${clientId}:`, msg.body.substring(0, 50));
        io.emit(`message_${clientId}`, msg);
    });

    client.initialize();
    clients[clientId] = client;
    
    // Set initial status
    io.emit(`client_status_${clientId}`, { 
        clientId: clientId, 
        status: 'connecting',
        hasQrCode: false
    });
    
    console.log(`✅ Cliente ${clientId} inicializado e conectando...`);
};

io.on('connection', socket => {
    const timestamp = new Date().toISOString();
    console.log(`🔌 [${timestamp}] USUÁRIO CONECTADO WebSocket: ${socket.id}`);

    socket.on('join_client', clientId => {
        const joinTimestamp = new Date().toISOString();
        socket.join(clientId);
        console.log(`📱 [${joinTimestamp}] Socket ${socket.id} ENTROU NA SALA: ${clientId}`);
        console.log(`📱 [${joinTimestamp}] Clientes na sala ${clientId}: ${io.sockets.adapter.rooms.get(clientId)?.size || 0}`);
        
        // ENVIAR STATUS ATUAL DO CLIENTE SE EXISTIR
        if (clients[clientId]) {
            const client = clients[clientId];
            const isConnected = client.info?.wid;
            const hasStoredQr = !!client.qrCode;
            
            const statusData = {
                clientId: clientId,
                status: isConnected ? 'connected' : (hasStoredQr ? 'qr_ready' : 'connecting'),
                phoneNumber: isConnected ? phoneNumberFormatter(client.info.wid.user) : null,
                hasQrCode: hasStoredQr,
                qrCode: hasStoredQr ? client.qrCode : null,
                timestamp: joinTimestamp
            };
            
            console.log(`📱 [${joinTimestamp}] ENVIANDO STATUS ATUAL para ${socket.id}:`, {
                clientId: statusData.clientId,
                status: statusData.status,
                hasQrCode: statusData.hasQrCode,
                hasStoredQr: hasStoredQr
            });
            
            socket.emit(`client_status_${clientId}`, statusData);
        } else {
            console.log(`📱 [${joinTimestamp}] Cliente ${clientId} NÃO EXISTE ainda`);
        }
    });

    // HEARTBEAT PARA MANTER CONEXÃO ATIVA
    const heartbeat = setInterval(() => {
        socket.emit('ping');
    }, 30000);

    socket.on('pong', () => {
        console.log(`💓 Heartbeat recebido de ${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
        const disconnectTimestamp = new Date().toISOString();
        console.log(`❌ [${disconnectTimestamp}] USUÁRIO DESCONECTADO: ${socket.id}, Razão: ${reason}`);
        clearInterval(heartbeat);
    });
});

app.get('/health', (req, res) => {
    const healthcheck = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeClients: Object.keys(clients).length,
        connectedClients: Object.keys(clients).filter(id => clients[id].info?.wid).length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.2.3-cors-unico',
        server: '146.59.227.248:4000',
        protocol: 'HTTPS',
        cors: {
            enabled: true,
            allowedOrigins: 'specific-list',
            allowedMethods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
            status: 'unico-configurado',
            lovableSupport: true,
            preflightFixed: true,
            optionsHandling: 'cors-middleware',
            duplicateFixed: true
        },
        swagger: {
            enabled: true,
            url: 'https://146.59.227.248/api-docs',
            jsonUrl: 'https://146.59.227.248/api-docs.json',
            corsFixed: true
        },
        routes: {
            '/clients': 'GET, POST',
            '/clients/:id/connect': 'POST ⭐ (CORS ÚNICO)',
            '/clients/:id/disconnect': 'POST',
            '/clients/:id/status': 'GET ⭐ (QR CODE DISPONÍVEL)',
            '/clients/:id/chats': 'GET',
            '/clients/:id/send-message': 'POST',
            '/clients/:id/send-audio': 'POST',
            '/clients/:id/send-image': 'POST',
            '/clients/:id/send-video': 'POST',
            '/clients/:id/send-document': 'POST',
            '/api-docs': 'GET ⭐ (SWAGGER HTTPS CORS ÚNICO)'
        }
    };
    res.json(healthcheck);
});

// Rotas principais
app.get('/clients', (req, res) => {
    const clientList = Object.keys(clients).map(clientId => {
        const client = clients[clientId];
        const isConnected = client.info?.wid;
        return {
            clientId: clientId,
            status: isConnected ? 'connected' : (client.qr ? 'qr_ready' : 'connecting'),
            phoneNumber: isConnected ? phoneNumberFormatter(client.info.wid.user) : null,
            hasQrCode: !!client.qr
        };
    });
    console.log(`📋 Enviando lista de ${clientList.length} clientes`);
    res.json({ success: true, clients: clientList });
});

app.post('/clients/:clientId/connect', (req, res) => {
    const clientId = req.params.clientId;
    const timestamp = new Date().toISOString();
    console.log(`🔗 [${timestamp}] CONECTANDO CLIENTE: ${clientId}`);
    
    try {
        // LIMPAR CLIENTE EXISTENTE SE HOUVER
        if (clients[clientId]) {
            console.log(`🧹 [${timestamp}] Limpando cliente existente: ${clientId}`);
            try {
                clients[clientId].destroy();
            } catch (e) {
                console.warn(`⚠️ [${timestamp}] Erro ao destruir cliente existente:`, e.message);
            }
            delete clients[clientId];
        }

        // LIMPAR PROCESSOS CHROME ÓRFÃOS
        cleanupOrphanedChromeProcesses();
        
        // INICIALIZAR CLIENTE IMEDIATAMENTE (SEM TIMEOUT)
        console.log(`🚀 [${timestamp}] Iniciando cliente IMEDIATAMENTE: ${clientId}`);
        initClient(clientId);
        
        console.log(`✅ [${timestamp}] Cliente ${clientId} iniciando conexão OTIMIZADA`);
        res.json({ 
            success: true, 
            message: `Cliente ${clientId} iniciando conexão.`,
            timestamp: timestamp
        });
    } catch (error) {
        console.error(`❌ [${timestamp}] Erro ao conectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message, timestamp: timestamp });
    }
});

app.post('/clients/:clientId/disconnect', async (req, res) => {
    const clientId = req.params.clientId;
    console.log(`🔌 Desconectando cliente: ${clientId}`);
    
    if (clients[clientId]) {
        try {
            await clients[clientId].logout();
            delete clients[clientId];
            
            io.emit(`client_status_${clientId}`, { 
                clientId: clientId, 
                status: 'disconnected',
                hasQrCode: false
            });
            
            emitClientsUpdate();
            res.json({ success: true, message: `Cliente ${clientId} desconectado.` });
        } catch (error) {
            console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
            res.status(500).json({ success: false, error: `Falha ao desconectar cliente ${clientId}.` });
        }
    } else {
        res.status(404).json({ success: false, error: `Cliente ${clientId} não encontrado.` });
    }
});

app.get('/clients/:clientId/status', async (req, res) => {
    const clientId = req.params.clientId;
    const timestamp = new Date().toISOString();
    console.log(`📊 [${timestamp}] VERIFICANDO STATUS: ${clientId}`);
    
    if (clients[clientId]) {
        const client = clients[clientId];
        
        try {
            // VERIFICAÇÃO INTELIGENTE DE STATUS
            let finalStatus = 'connecting';
            let phoneNumber = null;
            let qrCode = null;
            
            // VERIFICAR SE CLIENTE ESTÁ REALMENTE CONECTADO
            if (client.info && client.info.wid) {
                finalStatus = 'connected';
                phoneNumber = client.info.wid.user;
                console.log(`✅ [${timestamp}] Cliente ${clientId} CONECTADO: ${phoneNumber}`);
            }
            // VERIFICAR SE TEM QR CODE DISPONÍVEL
            else if (client.qrCode) {
                finalStatus = 'qr_ready';
                qrCode = client.qrCode;
                console.log(`📱 [${timestamp}] Cliente ${clientId} com QR Code disponível`);
            }
            // VERIFICAR GETSTATE APENAS SE SESSÃO ESTÁ SAUDÁVEL
            else if (client.client && client.client.pupPage && !client.client.pupPage.isClosed()) {
                try {
                    const state = await client.client.getState();
                    if (state === 'CONNECTED') {
                        finalStatus = 'connected';
                    }
                } catch (stateError) {
                    console.log(`⚠️ Erro getState esperado (sessão fechada): ${stateError.message}`);
                    // Marcar para limpeza
                    setTimeout(() => cleanupDeadSession(clientId, 'getstate_error'), 1000);
                }
            }
            
            const response = { 
                success: true, 
                clientId: clientId, 
                status: finalStatus, 
                phoneNumber: phoneNumber ? phoneNumberFormatter(phoneNumber) : null, 
                qrCode: qrCode,
                hasQrCode: !!qrCode,
                timestamp: timestamp,
                qrTimestamp: client.qrTimestamp,
                diagnostic: {
                    exists: true,
                    hasInfo: !!(client.info),
                    hasWid: !!(client.info && client.info.wid),
                    hasQrCode: !!qrCode,
                    hasMainFrame: !!(client.client && client.client.pupPage && client.client.pupPage.mainFrame)
                }
            };
            
            console.log(`✅ [${timestamp}] STATUS ${clientId}: ${finalStatus}, QR: ${!!qrCode}`);
            res.json(response);
        } catch (error) {
            console.error(`❌ [${timestamp}] ERRO status ${clientId}:`, error);
            res.status(500).json({ 
                success: false, 
                error: `Falha ao verificar status do cliente ${clientId}.`,
                timestamp: timestamp
            });
        }
    } else {
        console.log(`❌ [${timestamp}] Cliente ${clientId} NÃO ENCONTRADO`);
        console.log(`📋 [${timestamp}] Clientes disponíveis: [${Object.keys(clients).join(', ')}]`);
        
        res.status(404).json({ 
            success: false, 
            error: `Cliente ${clientId} não encontrado.`,
            timestamp: timestamp,
            availableClients: Object.keys(clients)
        });
    }
});

app.post('/clients/:clientId/send-message', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const message = req.body.message;

    if (clients[clientId]) {
        try {
            await clients[clientId].sendMessage(number, message);
            res.json({ success: true, message: 'Mensagem enviada' });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar mensagem' });
        }
    }
});

// ===== SISTEMA DE DIAGNÓSTICO PROFUNDO =====
const diagnosticClient = (client, clientId) => {
    const timestamp = new Date().toISOString();
    const diagnostic = {
        timestamp,
        clientId,
        exists: !!client,
        hasInfo: !!(client && client.info),
        hasWid: !!(client && client.info && client.info.wid),
        hasPupPage: !!(client && client.pupPage),
        isPageClosed: null,
        hasMainFrame: null,
        hasAuthStrategy: !!(client && client.authStrategy),
        isAuthenticated: !!(client && client.authStrategy && client.authStrategy.authenticated),
        hasStoredQrCode: !!(client && client.qrCode),
        hasRawQr: !!(client && client.qr),
        recoveryAttempts: client ? (client.recoveryAttempts || 0) : 0
    };
    
    if (client && client.pupPage) {
        try {
            diagnostic.isPageClosed = client.pupPage.isClosed ? client.pupPage.isClosed() : false;
            diagnostic.hasMainFrame = !!client.pupPage.mainFrame;
        } catch (error) {
            diagnostic.isPageClosed = true;
            diagnostic.hasMainFrame = false;
            diagnostic.pageError = error.message;
        }
    }
    
    console.log(`🔍 [${timestamp}] DIAGNÓSTICO COMPLETO ${clientId}:`, diagnostic);
    return diagnostic;
};

const isSessionHealthy = (client, clientId) => {
    try {
        if (!client) {
            console.log(`❌ SAÚDE: Cliente ${clientId} não existe`);
            return false;
        }
        
        if (!client.pupPage) {
            console.log(`❌ SAÚDE: Cliente ${clientId} sem pupPage`);
            return false;
        }
        
        if (client.pupPage.isClosed && client.pupPage.isClosed()) {
            console.log(`❌ SAÚDE: Cliente ${clientId} com página fechada`);
            return false;
        }
        
        if (!client.pupPage.mainFrame) {
            console.log(`❌ SAÚDE: Cliente ${clientId} sem mainFrame`);
            return false;
        }
        
        console.log(`✅ SAÚDE: Cliente ${clientId} saudável`);
        return true;
    } catch (error) {
        console.log(`❌ SAÚDE: Cliente ${clientId} erro na verificação: ${error.message}`);
        return false;
    }
};

const getClientStatusSafe = async (client, clientId) => {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [${timestamp}] INICIANDO DETECÇÃO DE STATUS: ${clientId}`);
    
    try {
        // FONTE 1: Verificar info.wid (mais confiável para conexões estabelecidas)
        if (client.info && client.info.wid) {
            console.log(`✅ [${timestamp}] FONTE 1 - Info.wid encontrado: ${client.info.wid.user}`);
            return { 
                status: 'connected', 
                phoneNumber: client.info.wid.user,
                source: 'info.wid'
            };
        } else {
            console.log(`⚪ [${timestamp}] FONTE 1 - Sem info.wid`);
        }
        
        // FONTE 2: Verificar getState apenas se sessão está saudável
        if (isSessionHealthy(client, clientId)) {
            console.log(`⚪ [${timestamp}] FONTE 2 - Sessão saudável, verificando getState...`);
            try {
                const state = await Promise.race([
                    client.getState(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('getState timeout')), 5000))
                ]);
                
                console.log(`🔍 [${timestamp}] FONTE 2 - getState retornou: ${state}`);
                if (state === 'CONNECTED') {
                    return { 
                        status: 'connected', 
                        phoneNumber: null,
                        source: 'getState'
                    };
                }
            } catch (stateError) {
                console.log(`⚠️ [${timestamp}] FONTE 2 - Erro getState: ${stateError.message}`);
            }
        } else {
            console.log(`❌ [${timestamp}] FONTE 2 - Sessão não está saudável, pulando getState`);
        }
        
        // FONTE 3: Verificar authStrategy
        if (client.authStrategy && client.authStrategy.authenticated) {
            console.log(`✅ [${timestamp}] FONTE 3 - AuthStrategy authenticated`);
            return { 
                status: 'authenticated', 
                phoneNumber: null,
                source: 'authStrategy'
            };
        } else {
            console.log(`⚪ [${timestamp}] FONTE 3 - AuthStrategy não authenticated`);
        }
        
        // FONTE 4: Verificar se tem QR code armazenado
        if (client.qrCode) {
            console.log(`✅ [${timestamp}] FONTE 4 - QR Code armazenado encontrado`);
            return { 
                status: 'qr_ready', 
                phoneNumber: null,
                source: 'stored_qr'
            };
        } else {
            console.log(`⚪ [${timestamp}] FONTE 4 - Sem QR Code armazenado`);
        }
        
        // FONTE 5: Verificar QR raw
        if (client.qr) {
            console.log(`✅ [${timestamp}] FONTE 5 - QR Raw encontrado`);
            return { 
                status: 'qr_ready', 
                phoneNumber: null,
                source: 'raw_qr'
            };
        } else {
            console.log(`⚪ [${timestamp}] FONTE 5 - Sem QR Raw`);
        }
        
        console.log(`⚪ [${timestamp}] STATUS PADRÃO - connecting`);
        return { 
            status: 'connecting', 
            phoneNumber: null,
            source: 'default'
        };
    } catch (error) {
        console.error(`❌ [${timestamp}] ERRO GERAL na detecção de status: ${error.message}`);
        console.error(`❌ [${timestamp}] Stack trace:`, error.stack);
        return { 
            status: 'error', 
            phoneNumber: null,
            source: 'error',
            errorMessage: error.message
        };
    }
};

// ===== SISTEMA DE LIMPEZA AUTOMÁTICA DE SESSÕES MORTAS =====
const cleanupDeadSession = async (clientId, reason = 'dead_session') => {
    const timestamp = new Date().toISOString();
    console.log(`🧹 [${timestamp}] LIMPANDO SESSÃO MORTA: ${clientId}, razão: ${reason}`);
    
    try {
        const client = clients[clientId];
        if (client) {
            // Limpar interval de auto-recovery se existir
            if (client.autoRecoveryInterval) {
                clearInterval(client.autoRecoveryInterval);
                console.log(`🧹 [${timestamp}] Auto-recovery interval limpo para ${clientId}`);
            }
            
            // Destruir cliente Puppeteer
            try {
                await client.destroy();
                console.log(`🧹 [${timestamp}] Cliente Puppeteer destruído: ${clientId}`);
            } catch (destroyError) {
                console.warn(`⚠️ [${timestamp}] Erro ao destruir cliente: ${destroyError.message}`);
            }
            
            // Remover da lista de clientes
            delete clients[clientId];
            console.log(`🧹 [${timestamp}] Cliente removido da lista: ${clientId}`);
            
            // Atualizar banco de dados
            try {
                await updateInstanceStatus(clientId, 'disconnected');
                console.log(`🧹 [${timestamp}] Status do banco atualizado: ${clientId} -> disconnected`);
            } catch (dbError) {
                console.error(`❌ [${timestamp}] Erro ao atualizar banco: ${dbError.message}`);
            }
            
            // Emitir evento de desconexão
            const disconnectData = {
                clientId: clientId,
                status: 'disconnected',
                phoneNumber: null,
                hasQrCode: false,
                qrCode: null,
                timestamp: timestamp,
                reason: reason
            };
            
            io.to(clientId).emit(`client_status_${clientId}`, disconnectData);
            io.emit(`client_status_${clientId}`, disconnectData);
            
            console.log(`✅ [${timestamp}] Limpeza completa realizada para: ${clientId}`);
            return true;
        } else {
            console.log(`⚠️ [${timestamp}] Cliente ${clientId} já foi removido`);
            return false;
        }
    } catch (error) {
        console.error(`❌ [${timestamp}] Erro na limpeza de sessão morta ${clientId}:`, error);
        return false;
    }
};

app.get('/clients/:clientId/status', async (req, res) => {
    const clientId = req.params.clientId;
    const timestamp = new Date().toISOString();
    console.log(`📊 [${timestamp}] ===== VERIFICAÇÃO DE STATUS INICIADA: ${clientId} =====`);
    
    if (clients[clientId]) {
        const client = clients[clientId];
        
        try {
            // FASE 1: DIAGNÓSTICO COMPLETO
            const diagnostic = diagnosticClient(client, clientId);
            
            // FASE 2: DETECÇÃO INTELIGENTE DE STATUS
            const statusResult = await getClientStatusSafe(client, clientId);
            console.log(`🔍 [${timestamp}] Status detectado: ${statusResult.status} via ${statusResult.source}`);
            
            // FASE 3: VERIFICAÇÃO E LIMPEZA DE SESSÕES MORTAS
            if (statusResult.status === 'error' || !isSessionHealthy(client, clientId)) {
                console.log(`💀 [${timestamp}] SESSÃO MORTA DETECTADA para ${clientId}`);
                
                // Incrementar contador
                client.deadSessionDetections = (client.deadSessionDetections || 0) + 1;
                
                if (client.deadSessionDetections >= 2) {
                    console.log(`💀 [${timestamp}] LIMITE DE DETECÇÕES ATINGIDO (${client.deadSessionDetections}), limpando sessão`);
                    
                    // Executar limpeza em background
                    setTimeout(() => cleanupDeadSession(clientId, 'max_dead_detections'), 1000);
                    
                    return res.json({
                        success: true,
                        clientId: clientId,
                        status: 'disconnected',
                        phoneNumber: null,
                        qrCode: null,
                        hasQrCode: false,
                        timestamp: timestamp,
                        diagnostic: diagnostic,
                        message: 'Sessão morta detectada, limpeza automática iniciada'
                    });
                } else {
                    console.log(`💀 [${timestamp}] Detecção ${client.deadSessionDetections}/2, aguardando próxima verificação`);
                }
            } else {
                // Reset contador se sessão está saudável
                client.deadSessionDetections = 0;
            }
            
            // FASE 4: PROCESSAMENTO DE QR CODE
            let qrCode = null;
            let qrExpiresAt = null;
            
            // Primeiro tentar recuperar do cliente em memória
            if (client.qrCode) {
                qrCode = client.qrCode;
                qrExpiresAt = client.qrExpiresAt;
                console.log(`📱 [${timestamp}] QR Code ARMAZENADO encontrado (${client.qrTimestamp})`);
            } else if (client.qr) {
                console.log(`📱 [${timestamp}] QR Raw encontrado, convertendo para DataURL...`);
                try {
                    qrCode = await qrcode.toDataURL(client.qr);
                    qrExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
                    client.qrCode = qrCode;
                    client.qrTimestamp = timestamp;
                    client.qrExpiresAt = qrExpiresAt;
                    console.log(`📱 [${timestamp}] QR Code convertido e armazenado`);
                } catch (qrError) {
                    console.error(`❌ [${timestamp}] Erro ao converter QR: ${qrError.message}`);
                }
            } else {
                // Se não tem QR em memória, tentar recuperar do banco
                console.log(`🔍 [${timestamp}] Tentando recuperar QR do banco para ${clientId}`);
                try {
                    const { data: dbInstance, error: dbError } = await supabase
                        .from('whatsapp_instances')
                        .select('qr_code, qr_expires_at, has_qr_code')
                        .eq('instance_id', clientId)
                        .single();
                    
                    if (dbError) {
                        console.warn(`⚠️ [${timestamp}] Erro ao buscar QR do banco: ${dbError.message}`);
                    } else if (dbInstance && dbInstance.has_qr_code && dbInstance.qr_code) {
                        const expiresAt = new Date(dbInstance.qr_expires_at);
                        const now = new Date();
                        
                        if (expiresAt > now) {
                            qrCode = dbInstance.qr_code;
                            qrExpiresAt = expiresAt;
                            client.qrCode = qrCode;
                            client.qrExpiresAt = qrExpiresAt;
                            client.qrTimestamp = dbInstance.qr_expires_at;
                            console.log(`✅ [${timestamp}] QR Code recuperado do banco (expira: ${expiresAt.toISOString()})`);
                        } else {
                            console.log(`⏰ [${timestamp}] QR Code do banco expirado (${expiresAt.toISOString()})`);
                            
                            // Limpar QR expirado do banco
                            await supabase
                                .from('whatsapp_instances')
                                .update({ 
                                    qr_code: null, 
                                    has_qr_code: false, 
                                    qr_expires_at: null,
                                    updated_at: timestamp
                                })
                                .eq('instance_id', clientId);
                        }
                    } else {
                        console.log(`📝 [${timestamp}] Nenhum QR válido encontrado no banco`);
                    }
                } catch (recoveryError) {
                    console.error(`❌ [${timestamp}] Erro na recuperação do QR: ${recoveryError.message}`);
                }
            }
            
            // FASE 5: MAPEAMENTO DE STATUS FINAL
            let finalStatus = statusResult.status;
            if (finalStatus === 'authenticated') {
                finalStatus = 'connected';
            }
            if (qrCode && finalStatus !== 'connected') {
                finalStatus = 'qr_ready';
            }
            
            const phoneNumber = statusResult.phoneNumber ? phoneNumberFormatter(statusResult.phoneNumber) : null;
            
            console.log(`🔍 [${timestamp}] Status final mapeado: ${statusResult.status} -> ${finalStatus}`);
            
            const response = {
                success: true,
                clientId: clientId,
                status: finalStatus,
                phoneNumber: phoneNumber,
                qrCode: qrCode,
                hasQrCode: !!qrCode,
                timestamp: timestamp,
                qrTimestamp: client.qrTimestamp,
                diagnostic: diagnostic,
                source: statusResult.source
            };
            
            console.log(`✅ [${timestamp}] ===== STATUS FINAL ${clientId}: ${finalStatus}, QR: ${!!qrCode} =====`);
            res.json(response);
            
        } catch (error) {
            console.error(`❌ [${timestamp}] ERRO CRÍTICO no status ${clientId}:`, error);
            console.error(`❌ [${timestamp}] Stack trace:`, error.stack);
            
            // Em caso de erro crítico, tentar limpeza
            setTimeout(() => cleanupDeadSession(clientId, 'critical_error'), 2000);
            
            res.status(500).json({
                success: false,
                error: `Erro crítico ao verificar status: ${error.message}`,
                clientId: clientId,
                timestamp: timestamp,
                diagnostic: diagnosticClient(client, clientId)
            });
        }
    } else {
        console.log(`❌ [${timestamp}] Cliente ${clientId} NÃO ENCONTRADO na lista de clientes`);
        console.log(`📋 [${timestamp}] Clientes ativos: [${Object.keys(clients).join(', ')}]`);
        
        res.status(404).json({
            success: false,
            error: `Cliente ${clientId} não encontrado.`,
            clientId: clientId,
            timestamp: timestamp,
            activeClients: Object.keys(clients)
        });
    }
});

app.post('/clients/:clientId/send-media', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const caption = req.body.caption;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo foi enviado.' });
    }

    const file = req.files.file;
    const mimeType = file.mimetype;
    const filename = file.name;
    const base64File = file.data.toString('base64');

    if (clients[clientId]) {
        try {
            const media = new MessageMedia(mimeType, base64File, filename);
            await clients[clientId].sendMessage(number, media, { caption: caption });
            res.json({ success: true, message: 'Mídia enviada' });
        } catch (error) {
            console.error('Erro ao enviar mídia:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar mídia' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/send-image', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const caption = req.body.caption;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo foi enviado.' });
    }

    const file = req.files.file;
    const mimeType = file.mimetype;
    const filename = file.name;
    const base64File = file.data.toString('base64');

    if (clients[clientId]) {
        try {
            const media = new MessageMedia(mimeType, base64File, filename);
            await clients[clientId].sendMessage(number, media, { caption: caption });
            res.json({ success: true, message: 'Imagem enviada' });
        } catch (error) {
            console.error('Erro ao enviar imagem:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar imagem' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/send-video', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const caption = req.body.caption;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo foi enviado.' });
    }

    const file = req.files.file;
    const mimeType = file.mimetype;
    const filename = file.name;
    const base64File = file.data.toString('base64');

    if (clients[clientId]) {
        try {
            const media = new MessageMedia(mimeType, base64File, filename);
            await clients[clientId].sendMessage(number, media, { caption: caption });
            res.json({ success: true, message: 'Vídeo enviado' });
        } catch (error) {
            console.error('Erro ao enviar vídeo:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar vídeo' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/send-audio', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const caption = req.body.caption;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo foi enviado.' });
    }

    const file = req.files.file;
    const mimeType = file.mimetype;
    const filename = file.name;
    const base64File = file.data.toString('base64');

    if (clients[clientId]) {
        try {
            const media = new MessageMedia(mimeType, base64File, filename);
            await clients[clientId].sendMessage(number, media, { caption: caption });
            res.json({ success: true, message: 'Áudio enviado' });
        } catch (error) {
            console.error('Erro ao enviar áudio:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar áudio' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/send-document', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const caption = req.body.caption;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo foi enviado.' });
    }

    const file = req.files.file;
    const mimeType = file.mimetype;
    const filename = file.name;
    const base64File = file.data.toString('base64');

    if (clients[clientId]) {
        try {
            const media = new MessageMedia(mimeType, base64File, filename);
            await clients[clientId].sendMessage(number, media, { caption: caption });
            res.json({ success: true, message: 'Documento enviado' });
        } catch (error) {
            console.error('Erro ao enviar documento:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar documento' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/send-media-url', async (req, res) => {
    const clientId = req.params.clientId;
    const number = phoneNumberFormatter(req.body.to);
    const mediaUrl = req.body.mediaUrl;
    const message = req.body.message;

    if (clients[clientId]) {
        try {
            const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
            await clients[clientId].sendMessage(number, media, { caption: message });
            res.json({ success: true, message: 'Mídia enviada' });
        } catch (error) {
            console.error('Erro ao enviar mídia do URL:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar mídia do URL' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.get('/clients/:clientId/chats', async (req, res) => {
    const clientId = req.params.clientId;

    if (clients[clientId]) {
        try {
            const chats = await clients[clientId].getChats();
            res.json({ success: true, chats: chats });
        } catch (error) {
            console.error('Erro ao obter chats:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter chats' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.get('/clients/:clientId/chats/:chatId/messages', async (req, res) => {
    const clientId = req.params.clientId;
    const chatId = req.params.chatId;
    const limit = parseInt(req.query.limit) || 50;

    if (clients[clientId]) {
        try {
            const chat = await clients[clientId].getChatById(chatId);
            const messages = await chat.fetchMessages({ limit: limit });
            res.json({ success: true, messages: messages });
        } catch (error) {
            console.error('Erro ao obter mensagens do chat:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter mensagens do chat' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/presence', async (req, res) => {
    const clientId = req.params.clientId;
    const presence = req.body.presence;

    if (clients[clientId]) {
        try {
            await clients[clientId].sendPresenceAvailable(presence);
            res.json({ success: true, message: 'Presence updated' });
        } catch (error) {
            console.error('Erro ao atualizar presence:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar presence' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/set-typing', async (req, res) => {
    const clientId = req.params.clientId;
    const chatId = req.body.chatId;
    const isTyping = req.body.isTyping;

    if (clients[clientId]) {
        try {
            await clients[clientId].sendChatState(isTyping ? 'typing' : 'pause', chatId);
            res.json({ success: true, message: 'Typing status updated' });
        } catch (error) {
            console.error('Erro ao atualizar typing status:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar typing status' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/set-recording', async (req, res) => {
    const clientId = req.params.clientId;
    const chatId = req.body.chatId;
    const isRecording = req.body.isRecording;

    if (clients[clientId]) {
        try {
            await clients[clientId].sendChatState(isRecording ? 'recording' : 'pause', chatId);
            res.json({ success: true, message: 'Recording status updated' });
        } catch (error) {
            console.error('Erro ao atualizar recording status:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar recording status' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/mark-as-read', async (req, res) => {
    const clientId = req.params.clientId;
    const chatId = req.body.chatId;
    const messageId = req.body.messageId;

    if (clients[clientId]) {
        try {
            const chat = await clients[clientId].getChatById(chatId);
            await chat.sendSeen(messageId);
            res.json({ success: true, message: 'Message marked as read' });
        } catch (error) {
            console.error('Erro ao marcar mensagem como lida:', error);
            res.status(500).json({ success: false, error: 'Erro ao marcar mensagem como lida' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

app.post('/clients/:clientId/send-reaction', async (req, res) => {
    const clientId = req.params.clientId;
    const chatId = req.body.chatId;
    const messageId = req.body.messageId;
    const emoji = req.body.emoji;

    if (clients[clientId]) {
        try {
            const chat = await clients[clientId].getChatById(chatId);
            await chat.react(messageId, emoji);
            res.json({ success: true, message: 'Reaction sent' });
        } catch (error) {
            console.error('Erro ao enviar reação:', error);
            res.status(500).json({ success: false, error: 'Erro ao enviar reação' });
        }
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
    }
});

// ENDPOINT PARA SINCRONIZAÇÃO MANUAL COM BANCO
app.post('/sync/database', async (req, res) => {
    console.log('🔄 [SYNC-API] Solicitação de sincronização manual recebida');
    
    try {
        const result = await syncWithDatabase();
        
        if (result) {
            const activeClients = Object.keys(clients).length;
            const connectedClients = Object.values(clients).filter(c => c.status === 'connected').length;
            
            res.json({
                success: true,
                message: 'Sincronização completada com sucesso',
                statistics: {
                    totalInstances: activeClients,
                    connectedInstances: connectedClients,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Falha na sincronização com banco de dados'
            });
        }
    } catch (error) {
        console.error('❌ [SYNC-API] Erro na sincronização manual:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno na sincronização'
        });
    }
});

// ENDPOINT PARA VERIFICAR SINCRONIZAÇÃO
app.get('/sync/status', async (req, res) => {
    try {
        const { data: dbInstances, error } = await supabase
            .from('whatsapp_instances')
            .select('instance_id, status, custom_name, phone_number');
        
        if (error) {
            throw error;
        }
        
        const serverInstances = Object.keys(clients).map(id => ({
            instance_id: id,
            status: clients[id].status,
            custom_name: clients[id].customName,
            phone_number: clients[id].phoneNumber,
            in_server: true
        }));
        
        const dbInstanceIds = new Set(dbInstances?.map(i => i.instance_id) || []);
        const serverInstanceIds = new Set(Object.keys(clients));
        
        const missingInServer = [...dbInstanceIds].filter(id => !serverInstanceIds.has(id));
        const missingInDatabase = [...serverInstanceIds].filter(id => !dbInstanceIds.has(id));
        
        res.json({
            success: true,
            sync_status: {
                database_instances: dbInstances?.length || 0,
                server_instances: serverInstances.length,
                missing_in_server: missingInServer,
                missing_in_database: missingInDatabase,
                is_synchronized: missingInServer.length === 0 && missingInDatabase.length === 0
            },
            database_instances: dbInstances || [],
            server_instances: serverInstances
        });
    } catch (error) {
        console.error('❌ [SYNC-STATUS] Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status de sincronização'
        });
    }
});

// ===== ENDPOINT PARA LIMPEZA AUTOMÁTICA DE QR CODES EXPIRADOS =====
app.post('/cleanup-expired-qr', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`🧹 [${timestamp}] Iniciando limpeza de QR codes expirados...`);
    
    try {
        // Executar função do Supabase para limpeza
        const { data, error } = await supabase.rpc('cleanup_expired_qr_codes');
        
        if (error) {
            console.error(`❌ [${timestamp}] Erro na limpeza de QR codes:`, error);
            return res.status(500).json({
                success: false,
                error: error.message,
                cleaned: 0
            });
        }
        
        const cleanedCount = data || 0;
        console.log(`✅ [${timestamp}] ${cleanedCount} QR codes expirados foram limpos`);
        
        // Limpar também QR codes em memória que expiraram
        let memoryCleanupCount = 0;
        for (const [clientId, client] of Object.entries(clients)) {
            if (client.qrExpiresAt && new Date(client.qrExpiresAt) <= new Date()) {
                client.qrCode = null;
                client.qrTimestamp = null;
                client.qrExpiresAt = null;
                client.hasQrCode = false;
                
                if (client.status === 'qr_ready') {
                    client.status = 'disconnected';
                }
                
                console.log(`🧹 [${timestamp}] QR expirado removido da memória: ${clientId}`);
                memoryCleanupCount++;
                
                // Emitir atualização de status
                io.to(clientId).emit(`client_status_${clientId}`, {
                    clientId: clientId,
                    status: 'disconnected',
                    hasQrCode: false,
                    qrCode: null,
                    timestamp: timestamp
                });
            }
        }
        
        console.log(`✅ [${timestamp}] ${memoryCleanupCount} QR codes limpos da memória`);
        
        res.json({
            success: true,
            cleaned: cleanedCount,
            memoryCleanup: memoryCleanupCount,
            timestamp: timestamp
        });
        
    } catch (error) {
        console.error(`❌ [${timestamp}] Erro crítico na limpeza:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            cleaned: 0
        });
    }
});

// Cleanup on startup
cleanupOrphanedChromeProcesses();

// INICIALIZAÇÃO DO SERVIDOR COM SINCRONIZAÇÃO
const initializeServer = async () => {
    console.log('🚀 [INIT] Iniciando WhatsApp Multi-Client Server...');
    
    // Carregar instâncias existentes do banco
    console.log('📊 [INIT] Carregando instâncias do Supabase...');
    const loadResult = await loadExistingInstances();
    
    if (loadResult.success) {
        console.log(`✅ [INIT] ${loadResult.instances.length} instâncias carregadas do banco`);
        
        // Executar sincronização completa
        console.log('🔄 [INIT] Executando sincronização inicial...');
        const syncResult = await syncWithDatabase();
        
        if (syncResult) {
            console.log('✅ [INIT] Sincronização inicial completada');
        } else {
            console.warn('⚠️ [INIT] Sincronização inicial teve problemas');
        }
    } else {
        console.warn('⚠️ [INIT] Problemas ao carregar instâncias do banco');
    }
    
    // Estatísticas iniciais
    const activeClients = Object.keys(clients).length;
    const needReconnect = Object.values(clients).filter(c => c.needsReconnect).length;
    
    console.log(`📊 [INIT] Status inicial:`);
    console.log(`   - Instâncias carregadas: ${activeClients}`);
    console.log(`   - Precisam reconectar: ${needReconnect}`);
    console.log(`   - Porta: ${port}`);
    
    // Iniciar servidor
    server.listen(port, '0.0.0.0', () => {
        console.log(`🚀 WhatsApp Multi-Client Server iniciado na porta ${port}`);
        console.log(`📡 Health Check HTTPS: https://146.59.227.248:${port}/health`);
        console.log(`📱 API Base HTTPS: https://146.59.227.248:${port}/clients`);
        console.log(`📚 Swagger UI HTTPS: https://146.59.227.248:${port}/api-docs`);
        console.log(`🔄 Sync API: https://146.59.227.248:${port}/sync/database`);
        console.log(`📊 Sync Status: https://146.59.227.248:${port}/sync/status`);
        console.log(`🔧 CORS ÚNICO DEFINITIVAMENTE CONFIGURADO!`);
        console.log(`   - Middleware: cors() com lista específica de origens`);
        console.log(`   - Headers: Único por request, sem duplicação`);
        console.log(`   - OPTIONS: Tratado pelo middleware automaticamente`);
        console.log(`   - Métodos: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`);
        console.log(`   - HTTPS: Swagger UI configurado definitivamente`);
        console.log(`📱 SERVIDOR HTTPS PRONTO - CORS ÚNICO RESOLVIDO!`);
        console.log(`✅ SINCRONIZAÇÃO COM BANCO IMPLEMENTADA!`);
    });
};

// Inicializar servidor com sincronização
initializeServer().catch(error => {
    console.error('❌ [INIT] Erro crítico na inicialização:', error);
    process.exit(1);
});
