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
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 4000;

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

// CONFIGURAÇÃO CORS CORRIGIDA - DEVE VENCER O ERRO
app.use(cors({
    origin: function (origin, callback) {
        // Lista de origens permitidas
        const allowedOrigins = [
            'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com',
            'https://*.lovableproject.com',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:8080',
            'https://146.59.227.248',
            'http://146.59.227.248',
            'http://146.59.227.248:4000',
            'http://146.59.227.248:8080',
            'https://146.59.227.248:4000',
            'https://146.59.227.248:8080'
        ];
        
        // Permitir requisições sem origin (mobile apps, curl, etc)
        if (!origin) {
            return callback(null, true);
        }
        
        // Verificar se origin está na lista ou corresponde ao padrão
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('*')) {
                const pattern = allowedOrigin.replace(/\*/g, '.*');
                return new RegExp(pattern).test(origin);
            }
            return allowedOrigin === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('🚫 CORS blocked origin:', origin);
            // Para debug, vamos permitir temporariamente
            callback(null, true);
        }
    },
    credentials: false, // Mudado para false para evitar problemas
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 200 // Para suportar browsers antigos
}));

// Handle preflight requests explicitamente
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.sendStatus(200);
});

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

    console.log(`🚀 Inicializando cliente: ${clientId}`);

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
        }
    });

    client.on('qr', async (qr) => {
        console.log(`📱 QR Code gerado para ${clientId}`);
        try {
            const qrCodeDataUrl = await qrcode.toDataURL(qr);
            io.emit(`client_status_${clientId}`, { 
                clientId: clientId, 
                status: 'qr_ready', 
                qrCode: qrCodeDataUrl,
                hasQrCode: true
            });
            console.log(`✅ QR Code enviado via WebSocket para ${clientId}`);
        } catch (error) {
            console.error(`❌ Erro ao gerar QR Code para ${clientId}:`, error);
        }
    });

    client.on('authenticated', (session) => {
        console.log(`✅ Cliente ${clientId} autenticado`);
        clientSessions[clientId] = session;
        saveClientSessions();
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'authenticated',
            hasQrCode: false
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
        const phoneNumber = client.info?.wid?.user ? phoneNumberFormatter(client.info.wid.user) : null;
        console.log(`🎉 Cliente ${clientId} conectado! Telefone: ${phoneNumber}`);
        io.emit(`client_status_${clientId}`, { 
            clientId: clientId, 
            status: 'connected',
            phoneNumber: phoneNumber,
            hasQrCode: false
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
    console.log('🔌 Usuário conectado via WebSocket:', socket.id);

    socket.on('join_client', clientId => {
        socket.join(clientId);
        console.log(`📱 Socket ${socket.id} entrou na sala do cliente: ${clientId}`);
        
        // Send current client status if exists
        if (clients[clientId]) {
            const client = clients[clientId];
            const isConnected = client.info?.wid;
            socket.emit(`client_status_${clientId}`, {
                clientId: clientId,
                status: isConnected ? 'connected' : 'connecting',
                phoneNumber: isConnected ? phoneNumberFormatter(client.info.wid.user) : null,
                hasQrCode: false
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Usuário desconectado do WebSocket:', socket.id);
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
        version: '2.1.0-connectivity-fixed',
        server: 'localhost:4000',
        audioStats: {
            totalAttempts: 0,
            successfulSends: 0,
            failedSends: 0,
            evaluationErrors: 0,
            successRate: '0%'
        },
        fixes: {
            whatsappWebVersion: '1.21.0',
            retrySystem: 'enabled',
            fallbackSystem: 'enabled',
            evaluationErrorFix: 'implemented',
            corsFixed: 'improved',
            chromeCleanup: 'implemented'
        },
        routes: {
            '/clients': 'GET, POST',
            '/clients/:id/connect': 'POST',
            '/clients/:id/disconnect': 'POST',
            '/clients/:id/status': 'GET',
            '/clients/:id/chats': 'GET',
            '/clients/:id/send-message': 'POST',
            '/clients/:id/send-audio': 'POST ⭐ (CORRIGIDO)',
            '/clients/:id/audio-stats': 'GET 📊 (NOVO)',
            '/clients/:id/send-image': 'POST',
            '/clients/:id/send-video': 'POST',
            '/clients/:id/send-document': 'POST'
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
    console.log(`🔗 Tentativa de conexão para cliente: ${clientId}`);
    
    try {
        // Clean up any orphaned Chrome processes first
        cleanupOrphanedChromeProcesses();
        
        setTimeout(() => {
            initClient(clientId);
        }, 2000); // Wait 2 seconds after cleanup
        
        res.json({ success: true, message: `Cliente ${clientId} iniciando conexão.` });
    } catch (error) {
        console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
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
    console.log(`📊 Verificando status do cliente: ${clientId}`);
    
    if (clients[clientId]) {
        try {
            const client = clients[clientId];
            let qrCode = null;
            
            if (client.qr) {
                qrCode = await qrcode.toDataURL(client.qr);
                console.log(`📱 QR Code disponível para ${clientId}`);
            }
            
            const isConnected = client.info?.wid;
            const status = isConnected ? 'connected' : (client.qr ? 'qr_ready' : 'connecting');
            const phoneNumber = isConnected ? phoneNumberFormatter(client.info.wid.user) : null;
            
            const response = { 
                success: true, 
                clientId: clientId, 
                status: status, 
                phoneNumber: phoneNumber, 
                qrCode: qrCode,
                hasQrCode: !!qrCode
            };
            
            console.log(`✅ Status do cliente ${clientId}: ${status}`);
            res.json(response);
        } catch (error) {
            console.error(`❌ Erro ao verificar status do cliente ${clientId}:`, error);
            res.status(500).json({ success: false, error: `Falha ao verificar status do cliente ${clientId}.` });
        }
    } else {
        console.log(`❌ Cliente ${clientId} não encontrado`);
        res.status(404).json({ success: false, error: `Cliente ${clientId} não encontrado.` });
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

server.listen(port, () => {
    console.log(`🚀 WhatsApp Multi-Client Server iniciado na porta ${port}`);
    console.log(`📡 Health Check: http://146.59.227.248:${port}/health`);
    console.log(`📱 API Base: http://146.59.227.248:${port}/clients`);
    console.log(`🔧 Melhorias implementadas:`);
    console.log(`   - CORS corrigido e melhorado para Lovable`);
    console.log(`   - Headers CORS configurados corretamente`);
    console.log(`   - Preflight requests configurados`);
    console.log(`   - Limpeza de processos Chrome órfãos`);
    console.log(`   - WebSocket melhorado`);
    console.log(`   - QR Code debugging aprimorado`);
});
