const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configurar multer para upload de arquivos
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Garantir que o diretório de uploads existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Garantir que o diretório de sessões existe
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
}

const clients = new Map();

// Função para gerar um ID único para o cliente
function generateClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Função para salvar a sessão
const saveSession = (clientId, session) => {
    try {
        const sessionPath = `./sessions/whatsapp-session-${clientId}.json`;
        fs.writeFileSync(sessionPath, JSON.stringify(session));
        console.log(`✅ Sessão salva para ${clientId}`);
    } catch (err) {
        console.error(`❌ Erro ao salvar sessão para ${clientId}:`, err);
    }
};

// Função para carregar a sessão
const loadSession = (clientId) => {
    try {
        const sessionFile = `./sessions/whatsapp-session-${clientId}.json`;
        if (fs.existsSync(sessionFile)) {
            const sessionData = fs.readFileSync(sessionFile, 'utf-8');
            return JSON.parse(sessionData);
        }
    } catch (err) {
        console.error(`❌ Erro ao carregar sessão para ${clientId}:`, err);
    }
    return null;
};

// Classe para gerenciar clientes WhatsApp
class WhatsAppClientManager {
    constructor(clientId) {
        this.clientId = clientId;
        this.client = null;
        this.status = 'disconnected';
        this.qrCode = null;
        this.phoneNumber = null;
        this.isReady = false;
        this.lastActivity = Date.now();
        this.chatCache = new Map();
        this.chatCacheTimeout = 30000; // 30 segundos
    }

    async initialize() {
        console.log(`🔄 Inicializando cliente WhatsApp: ${this.clientId}`);
        
        try {
            this.client = new Client({
                authStrategy: new LocalAuth({ clientId: this.clientId }),
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
                    ],
                    executablePath: undefined
                },
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
                }
            });

            this.setupEventHandlers();
            await this.client.initialize();
            
        } catch (error) {
            console.error(`❌ Erro ao inicializar cliente ${this.clientId}:`, error);
            this.updateStatus('error', error.message);
            throw error;
        }
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log(`🔄 QR Code recebido para ${this.clientId}`);
            qrcode.toDataURL(qr, (err, url) => {
                if (err) {
                    console.error(`❌ Erro ao gerar QR Code para ${this.clientId}:`, err);
                    return;
                }
                this.qrCode = url;
                this.updateStatus('qr_ready');
            });
        });

        this.client.on('authenticated', (session) => {
            console.log(`🔑 Cliente autenticado: ${this.clientId}`);
            saveSession(this.clientId, session);
            this.updateStatus('authenticated');
        });

        this.client.on('auth_failure', (msg) => {
            console.error(`❌ Falha na autenticação para ${this.clientId}:`, msg);
            this.updateStatus('auth_failed', msg);
        });

        this.client.on('ready', async () => {
            console.log(`✅ Cliente pronto: ${this.clientId}`);
            this.isReady = true;
            
            try {
                // Obter informações do usuário
                const info = this.client.info;
                if (info && info.wid) {
                    this.phoneNumber = info.wid.user;
                }
            } catch (error) {
                console.log(`⚠️ Não foi possível obter número do telefone para ${this.clientId}`);
            }
            
            this.updateStatus('connected');
        });

        this.client.on('message', async (msg) => {
            console.log(`📨 ===== MENSAGEM RECEBIDA (${this.clientId}) =====`);
            console.log(`📱 Tipo: ${msg.type}`);
            console.log(`📝 Corpo: ${msg.body?.substring(0, 50)}`);
            console.log(`🎥 Tem mídia: ${msg.hasMedia}`);
            console.log(`👤 De mim: ${msg.fromMe}`);
            console.log(`📞 De: ${msg.from}`);
            console.log(`🔢 ID: ${msg.id.id}`);
            
            this.lastActivity = Date.now();
            
            // PROCESSAMENTO ESPECIAL PARA MENSAGENS COM MÍDIA
            let mediaData = null;
            let mimetype = null;
            let filename = null;
            
            if (msg.hasMedia) {
                console.log(`🎵 ===== DETECTADA MENSAGEM COM MÍDIA =====`);
                console.log(`📋 Tipo de mídia: ${msg.type}`);
                
                try {
                    console.log(`⬇️ INICIANDO download da mídia...`);
                    const startTime = Date.now();
                    
                    const media = await msg.downloadMedia();
                    
                    const downloadTime = Date.now() - startTime;
                    console.log(`✅ MÍDIA BAIXADA COM SUCESSO em ${downloadTime}ms`);
                    console.log(`📊 Dados da mídia:`, {
                        mimetype: media.mimetype,
                        filename: media.filename,
                        dataLength: media.data?.length || 0,
                        hasData: !!media.data
                    });
                    
                    if (media && media.data) {
                        mediaData = media.data;
                        mimetype = media.mimetype;
                        filename = media.filename || `media_${Date.now()}`;
                        
                        console.log(`💾 DADOS DE MÍDIA PREPARADOS:`, {
                            mediaDataLength: mediaData.length,
                            mimetype,
                            filename,
                            isAudio: msg.type === 'audio' || msg.type === 'ptt'
                        });
                    } else {
                        console.error(`❌ DADOS DE MÍDIA VAZIOS OU INVÁLIDOS`);
                    }
                    
                } catch (mediaError) {
                    console.error(`❌ ERRO CRÍTICO ao baixar mídia:`, mediaError);
                    console.error(`💥 Stack trace:`, mediaError.stack);
                }
            }
            
            // CRIAR DADOS DA MENSAGEM COM MÍDIA
            const messageData = {
                id: msg.id.id,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp * 1000,
                fromMe: msg.fromMe,
                author: msg.author,
                from: msg.from,
                to: msg.to,
                hasMedia: msg.hasMedia,
                mediaData: mediaData,
                mimetype: mimetype,
                filename: filename,
                originalMessage: {
                    id: msg.id.id,
                    body: msg.body,
                    type: msg.type,
                    timestamp: msg.timestamp,
                    fromMe: msg.fromMe,
                    author: msg.author,
                    from: msg.from,
                    to: msg.to,
                    hasMedia: msg.hasMedia,
                    mediaData: mediaData,
                    mimetype: mimetype,
                    filename: filename,
                    notifyName: msg.notifyName,
                    pushName: msg.pushName
                }
            };
            
            console.log(`📤 ===== ENVIANDO MENSAGEM PARA FRONTEND =====`);
            console.log(`📊 Resumo da mensagem:`, {
                id: messageData.id,
                type: messageData.type,
                hasMedia: messageData.hasMedia,
                hasMediaData: !!messageData.mediaData,
                mediaDataLength: messageData.mediaData?.length || 0,
                fromMe: messageData.fromMe
            });
            
            // EMITIR PARA O FRONTEND
            io.emit(`message_${this.clientId}`, messageData);
            
            console.log(`✅ MENSAGEM ENVIADA PARA FRONTEND`);
            console.log(`================================================`);
        });

        this.client.on('disconnected', (reason) => {
            console.log(`❌ Cliente desconectado ${this.clientId}:`, reason);
            this.isReady = false;
            this.updateStatus('disconnected', reason);
        });

        // Adicionar handler para erros
        this.client.on('error', (error) => {
            console.error(`❌ Erro no cliente ${this.clientId}:`, error);
        });
    }

    updateStatus(status, error = null) {
        this.status = status;
        this.lastActivity = Date.now();
        
        const statusData = {
            clientId: this.clientId,
            status: this.status,
            phoneNumber: this.phoneNumber,
            hasQrCode: !!this.qrCode,
            qrCode: this.qrCode,
            error: error
        };
        
        io.emit(`client_status_${this.clientId}`, statusData);
        console.log(`📊 Status atualizado para ${this.clientId}: ${status}`);
    }

    async getChats() {
        if (!this.isReady || !this.client) {
            throw new Error('Cliente não está pronto');
        }

        // Verificar cache
        const cacheKey = 'chats';
        const cached = this.chatCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.chatCacheTimeout) {
            console.log(`📋 Retornando chats do cache para ${this.clientId}`);
            return cached.data;
        }

        console.log(`🔍 Buscando chats para ${this.clientId}...`);
        
        try {
            // Verificar estado do cliente
            const state = await this.client.getState();
            if (state !== 'CONNECTED') {
                throw new Error(`Cliente não conectado. Estado: ${state}`);
            }

            // Buscar chats com timeout
            const chatsPromise = this.client.getChats();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout ao buscar chats')), 15000);
            });

            const chats = await Promise.race([chatsPromise, timeoutPromise]);
            
            if (!chats || !Array.isArray(chats)) {
                throw new Error('Dados de chats inválidos');
            }

            console.log(`📱 ${chats.length} chats encontrados para ${this.clientId}`);
            
            const processedChats = [];
            
            // Processar chats com limite e timeout
            const maxChats = Math.min(chats.length, 50);
            for (let i = 0; i < maxChats; i++) {
                try {
                    const chat = chats[i];
                    
                    if (!chat || !chat.id || !chat.id._serialized) {
                        console.log(`⚠️ Chat inválido ignorado no índice ${i}`);
                        continue;
                    }

                    const chatInfo = {
                        id: chat.id._serialized,
                        name: chat.name || 'Contato sem nome',
                        isGroup: chat.isGroup || false,
                        isReadOnly: chat.isReadOnly || false,
                        unreadCount: chat.unreadCount || 0,
                        timestamp: Date.now()
                    };

                    // Tentar obter última mensagem com timeout curto
                    try {
                        const messagesPromise = chat.fetchMessages({ limit: 1 });
                        const messageTimeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Timeout mensagem')), 2000);
                        });

                        const messages = await Promise.race([messagesPromise, messageTimeoutPromise]);
                        
                        if (messages && messages.length > 0) {
                            const lastMessage = messages[0];
                            chatInfo.lastMessage = {
                                body: lastMessage.body || '',
                                type: lastMessage.type || 'text',
                                timestamp: (lastMessage.timestamp * 1000) || Date.now(),
                                fromMe: lastMessage.fromMe || false
                            };
                            chatInfo.timestamp = (lastMessage.timestamp * 1000) || Date.now();
                        }
                    } catch (msgError) {
                        // Ignorar erros de mensagem e continuar
                        console.log(`⚠️ Erro ao buscar mensagem do chat ${i}: ${msgError.message}`);
                    }

                    processedChats.push(chatInfo);
                    
                } catch (chatError) {
                    console.log(`⚠️ Erro ao processar chat ${i}: ${chatError.message}`);
                    continue;
                }
            }

            // Ordenar por timestamp
            processedChats.sort((a, b) => b.timestamp - a.timestamp);
            
            // Cachear resultado
            this.chatCache.set(cacheKey, {
                data: processedChats,
                timestamp: Date.now()
            });

            console.log(`✅ ${processedChats.length} chats processados com sucesso para ${this.clientId}`);
            return processedChats;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar chats para ${this.clientId}:`, error);
            throw new Error(`Falha ao buscar chats: ${error.message}`);
        }
    }

    async getChatMessages(chatId, limit = 20) {
        if (!this.isReady || !this.client) {
            throw new Error('Cliente não está pronto');
        }

        try {
            console.log(`📨 Buscando mensagens do chat ${chatId} para ${this.clientId}`);
            
            const chat = await this.client.getChatById(chatId);
            const messages = await chat.fetchMessages({ limit });
            
            const processedMessages = messages.map(message => ({
                id: message.id.id,
                body: message.body,
                type: message.type,
                timestamp: message.timestamp * 1000,
                fromMe: message.fromMe,
                author: message.author,
                from: message.from,
                to: message.to
            }));
            
            console.log(`✅ ${processedMessages.length} mensagens obtidas para ${this.clientId}`);
            return processedMessages;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar mensagens para ${this.clientId}:`, error);
            throw new Error(`Falha ao buscar mensagens: ${error.message}`);
        }
    }

    async sendMessage(to, message, options = {}) {
        if (!this.isReady || !this.client) {
            throw new Error('Cliente não está pronto');
        }

        try {
            console.log(`📤 Enviando mensagem para ${to} via ${this.clientId}`);
            await this.client.sendMessage(to, message, options);
            console.log(`✅ Mensagem enviada com sucesso via ${this.clientId}`);
        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem via ${this.clientId}:`, error);
            throw new Error(`Falha ao enviar mensagem: ${error.message}`);
        }
    }

    async sendMedia(to, media, options = {}) {
        if (!this.isReady || !this.client) {
            throw new Error('Cliente não está pronto');
        }

        try {
            console.log(`📤 Enviando mídia para ${to} via ${this.clientId}`);
            await this.client.sendMessage(to, media, options);
            console.log(`✅ Mídia enviada com sucesso via ${this.clientId}`);
        } catch (error) {
            console.error(`❌ Erro ao enviar mídia via ${this.clientId}:`, error);
            throw new Error(`Falha ao enviar mídia: ${error.message}`);
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.logout();
                await this.client.destroy();
            }
            this.isReady = false;
            this.updateStatus('disconnected');
            console.log(`✅ Cliente ${this.clientId} desconectado`);
        } catch (error) {
            console.error(`❌ Erro ao desconectar cliente ${this.clientId}:`, error);
        }
    }
}

// WebSocket connection
io.on('connection', socket => {
    console.log(`🔗 Nova conexão WebSocket: ${socket.id}`);

    socket.on('join_client', clientId => {
        console.log(`🤝 Cliente ${clientId} entrou na sala`);
        socket.join(clientId);
    });

    socket.on('disconnect', () => {
        console.log(`❌ WebSocket desconectado: ${socket.id}`);
    });
});

// Rota para criar um novo cliente
app.post('/api/clients', async (req, res) => {
    try {
        const clientId = generateClientId();
        console.log(`➕ Criando novo cliente: ${clientId}`);
        
        const clientManager = new WhatsAppClientManager(clientId);
        clients.set(clientId, clientManager);
        
        io.emit('clients_update', Array.from(clients.values()).map(c => ({
            clientId: c.clientId,
            status: c.status,
            phoneNumber: c.phoneNumber,
            hasQrCode: !!c.qrCode
        })));
        
        res.status(201).json({ success: true, clientId: clientId });
    } catch (error) {
        console.error('❌ Erro ao criar cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para conectar um cliente
app.post('/api/clients/:clientId/connect', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        console.log(`🔗 Conectando cliente: ${clientId}`);
        
        let clientManager = clients.get(clientId);
        if (!clientManager) {
            clientManager = new WhatsAppClientManager(clientId);
            clients.set(clientId, clientManager);
        }
        
        await clientManager.initialize();
        res.json({ success: true, clientId: clientId, status: 'connecting' });
        
    } catch (error) {
        console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para desconectar um cliente
app.post('/api/clients/:clientId/disconnect', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        console.log(`🔌 Desconectando cliente: ${clientId}`);
        
        const clientManager = clients.get(clientId);
        if (clientManager) {
            await clientManager.disconnect();
            clients.delete(clientId);
        }
        
        io.emit('clients_update', Array.from(clients.values()).map(c => ({
            clientId: c.clientId,
            status: c.status,
            phoneNumber: c.phoneNumber,
            hasQrCode: !!c.qrCode
        })));
        
        res.json({ success: true, clientId: clientId, status: 'disconnected' });
        
    } catch (error) {
        console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para obter todos os clientes
app.get('/api/clients', (req, res) => {
    try {
        console.log('📡 Solicitando todos os clientes');
        const clientList = Array.from(clients.values()).map(c => ({
            clientId: c.clientId,
            status: c.status,
            phoneNumber: c.phoneNumber,
            hasQrCode: !!c.qrCode
        }));
        
        console.log(`✅ ${clientList.length} clientes encontrados`);
        res.json({ success: true, clients: clientList });
    } catch (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para obter o status de um cliente
app.get('/api/clients/:clientId/status', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        console.log(`ℹ️ Solicitando status do cliente: ${clientId}`);
        
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        const statusData = {
            clientId: clientId,
            status: clientManager.status,
            phoneNumber: clientManager.phoneNumber,
            hasQrCode: !!clientManager.qrCode,
            qrCode: clientManager.qrCode
        };
        
        res.json({ success: true, ...statusData });
        
    } catch (error) {
        console.error(`❌ Erro ao obter status do cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para obter chats
app.get('/api/clients/:clientId/chats', async (req, res) => {
    const { clientId } = req.params;
    
    try {
        console.log(`📡 Solicitação de chats para cliente: ${clientId}`);
        
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({
                success: false,
                error: 'Cliente não encontrado'
            });
        }
        
        const chats = await clientManager.getChats();
        
        res.json({
            success: true,
            chats: chats
        });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar chats para ${clientId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para obter mensagens de um chat
app.get('/api/clients/:clientId/chats/:chatId/messages', async (req, res) => {
    const { clientId, chatId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    try {
        console.log(`✉️ Solicitando mensagens para o chat ${chatId} do cliente ${clientId}`);
        
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        const messages = await clientManager.getChatMessages(chatId, limit);
        res.json({ success: true, messages: messages });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar mensagens do chat ${chatId} para o cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para enviar mensagem de texto
app.post('/api/clients/:clientId/send-message', async (req, res) => {
    const { clientId } = req.params;
    const { to, message } = req.body;
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        await clientManager.sendMessage(to, message);
        res.json({ success: true, message: 'Mensagem enviada' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${to} do cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rotas para envio de mídia
app.post('/api/clients/:clientId/send-image', upload.single('file'), async (req, res) => {
    const { clientId } = req.params;
    const { to, caption } = req.body;
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Arquivo não fornecido' });
        }
        
        const media = MessageMedia.fromFilePath(req.file.path);
        const options = caption ? { caption } : {};
        
        await clientManager.sendMedia(to, media, options);
        
        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Imagem enviada' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar imagem:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/clients/:clientId/send-video', upload.single('file'), async (req, res) => {
    const { clientId } = req.params;
    const { to, caption } = req.body;
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Arquivo não fornecido' });
        }
        
        const media = MessageMedia.fromFilePath(req.file.path);
        const options = caption ? { caption } : {};
        
        await clientManager.sendMedia(to, media, options);
        
        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Vídeo enviado' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar vídeo:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota COMPLETAMENTE REESCRITA para enviar áudio - SUPORTA BASE64 E ARQUIVOS
app.post('/api/clients/:clientId/send-audio', upload.single('file'), async (req, res) => {
    const { clientId } = req.params;
    const { to, audioData, fileName } = req.body;
    
    console.log(`🎤 ===== NOVA REQUISIÇÃO DE ÁUDIO RECEBIDA =====`);
    console.log(`📱 Cliente: ${clientId}`);
    console.log(`📞 Para: ${to}`);
    console.log(`📁 Arquivo físico: ${!!req.file}`);
    console.log(`💾 Dados base64: ${!!audioData}`);
    console.log(`📝 Nome do arquivo: ${fileName || 'não especificado'}`);
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            console.error(`❌ Cliente ${clientId} não encontrado`);
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!clientManager.isReady) {
            console.error(`❌ Cliente ${clientId} não está pronto`);
            return res.status(503).json({ success: false, error: 'Cliente não está conectado' });
        }
        
        let tempFilePath = null;
        let detectedMimeType = 'audio/wav';
        let finalFileName = fileName || `audio_${Date.now()}.wav`;
        
        try {
            // CASO 1: Arquivo físico via multer (método tradicional)
            if (req.file) {
                console.log(`📁 PROCESSANDO ARQUIVO FÍSICO`);
                console.log(`📊 Detalhes do arquivo:`, {
                    originalName: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    path: req.file.path
                });
                
                tempFilePath = req.file.path;
                detectedMimeType = req.file.mimetype || 'audio/wav';
                finalFileName = req.file.originalname || finalFileName;
            }
            // CASO 2: Dados base64 (novo método)
            else if (audioData) {
                console.log(`💾 PROCESSANDO DADOS BASE64`);
                console.log(`📊 Tamanho base64: ${audioData.length} caracteres`);
                
                const tempFile = base64ToTempFile(audioData, 'wav');
                tempFilePath = tempFile.path;
                detectedMimeType = tempFile.detectedMimeType;
                finalFileName = tempFile.filename;
                
                console.log(`✅ Conversão base64 concluída:`, {
                    path: tempFilePath,
                    mimeType: detectedMimeType,
                    size: tempFile.size,
                    filename: finalFileName
                });
            }
            else {
                console.error(`❌ Nenhum dado de áudio fornecido`);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nenhum arquivo ou dados de áudio fornecidos' 
                });
            }
            
            // CRIAR MÍDIA PARA WHATSAPP
            console.log(`🎵 CRIANDO MÍDIA PARA WHATSAPP`);
            console.log(`📂 Arquivo: ${tempFilePath}`);
            console.log(`🎭 MIME Type: ${detectedMimeType}`);
            console.log(`📝 Nome: ${finalFileName}`);
            
            const media = MessageMedia.fromFilePath(tempFilePath);
            
            // CONFIGURAR MIME TYPE CORRETO (não forçar OGG!)
            media.mimetype = detectedMimeType;
            media.filename = finalFileName;
            
            console.log(`📤 ENVIANDO ÁUDIO VIA WHATSAPP`);
            console.log(`🎯 Destino: ${to}`);
            console.log(`📊 Mídia final:`, {
                mimetype: media.mimetype,
                filename: media.filename,
                hasData: !!media.data
            });
            
            // ENVIAR COM CONFIGURAÇÃO OTIMIZADA
            const sendOptions = {
                sendAudioAsVoice: true, // Enviar como nota de voz
                caption: '' // Sem legenda
            };
            
            await clientManager.sendMedia(to, media, sendOptions);
            
            console.log(`✅ ÁUDIO ENVIADO COM SUCESSO VIA WHATSAPP`);
            console.log(`🎉 Cliente: ${clientId} → ${to}`);
            
            res.json({ 
                success: true, 
                message: 'Áudio enviado com sucesso',
                details: {
                    mimeType: detectedMimeType,
                    filename: finalFileName,
                    method: req.file ? 'file' : 'base64'
                }
            });
            
        } catch (sendError) {
            console.error(`❌ ERRO AO ENVIAR ÁUDIO VIA WHATSAPP:`, sendError);
            console.error(`💥 Stack trace:`, sendError.stack);
            
            res.status(500).json({ 
                success: false, 
                error: `Erro ao enviar áudio: ${sendError.message}`,
                details: {
                    mimeType: detectedMimeType,
                    filename: finalFileName,
                    method: req.file ? 'file' : 'base64'
                }
            });
        } finally {
            // LIMPAR ARQUIVO TEMPORÁRIO
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log(`🗑️ Arquivo temporário removido: ${tempFilePath}`);
                } catch (cleanupError) {
                    console.error(`⚠️ Erro ao remover arquivo temporário:`, cleanupError);
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ ERRO GERAL NO PROCESSAMENTO DE ÁUDIO:`, error);
        console.error(`💥 Stack trace completo:`, error.stack);
        
        res.status(500).json({ 
            success: false, 
            error: `Erro interno: ${error.message}` 
        });
    }
    
    console.log(`🏁 ===== PROCESSAMENTO DE ÁUDIO FINALIZADO =====`);
});

app.post('/api/clients/:clientId/send-document', upload.single('file'), async (req, res) => {
    const { clientId } = req.params;
    const { to, caption } = req.body;
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Arquivo não fornecido' });
        }
        
        const media = MessageMedia.fromFilePath(req.file.path);
        media.filename = req.file.originalname;
        
        const options = caption ? { caption } : {};
        
        await clientManager.sendMedia(to, media, options);
        
        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Documento enviado' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar documento:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Funcão para detectar e processar mensagens citadas/marcadas
const processQuotedMessage = async (message, clientConnection) => {
  try {
    console.log('🔍 Verificando se mensagem tem citação:', {
      hasQuotedMsg: !!message.quotedMsg,
      hasContext: !!message.context,
      messageType: message.type
    });

    // Verificar se a mensagem tem citação
    if (!message.quotedMsg && !message.context?.quotedMsg) {
      return null;
    }

    const quotedMsg = message.quotedMsg || message.context.quotedMsg;
    
    console.log('📝 Mensagem citada detectada:', {
      quotedId: quotedMsg.id,
      quotedBody: quotedMsg.body?.substring(0, 100),
      quotedFrom: quotedMsg.from,
      quotedTimestamp: quotedMsg.timestamp
    });

    // Extrair contexto da mensagem citada
    const quotedContext = {
      originalMessage: quotedMsg.body || '',
      originalSender: quotedMsg.fromMe ? 'Assistente' : (quotedMsg.notifyName || quotedMsg.pushName || 'Cliente'),
      originalTimestamp: quotedMsg.timestamp,
      originalMessageId: quotedMsg.id,
      currentMessage: message.body || '',
      isReplyToAssistant: quotedMsg.fromMe || false
    };

    console.log('🎯 Contexto da mensagem citada processado:', quotedContext);

    return quotedContext;
  } catch (error) {
    console.error('❌ Erro ao processar mensagem citada:', error);
    return null;
  }
};

// Função para gerar resposta considerando mensagem citada
const generateQuotedResponse = async (quotedContext, aiConfig, assistant, recentMessages) => {
  try {
    console.log('🤖 Gerando resposta para mensagem citada...');

    // Modificar prompt para incluir contexto da citação
    let systemPrompt = assistant.prompt || 'Você é um assistente útil.';
    
    systemPrompt += `\n\nCONTEXTO IMPORTANTE - MENSAGEM CITADA:
O cliente está respondendo/se referindo a uma mensagem anterior:
- Mensagem original: "${quotedContext.originalMessage}"
- Enviada por: ${quotedContext.originalSender}
- Mensagem atual do cliente: "${quotedContext.currentMessage}"

Responda considerando que o cliente está se referindo especificamente à mensagem citada. 
${quotedContext.isReplyToAssistant ? 'O cliente está respondendo a uma de suas mensagens anteriores.' : 'O cliente está se referindo a uma mensagem que ele mesmo enviou antes.'}

Seja contextual e relevante à citação.`;

    console.log('📝 Prompt modificado para citação:', systemPrompt.substring(0, 200) + '...');

    // Preparar mensagens para a IA
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...recentMessages,
      {
        role: 'user', 
        content: `[REFERINDO-SE A: "${quotedContext.originalMessage}"] ${quotedContext.currentMessage}`
      }
    ];

    // Preparar configurações avançadas
    let advancedSettings = {
      temperature: 0.7,
      max_tokens: 1000
    };
    
    try {
      if (assistant.advanced_settings) {
        const parsedSettings = typeof assistant.advanced_settings === 'string' 
          ? JSON.parse(assistant.advanced_settings)
          : assistant.advanced_settings;
        
        advancedSettings = {
          temperature: Number(parsedSettings.temperature) || 0.7,
          max_tokens: Number(parsedSettings.max_tokens) || 1000
        };
      }
    } catch (error) {
      console.error('❌ Erro ao parse das configurações avançadas:', error);
    }

    // Chamar OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
        messages: messages,
        temperature: advancedSettings.temperature,
        max_tokens: advancedSettings.max_tokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content;

    if (assistantResponse && assistantResponse.trim()) {
      console.log('✅ Resposta contextual para citação gerada:', assistantResponse.substring(0, 100) + '...');
      return {
        response: assistantResponse,
        confidence: data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
        wasQuotedReply: true,
        quotedContext: quotedContext
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao gerar resposta para citação:', error);
    return null;
  }
};

// Modificar a função principal de processamento de mensagens
const processIncomingMessage = async (message, clientConnection) => {
  try {
    console.log('📨 Processando mensagem recebida:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      hasQuoted: !!(message.quotedMsg || message.context?.quotedMsg),
      timestamp: message.timestamp
    });

    // Verificar se é mensagem citada
    const quotedContext = await processQuotedMessage(message, clientConnection);
    const isQuotedReply = !!quotedContext;

    console.log('🎯 Tipo de mensagem:', isQuotedReply ? 'CITAÇÃO' : 'NORMAL');

    // Buscar configurações do cliente
    const { rows: aiConfigRows } = await pool.query(
      'SELECT * FROM client_ai_configs WHERE client_id = $1',
      [clientConnection.clientId]
    );

    if (aiConfigRows.length === 0) {
      console.log('⚠️ Nenhuma configuração de IA encontrada para cliente:', clientConnection.clientId);
      return;
    }

    const aiConfig = aiConfigRows[0];

    // Buscar assistente ativo
    const { rows: assistantRows } = await pool.query(`
      SELECT a.* FROM assistants a 
      JOIN queues q ON q.assistant_id = a.id 
      JOIN instance_queue_connections iqc ON iqc.queue_id = q.id 
      JOIN whatsapp_instances wi ON wi.id = iqc.instance_id 
      WHERE wi.client_id = $1 AND q.is_active = true AND a.is_active = true 
      LIMIT 1
    `, [clientConnection.clientId]);

    if (assistantRows.length === 0) {
      console.log('⚠️ Nenhum assistente ativo encontrado');
      return;
    }

    const assistant = assistantRows[0];
    console.log('🤖 Processando com assistente:', assistant.name);

    // Buscar histórico de mensagens recentes
    const { rows: messageRows } = await pool.query(`
      SELECT content, from_me, timestamp 
      FROM ticket_messages tm
      JOIN conversation_tickets ct ON ct.id = tm.ticket_id
      WHERE ct.chat_id = $1 AND ct.client_id = $2
      ORDER BY tm.timestamp DESC 
      LIMIT 10
    `, [message.from, clientConnection.clientId]);

    const recentMessages = messageRows
      .reverse()
      .map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content || ''
      }));

    // Processar reações automáticas se não for citação (evitar conflito)
    let emotionContext = '';
    if (!isQuotedReply) {
      const emotionResult = await processAutomaticReaction(message, clientConnection);
      if (emotionResult) {
        emotionContext = emotionResult.contextModifier;
      }
    }

    // Gerar resposta
    let assistantResponse, confidence, responseMetadata = {};

    if (isQuotedReply) {
      // Resposta específica para mensagem citada
      const quotedResponse = await generateQuotedResponse(quotedContext, aiConfig, assistant, recentMessages);
      if (quotedResponse) {
        assistantResponse = quotedResponse.response;
        confidence = quotedResponse.confidence;
        responseMetadata = {
          wasQuotedReply: true,
          quotedContext: quotedResponse.quotedContext
        };
      }
    } else {
      // Resposta normal
      let systemPrompt = assistant.prompt || 'Você é um assistente útil.';
      if (emotionContext) {
        systemPrompt += `\n\nContexto emocional da conversa:${emotionContext}`;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...recentMessages,
            { role: 'user', content: message.body || '' }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        assistantResponse = data.choices?.[0]?.message?.content;
        confidence = data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7;
      }
    }

    if (assistantResponse && assistantResponse.trim()) {
      console.log(`✅ Resposta ${isQuotedReply ? 'contextual' : 'normal'} gerada:`, assistantResponse.substring(0, 100) + '...');
      
      // Enviar resposta com delay humanizado
      await sendTypingIndicator(message.from, clientConnection, true);
      
      setTimeout(async () => {
        try {
          await clientConnection.sendMessage(message.from, assistantResponse);
          await sendTypingIndicator(message.from, clientConnection, false);
          
          console.log(`📤 Resposta ${isQuotedReply ? 'contextual' : 'automática'} enviada com sucesso`);
          
          // Salvar resposta no banco com metadados
          await pool.query(`
            INSERT INTO ticket_messages (
              ticket_id, message_id, from_me, sender_name, content, 
              message_type, is_ai_response, ai_confidence_score, 
              processing_status, timestamp
            ) 
            SELECT 
              ct.id, $1, true, $2, $3, 
              'text', true, $4, 
              'completed', $5
            FROM conversation_tickets ct 
            WHERE ct.chat_id = $6 AND ct.client_id = $7 
            LIMIT 1
          `, [
            `ai_${isQuotedReply ? 'quoted' : 'auto'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            assistant.name,
            assistantResponse,
            confidence,
            new Date().toISOString(),
            message.from,
            clientConnection.clientId
          ]);

        } catch (error) {
          console.error('❌ Erro ao enviar resposta:', error);
        }
      }, isQuotedReply ? 1500 : 3000); // Delay menor para respostas contextuais
    }

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
};

// Rota para enviar mensagem citada manual
app.post('/api/clients/:clientId/send-quoted-message', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { chatId, message, quotedMessageId, quotedContent } = req.body;

    console.log('📤 Enviando mensagem citada manual:', {
      clientId,
      chatId,
      quotedMessageId,
      message: message.substring(0, 50)
    });

    const clientConnection = connectedClients.get(clientId);
    if (!clientConnection) {
      return res.status(404).json({ error: 'Cliente não conectado' });
    }

    // Enviar mensagem citada
    await clientConnection.sendMessage(chatId, message, {
      quotedMessageId: quotedMessageId,
      quotedContent: quotedContent
    });

    console.log('✅ Mensagem citada enviada com sucesso');
    res.json({ success: true, message: 'Mensagem citada enviada' });

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem citada:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Health check
app.get('/health', (req, res) => {
    const activeClients = clients.size;
    const connectedClients = Array.from(clients.values()).filter(c => c.status === 'connected').length;
    
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeClients: activeClients,
        connectedClients: connectedClients,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
        server: `${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 4000}`
    });
});

// Middleware para limpeza periódica
setInterval(() => {
    const now = Date.now();
    const inactiveTime = 30 * 60 * 1000; // 30 minutos
    
    for (const [clientId, clientManager] of clients.entries()) {
        if (now - clientManager.lastActivity > inactiveTime && clientManager.status === 'disconnected') {
            console.log(`🧹 Removendo cliente inativo: ${clientId}`);
            clients.delete(clientId);
        }
        
        // Limpar cache de chats antigos
        for (const [key, cached] of clientManager.chatCache.entries()) {
            if (now - cached.timestamp > clientManager.chatCacheTimeout) {
                clientManager.chatCache.delete(key);
            }
        }
    }
}, 5 * 60 * 1000); // Executar a cada 5 minutos

const port = process.env.PORT || 4000;
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor WhatsApp Multi-Client rodando na porta ${port}`);
    console.log(`📊 Timestamp: ${new Date().toISOString()}`);
    console.log(`🔧 Node.js: ${process.version}`);
    console.log(`💾 Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
});

// Função auxiliar para detectar formato de áudio
function detectAudioFormat(buffer) {
    const signatures = {
        'audio/wav': [0x52, 0x49, 0x46, 0x46], // RIFF
        'audio/mp3': [0xFF, 0xFB], // MP3 frame sync
        'audio/mpeg': [0xFF, 0xFB], // MPEG
        'audio/ogg': [0x4F, 0x67, 0x67, 0x53], // OggS
        'audio/webm': [0x1A, 0x45, 0xDF, 0xA3], // WebM
        'audio/m4a': [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70] // M4A
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
        if (signature.every((byte, index) => buffer[index] === byte)) {
            return mimeType;
        }
    }
    
    return 'audio/wav'; // fallback padrão
}

// Função para converter base64 para arquivo temporário
function base64ToTempFile(base64Data, format = 'wav') {
    try {
        console.log(`🔄 Convertendo base64 para arquivo temporário (${format})`);
        
        // Remover prefixo data URL se presente
        const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
        
        // Converter para buffer
        const buffer = Buffer.from(cleanBase64, 'base64');
        
        console.log(`📊 Buffer criado:`, {
            size: buffer.length,
            format: format,
            firstBytes: Array.from(buffer.slice(0, 8)).map(b => '0x' + b.toString(16)).join(' ')
        });
        
        // Detectar formato real
        const detectedFormat = detectAudioFormat(buffer);
        console.log(`🔍 Formato detectado: ${detectedFormat}`);
        
        // Criar arquivo temporário
        const tempFileName = `temp_audio_${Date.now()}.${format}`;
        const tempFilePath = path.join('uploads', tempFileName);
        
        fs.writeFileSync(tempFilePath, buffer);
        
        console.log(`✅ Arquivo temporário criado: ${tempFilePath}`);
        
        return {
            path: tempFilePath,
            detectedMimeType: detectedFormat,
            size: buffer.length,
            filename: tempFileName
        };
        
    } catch (error) {
        console.error(`❌ Erro ao converter base64 para arquivo:`, error);
        throw error;
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Recebido SIGTERM, desconectando clientes...');
    
    for (const clientManager of clients.values()) {
        try {
            await clientManager.disconnect();
        } catch (error) {
            console.error('Erro ao desconectar cliente:', error);
        }
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Recebido SIGINT, desconectando clientes...');
    
    for (const clientManager of clients.values()) {
        try {
            await clientManager.disconnect();
        } catch (error) {
            console.error('Erro ao desconectar cliente:', error);
        }
    }
    
    process.exit(0);
});
