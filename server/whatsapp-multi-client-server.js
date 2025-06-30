const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

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

// CONFIGURAÇÃO CORS DEFINITIVA PARA RESOLVER PROBLEMA LOVABLE
console.log('🔧 Configurando CORS DEFINITIVO para resolver problema Lovable...');

// Middleware CORS ULTRA-ESPECÍFICO - PRIMEIRA POSIÇÃO
app.use((req, res, next) => {
    const origin = req.get('origin');
    console.log(`🌐 ${req.method} ${req.url} - Origin: ${origin || 'none'}`);
    
    // Headers CORS ultra-específicos
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma,Access-Control-Request-Method,Access-Control-Request-Headers,X-Client-Info,User-Agent,Referer');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Max-Age', '86400');
    res.header('Vary', 'Origin');
    
    // Para requisições OPTIONS, responder imediatamente com status 200
    if (req.method === 'OPTIONS') {
        console.log('✅ Respondendo preflight OPTIONS com status 200');
        res.status(200).end();
        return;
    }
    
    next();
});

// Middleware adicional para garantir CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// CORS do express como backup final
app.use(cors({
    origin: function(origin, callback) {
        // Permitir requisições sem origem (ex: Postman) e qualquer origem
        callback(null, true);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: false,
    optionsSuccessStatus: 200,
    preflightContinue: false
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuração do Swagger UI para HTTPS
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'WhatsApp Multi-Client API',
        version: '2.2.2',
        description: 'API para gerenciar múltiplas instâncias do WhatsApp com CORS DEFINITIVAMENTE corrigido'
    },
    servers: [
        {
            url: 'https://146.59.227.248',
            description: 'Servidor HTTPS de Produção com CORS DEFINITIVO'
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
                        description: 'Cliente conectando com CORS DEFINITIVO'
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
    customSiteTitle: 'WhatsApp Multi-Client API - CORS DEFINITIVO',
    swaggerOptions: {
        url: 'https://146.59.227.248/api-docs.json'
    }
}));

// Endpoint para servir o JSON do Swagger
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDocument);
});

// Load client sessions from file
const SESSION_FILE_PATH = './whatsapp-sessions.json';
let clientSessions = {};

const loadClientSessions = () => {
    try {
        if (fs.existsSync(SESSION_FILE_PATH)) {
            const sessionData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
            clientSessions = JSON.parse(sessionData);
            console.log('✅ Client sessions loaded from file.');
        }
    } catch (error) {
        console.error('❌ Error loading client sessions:', error);
    }
};

loadClientSessions();

const saveClientSessions = () => {
    try {
        fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(clientSessions, null, 2));
        console.log('✅ Client sessions saved to file.');
    } catch (error) {
        console.error('❌ Error saving client sessions:', error);
    }
};

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
        session: clientSessions[clientId],
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
            
        } catch (error) {
            console.error(`❌ [${timestamp}] ERRO ao gerar QR Code para ${clientId}:`, error);
        }
    });

    client.on('authenticated', (session) => {
        const timestamp = new Date().toISOString();
        console.log(`✅ [${timestamp}] Cliente ${clientId} AUTENTICADO`);
        clientSessions[clientId] = session;
        saveClientSessions();
        
        // LIMPAR QR CODE APÓS AUTENTICAÇÃO
        client.qrCode = null;
        client.qrTimestamp = null;
        
        // EMITIR PARA SALA ESPECÍFICA
        io.to(clientId).emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'authenticated',
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        });
        
        // EMITIR GERAL COMO BACKUP
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'authenticated',
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        });
    });

    client.on('auth_failure', function (session) {
        console.error(`❌ Falha de autenticação para ${clientId}`);
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'auth_failed',
            hasQrCode: false
        });
    });

    client.on('ready', () => {
        const timestamp = new Date().toISOString();
        const phoneNumber = client.info?.wid?.user ? phoneNumberFormatter(client.info.wid.user) : null;
        console.log(`🎉 [${timestamp}] Cliente ${clientId} CONECTADO! Telefone: ${phoneNumber}`);
        
        // LIMPAR QR CODE APÓS CONEXÃO
        client.qrCode = null;
        client.qrTimestamp = null;
        
        // EMITIR PARA SALA ESPECÍFICA
        io.to(clientId).emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'connected',
            phoneNumber: phoneNumber,
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        });
        
        // EMITIR GERAL COMO BACKUP
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'connected',
            phoneNumber: phoneNumber,
            hasQrCode: false,
            qrCode: null,
            timestamp: timestamp
        });
        
        // Emit clients update
        emitClientsUpdate();
    });

    client.on('message', msg => {
        console.log(`📩 Mensagem recebida em ${clientId}:`, msg.body.substring(0, 50));
        io.emit(`message_${clientId}`, msg);
    });

    client.on('disconnected', (reason) => {
        console.log(`❌ Cliente ${clientId} desconectado:`, reason);
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'disconnected',
            hasQrCode: false
        });
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
        version: '2.2.2-cors-definitivo',
        server: '146.59.227.248:4000',
        protocol: 'HTTPS',
        cors: {
            enabled: true,
            allowedOrigins: '*',
            allowedMethods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
            status: 'definitivo-configurado',
            lovableSupport: true,
            preflightFixed: true,
            optionsHandling: 'explicit'
        },
        swagger: {
            enabled: true,
            url: 'https://146.59.227.248/api-docs',
            jsonUrl: 'https://146.59.227.248/api-docs.json',
            corsFixed: true
        },
        routes: {
            '/clients': 'GET, POST',
            '/clients/:id/connect': 'POST ⭐ (CORS DEFINITIVO)',
            '/clients/:id/disconnect': 'POST',
            '/clients/:id/status': 'GET ⭐ (QR CODE DISPONÍVEL)',
            '/clients/:id/chats': 'GET',
            '/clients/:id/send-message': 'POST',
            '/clients/:id/send-audio': 'POST',
            '/clients/:id/send-image': 'POST',
            '/clients/:id/send-video': 'POST',
            '/clients/:id/send-document': 'POST',
            '/api-docs': 'GET ⭐ (SWAGGER HTTPS CORS DEFINITIVO)'
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
            delete clientSessions[clientId];
            saveClientSessions();
            
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
            const client = clients[clientId];
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
            
            const isConnected = client.info?.wid;
            const status = isConnected ? 'connected' : (qrCode ? 'qr_ready' : 'connecting');
            const phoneNumber = isConnected ? phoneNumberFormatter(client.info.wid.user) : null;
            
            const response = { 
                success: true, 
                clientId: clientId, 
                status: status, 
                phoneNumber: phoneNumber, 
                qrCode: qrCode,
                hasQrCode: !!qrCode,
                timestamp: timestamp,
                qrTimestamp: client.qrTimestamp
            };
            
            console.log(`✅ [${timestamp}] STATUS ${clientId}: ${status}, QR: ${!!qrCode}`);
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
    console.log(`🔧 CORS DEFINITIVAMENTE CORRIGIDO!`);
    console.log(`   - Preflight: Tratado EXPLICITAMENTE com status 200`);
    console.log(`   - Headers: ULTRA-específicos com Vary: Origin`);
    console.log(`   - OPTIONS: Resposta imediata sem processamento`);
    console.log(`   - Métodos: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`);
    console.log(`   - HTTPS: Swagger UI configurado definitivamente`);
    console.log(`📱 SERVIDOR HTTPS PRONTO - CORS DEFINITIVAMENTE RESOLVIDO!`);
});
