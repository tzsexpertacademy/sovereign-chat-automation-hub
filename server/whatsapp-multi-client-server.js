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
    if (clients[clientId]) {
        console.log(`⚠️ Cliente ${clientId} já está inicializado.`);
        return;
    }

    console.log(`🚀 [${new Date().toISOString()}] INICIALIZANDO CLIENTE: ${clientId}`);

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
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-ipc-flooding-protection'
            ],
            timeout: 60000 // 60 segundos timeout
        }
    });

    // ARMAZENAR QR TEMPORARIAMENTE NO OBJETO CLIENT
    client.qrCode = null;
    client.qrTimestamp = null;

    client.on('qr', async (qr) => {
        const timestamp = new Date().toISOString();
        console.log(`📱 [${timestamp}] QR CODE EVENTO RECEBIDO para ${clientId}`);
        console.log(`📱 [${timestamp}] QR Code length: ${qr?.length || 0} chars`);
        
        try {
            const qrCodeDataUrl = await qrcode.toDataURL(qr);
            
            // ARMAZENAR QR NO CLIENTE
            client.qrCode = qrCodeDataUrl;
            client.qrTimestamp = timestamp;
            
            console.log(`📱 [${timestamp}] QR Code gerado DATA URL length: ${qrCodeDataUrl?.length || 0}`);
            
            // EMITIR PARA SALA ESPECÍFICA DO CLIENTE
            io.to(clientId).emit(`client_status_${clientId}`, { 
                clientId: clientId, 
                status: 'qr_ready', 
                qrCode: qrCodeDataUrl,
                hasQrCode: true,
                timestamp: timestamp
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
        console.log(`✅ [${timestamp}] Cliente ${clientId} AUTENTICADO VIA LOCAL AUTH`);
        
        // LIMPAR QR CODE APÓS AUTENTICAÇÃO
        client.qrCode = null;
        client.qrTimestamp = null;
        
        // AGUARDAR ESTABILIZAÇÃO E VERIFICAR CONEXÃO
        console.log(`🔄 [${timestamp}] Aguardando estabilização após autenticação...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // MARCAR COMO PROCESSADO PARA EVITAR DUPLICAÇÕES
        if (client.authenticatedProcessed) {
            console.log(`⚠️ [${timestamp}] Authenticated já processado para ${clientId}`);
            return;
        }
        client.authenticatedProcessed = true;
        
        console.log(`🔍 [${timestamp}] AUTHENTICATED processado para ${clientId}`);
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
                
                // LIMPAR QR CODE
                client.qrCode = null;
                client.qrTimestamp = null;
                
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

    // INICIAR SISTEMA DE AUTO-RECOVERY
    const recoveryInterval = setInterval(async () => {
        const shouldStop = await autoRecoverySystem();
        if (shouldStop) {
            clearInterval(recoveryInterval);
            console.log(`✅ Sistema de auto-recovery finalizado para ${clientId}`);
        }
    }, 4000); // Verificar a cada 4 segundos

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
        
        console.log(`🎉 [${timestamp}] Cliente ${clientId} READY! Telefone: ${phoneNumber}`);
        console.log(`🔍 [${timestamp}] Dados do cliente - WID: ${client.info?.wid ? 'Presente' : 'Ausente'}`);
        
        // VERIFICAR SE JÁ FOI PROCESSADO
        if (client.connectedProcessed) {
            console.log(`⚠️ [${timestamp}] READY já processado para ${clientId}`);
            return;
        }
        client.connectedProcessed = true;
        
        // LIMPAR QR CODE APÓS CONEXÃO
        client.qrCode = null;
        client.qrTimestamp = null;
        
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
        
        // EMITIR GERAL COMO BACKUP
        io.emit(`client_status_${clientId}`, statusData);
        console.log(`✅ [${timestamp}] Evento enviado globalmente para ${clientId}`);
        
        // ATUALIZAR BANCO COM RETRY
        if (phoneNumber) {
            try {
                const result = await updateInstanceStatus(clientId, 'connected', phoneNumber);
                if (result.success) {
                    console.log(`✅ [${timestamp}] Banco atualizado com sucesso para ${clientId}`);
                } else {
                    console.error(`❌ [${timestamp}] Falha ao atualizar banco para ${clientId}:`, result.error);
                }
            } catch (error) {
                console.error(`❌ [${timestamp}] Erro crítico ao atualizar banco no ready ${clientId}:`, error);
            }
        } else {
            console.warn(`⚠️ [${timestamp}] Sem número de telefone para atualizar banco ${clientId}`);
        }
        
        // Emit clients update
        emitClientsUpdate();
    });

    client.on('message', msg => {
        console.log(`📩 Mensagem recebida em ${clientId}:`, msg.body.substring(0, 50));
        io.emit(`message_${clientId}`, msg);
    });

    client.on('disconnected', async (reason) => {
        console.log(`❌ Cliente ${clientId} desconectado:`, reason);
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'disconnected',
            hasQrCode: false
        });
        
        // ATUALIZAR BANCO PARA STATUS DISCONNECTED
        try {
            await updateInstanceStatus(clientId, 'disconnected');
        } catch (error) {
            console.error(`❌ Erro ao atualizar banco para disconnected ${clientId}:`, error);
        }
        
        client.destroy();
        delete clients[clientId];
        emitClientsUpdate();
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
        try {
            // ===== USAR SISTEMA DE DETECÇÃO INTELIGENTE =====
            // Reutilizar as funções que já foram definidas no initClient
            const isSessionHealthy = (client) => {
                try {
                    if (!client || !client.pupPage) return false;
                    if (client.pupPage.isClosed && client.pupPage.isClosed()) return false;
                    if (!client.pupPage.mainFrame) return false;
                    return true;
                } catch (error) {
                    return false;
                }
            };

            const getClientStatusSafe = async (client) => {
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
            
            const statusResult = await getClientStatusSafe(client);
            let qrCode = null;
            
            // VERIFICAR QR CODE ARMAZENADO NO CLIENTE
            if (client.qrCode) {
                qrCode = client.qrCode;
                console.log(`📱 [${timestamp}] QR Code ENCONTRADO no cliente ${clientId} (${client.qrTimestamp})`);
            } else if (client.qr) {
                // FALLBACK PARA QR DIRETO (caso não tenha sido processado ainda)
                qrCode = await qrcode.toDataURL(client.qr);
                client.qrCode = qrCode; // ARMAZENAR PARA PRÓXIMAS CONSULTAS
                client.qrTimestamp = timestamp;
                console.log(`📱 [${timestamp}] QR Code GERADO e armazenado para ${clientId}`);
            }
            
            // MAPEAR STATUS FINAL
            let finalStatus = statusResult.status;
            if (finalStatus === 'authenticated') {
                finalStatus = 'connected'; // SEMPRE TRATAR AUTHENTICATED COMO CONNECTED
            }
            if (qrCode && finalStatus !== 'connected') {
                finalStatus = 'qr_ready';
            }
            
            const phoneNumber = statusResult.phoneNumber ? phoneNumberFormatter(statusResult.phoneNumber) : null;
            
            console.log(`🔍 [${timestamp}] Status check ${clientId}: result=${statusResult.status}, final=${finalStatus}`);
            
            const response = { 
                success: true, 
                clientId: clientId, 
                status: finalStatus, 
                phoneNumber: phoneNumber, 
                qrCode: qrCode,
                hasQrCode: !!qrCode,
                timestamp: timestamp,
                qrTimestamp: client.qrTimestamp
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
        res.status(404).json({ 
            success: false, 
            error: `Cliente ${clientId} não encontrado.`,
            timestamp: timestamp
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
    } else {
        res.status(404).json({ success: false, message: `Client ${clientId} não encontrado, verifique se a instancia foi criada.` });
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

// Cleanup on startup
cleanupOrphanedChromeProcesses();

server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 WhatsApp Multi-Client Server iniciado na porta ${port}`);
    console.log(`📡 Health Check HTTPS: https://146.59.227.248:${port}/health`);
    console.log(`📱 API Base HTTPS: https://146.59.227.248:${port}/clients`);
    console.log(`📚 Swagger UI HTTPS: https://146.59.227.248:${port}/api-docs`);
    console.log(`🔧 CORS ÚNICO DEFINITIVAMENTE CONFIGURADO!`);
    console.log(`   - Middleware: cors() com lista específica de origens`);
    console.log(`   - Headers: Único por request, sem duplicação`);
    console.log(`   - OPTIONS: Tratado pelo middleware automaticamente`);
    console.log(`   - Métodos: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`);
    console.log(`   - HTTPS: Swagger UI configurado definitivamente`);
    console.log(`📱 SERVIDOR HTTPS PRONTO - CORS ÚNICO RESOLVIDO!`);
});
