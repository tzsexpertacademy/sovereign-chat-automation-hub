const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AudioSendService = require('./services/audioSendService');

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
const audioSendService = new AudioSendService();

// ===== FUNÇÕES AUXILIARES DEFINIDAS PRIMEIRO =====

// Função para detectar formato de áudio
function detectAudioFormat(buffer) {
    console.log('🔍 Detectando formato de áudio...', {
        bufferSize: buffer.length,
        firstBytes: Array.from(buffer.slice(0, 8)).map(b => '0x' + b.toString(16)).join(' ')
    });
    
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
            console.log(`✅ Formato detectado: ${mimeType}`);
            return mimeType;
        }
    }
    
    console.log('⚠️ Formato não detectado, usando audio/ogg como fallback');
    return 'audio/ogg'; // fallback padrão mudado para OGG
}

// Função para converter base64 para arquivo temporário
function base64ToTempFile(base64Data, format = 'ogg') {
    try {
        console.log(`🔄 INICIANDO conversão base64 para arquivo temporário`);
        console.log(`📊 Parâmetros:`, {
            base64Length: base64Data.length,
            format: format,
            hasDataPrefix: base64Data.startsWith('data:')
        });
        
        // Remover prefixo data URL se presente
        const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
        console.log(`🧹 Base64 limpo: ${cleanBase64.length} caracteres`);
        
        // Converter para buffer
        const buffer = Buffer.from(cleanBase64, 'base64');
        console.log(`📦 Buffer criado: ${buffer.length} bytes`);
        
        // Detectar formato real
        const detectedFormat = detectAudioFormat(buffer);
        
        // Criar arquivo temporário
        const tempFileName = `temp_audio_${Date.now()}.${format}`;
        const tempFilePath = path.join('uploads', tempFileName);
        
        console.log(`💾 Salvando em: ${tempFilePath}`);
        fs.writeFileSync(tempFilePath, buffer);
        
        const fileStats = fs.statSync(tempFilePath);
        console.log(`✅ Arquivo temporário criado com sucesso:`, {
            path: tempFilePath,
            size: fileStats.size,
            detectedMimeType: detectedFormat,
            filename: tempFileName
        });
        
        return {
            path: tempFilePath,
            detectedMimeType: detectedFormat,
            size: fileStats.size,
            filename: tempFileName
        };
        
    } catch (error) {
        console.error(`❌ ERRO CRÍTICO ao converter base64 para arquivo:`, error);
        console.error(`💥 Stack trace:`, error.stack);
        throw error;
    }
}

// ===== CONTINUAR COM O RESTO DO CÓDIGO =====

function generateClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const saveSession = (clientId, session) => {
    try {
        const sessionPath = `./sessions/whatsapp-session-${clientId}.json`;
        fs.writeFileSync(sessionPath, JSON.stringify(session));
        console.log(`✅ Sessão salva para ${clientId}`);
    } catch (err) {
        console.error(`❌ Erro ao salvar sessão para ${clientId}:`, err);
    }
};

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
        this.audioStats = {
            totalAttempts: 0,
            successfulSends: 0,
            failedSends: 0,
            evaluationErrors: 0
        };
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
                        '--disable-renderer-backgrounding',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--disable-ipc-flooding-protection'
                    ],
                    executablePath: undefined,
                    timeout: 60000 // Timeout aumentado para 60s
                },
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2408.13.html',
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
            
            io.emit(`message_${this.clientId}`, messageData);
            console.log(`✅ MENSAGEM ENVIADA PARA FRONTEND`);
        });

        this.client.on('disconnected', (reason) => {
            console.log(`❌ Cliente desconectado ${this.clientId}:`, reason);
            this.isReady = false;
            this.updateStatus('disconnected', reason);
        });

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
            error: error,
            audioStats: this.getAudioStats()
        };
        
        io.emit(`client_status_${this.clientId}`, statusData);
        console.log(`📊 Status atualizado para ${this.clientId}: ${status}`);
    }

    getAudioStats() {
        const successRate = this.audioStats.totalAttempts > 0 
            ? (this.audioStats.successfulSends / this.audioStats.totalAttempts * 100).toFixed(1)
            : 0;
            
        return {
            ...this.audioStats,
            successRate: `${successRate}%`
        };
    }

    async getChats() {
        if (!this.isReady || !this.client) {
            throw new Error('Cliente não está pronto');
        }

        const cacheKey = 'chats';
        const cached = this.chatCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.chatCacheTimeout) {
            console.log(`📋 Retornando chats do cache para ${this.clientId}`);
            return cached.data;
        }

        console.log(`🔍 Buscando chats para ${this.clientId}...`);
        
        try {
            const state = await this.client.getState();
            if (state !== 'CONNECTED') {
                throw new Error(`Cliente não conectado. Estado: ${state}`);
            }

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
                        console.log(`⚠️ Erro ao buscar mensagem do chat ${i}: ${msgError.message}`);
                    }

                    processedChats.push(chatInfo);
                    
                } catch (chatError) {
                    console.log(`⚠️ Erro ao processar chat ${i}: ${chatError.message}`);
                    continue;
                }
            }

            processedChats.sort((a, b) => b.timestamp - a.timestamp);
            
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

    async sendAudio(to, audioPath, originalFileName = 'audio') {
        console.log(`🎵 ===== MÉTODO sendAudio CHAMADO =====`);
        console.log(`📁 Arquivo: ${audioPath}`);
        console.log(`📞 Para: ${to}`);
        console.log(`📋 Nome original: ${originalFileName}`);
        
        this.audioStats.totalAttempts++;
        
        try {
            const result = await audioSendService.sendAudioWithRetry(
                this.client, 
                to, 
                audioPath, 
                originalFileName
            );
            
            if (result.success) {
                this.audioStats.successfulSends++;
                console.log(`✅ Áudio enviado com sucesso:`, result);
            } else {
                this.audioStats.failedSends++;
                if (result.error && result.error.includes('Evaluation failed')) {
                    this.audioStats.evaluationErrors++;
                }
                console.error(`❌ Falha no envio de áudio:`, result);
            }
            
            return result;
            
        } catch (error) {
            this.audioStats.failedSends++;
            console.error(`💥 Erro crítico no sendAudio:`, error);
            throw error;
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

// ===== WEBSOCKET E ROTAS =====

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

// ===== ROTAS HTTP =====

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
        console.log(`📤 ROTA /send-message chamada:`, {
            clientId,
            to: to?.substring(0, 20) + '...',
            message: message?.substring(0, 50) + '...'
        });
        
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            console.error(`❌ Cliente ${clientId} não encontrado`);
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        await clientManager.sendMessage(to, message);
        console.log(`✅ Mensagem enviada com sucesso via ${clientId}`);
        res.json({ success: true, message: 'Mensagem enviada' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${to} do cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ROTA DE ÁUDIO COMPLETAMENTE REESCRITA COM RETRY INTELIGENTE =====
app.post('/api/clients/:clientId/send-audio', upload.single('file'), async (req, res) => {
    const { clientId } = req.params;
    const { to, audioData, fileName } = req.body;
    
    console.log(`🎤 ===== ROTA /send-audio CHAMADA (VERSÃO CORRIGIDA) =====`);
    console.log(`📊 Parâmetros recebidos:`, {
        clientId: clientId,
        to: to,
        hasPhysicalFile: !!req.file,
        hasBase64Data: !!audioData,
        fileName: fileName,
        requestMethod: req.method,
        requestUrl: req.url,
        contentType: req.headers['content-type']
    });
    
    // VALIDAÇÕES INICIAIS
    if (!clientId) {
        console.error(`❌ ClientId não fornecido`);
        return res.status(400).json({ success: false, error: 'Client ID é obrigatório' });
    }
    
    if (!to) {
        console.error(`❌ Destinatário não fornecido`);
        return res.status(400).json({ success: false, error: 'Destinatário é obrigatório' });
    }
    
    try {
        // VERIFICAR SE CLIENTE EXISTE E ESTÁ CONECTADO
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            console.error(`❌ Cliente ${clientId} não encontrado na lista`);
            console.log(`📋 Clientes disponíveis:`, Array.from(clients.keys()));
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!clientManager.isReady) {
            console.error(`❌ Cliente ${clientId} não está pronto (status: ${clientManager.status})`);
            return res.status(503).json({ 
                success: false, 
                error: 'Cliente não está conectado',
                clientStatus: clientManager.status
            });
        }
        
        console.log(`✅ Cliente ${clientId} está pronto para envio`);
        
        let tempFilePath = null;
        let finalFileName = fileName || `audio_${Date.now()}.ogg`;
        
        try {
            // PROCESSAMENTO DO ARQUIVO
            if (req.file) {
                // CASO 1: Arquivo físico via multer
                console.log(`📁 PROCESSANDO ARQUIVO FÍSICO ENVIADO`);
                console.log(`📊 Detalhes do arquivo:`, {
                    originalName: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    path: req.file.path
                });
                
                tempFilePath = req.file.path;
                finalFileName = req.file.originalname || finalFileName;
                
            } else if (audioData) {
                // CASO 2: Dados base64 (método do frontend)
                console.log(`💾 PROCESSANDO DADOS BASE64 DO FRONTEND`);
                console.log(`📊 Tamanho base64: ${audioData.length} caracteres`);
                
                if (audioData.length < 100) {
                    throw new Error(`Base64 muito pequeno: ${audioData.length} caracteres`);
                }
                
                const tempFile = base64ToTempFile(audioData, 'ogg');
                tempFilePath = tempFile.path;
                finalFileName = tempFile.filename;
                
                console.log(`✅ Conversão base64 concluída com sucesso:`, {
                    path: tempFilePath,
                    mimeType: tempFile.detectedMimeType,
                    size: tempFile.size,
                    filename: finalFileName
                });
                
            } else {
                console.error(`❌ Nenhum dado de áudio foi fornecido`);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nenhum arquivo ou dados de áudio fornecidos',
                    receivedData: {
                        hasFile: !!req.file,
                        hasAudioData: !!audioData,
                        bodyKeys: Object.keys(req.body)
                    }
                });
            }
            
            // VERIFICAR SE ARQUIVO FOI CRIADO
            if (!tempFilePath || !fs.existsSync(tempFilePath)) {
                throw new Error(`Arquivo temporário não foi criado: ${tempFilePath}`);
            }
            
            const fileStats = fs.statSync(tempFilePath);
            console.log(`📁 Arquivo temporário verificado:`, {
                path: tempFilePath,
                exists: true,
                size: fileStats.size
            });
            
            // USAR NOVO SERVIÇO DE ÁUDIO COM RETRY INTELIGENTE
            console.log(`🚀 INICIANDO ENVIO COM RETRY INTELIGENTE`);
            
            const result = await clientManager.sendAudio(to, tempFilePath, finalFileName);
            
            if (result.success) {
                console.log(`🎉 ===== ÁUDIO ENVIADO COM SUCESSO =====`);
                console.log(`✅ Cliente: ${clientId} → ${to}`);
                console.log(`🎯 Resultado:`, result);
                
                // RESPOSTA DE SUCESSO
                res.json({ 
                    success: true, 
                    message: result.message || 'Áudio enviado com sucesso',
                    details: {
                        clientId: clientId,
                        to: to,
                        filename: finalFileName,
                        fileSize: fileStats.size,
                        method: req.file ? 'physical-file' : 'base64-data',
                        attempts: result.attempt || 1,
                        format: result.format || 'ogg',
                        isFallback: result.isFallback || false,
                        timestamp: new Date().toISOString()
                    }
                });
            } else {
                console.error(`❌ FALHA NO ENVIO DE ÁUDIO:`, result);
                
                // RESPOSTA DE ERRO DETALHADA
                res.status(500).json({ 
                    success: false, 
                    error: result.error || 'Erro desconhecido no envio de áudio',
                    details: {
                        clientId: clientId,
                        to: to,
                        filename: finalFileName,
                        fileSize: fileStats.size,
                        method: req.file ? 'physical-file' : 'base64-data',
                        attempts: result.attempts || 0,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
        } catch (processingError) {
            console.error(`❌ ERRO NO PROCESSAMENTO DE ÁUDIO:`, processingError);
            console.error(`💥 Stack trace:`, processingError.stack);
            
            // RESPOSTA DE ERRO DETALHADA
            res.status(500).json({ 
                success: false, 
                error: `Erro ao processar áudio: ${processingError.message}`,
                details: {
                    clientId: clientId,
                    processingStep: 'audio-processing',
                    filename: finalFileName,
                    method: req.file ? 'physical-file' : 'base64-data',
                    timestamp: new Date().toISOString()
                }
            });
            
        } finally {
            // LIMPEZA DE ARQUIVO TEMPORÁRIO
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log(`🗑️ Arquivo temporário removido: ${tempFilePath}`);
                } catch (cleanupError) {
                    console.error(`⚠️ Erro ao remover arquivo temporário:`, cleanupError);
                }
            }
        }
        
    } catch (generalError) {
        console.error(`❌ ERRO GERAL NA ROTA /send-audio:`, generalError);
        console.error(`💥 Stack trace completo:`, generalError.stack);
        
        res.status(500).json({ 
            success: false, 
            error: `Erro interno do servidor: ${generalError.message}`,
            details: {
                clientId: clientId,
                timestamp: new Date().toISOString(),
                errorType: 'general-server-error'
            }
        });
    }
    
    console.log(`🏁 ===== PROCESSAMENTO /send-audio FINALIZADO =====`);
});

// Rota para obter estatísticas de áudio
app.get('/api/clients/:clientId/audio-stats', (req, res) => {
    const { clientId } = req.params;
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        const stats = clientManager.getAudioStats();
        const serviceStats = audioSendService.getStats();
        
        res.json({ 
            success: true, 
            clientStats: stats,
            serviceConfig: serviceStats
        });
        
    } catch (error) {
        console.error(`❌ Erro ao obter estatísticas de áudio:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para enviar imagem
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
        
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Imagem enviada' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar imagem:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para enviar vídeo
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
        
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Vídeo enviado' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar vídeo:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para enviar documento
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
        
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Documento enviado' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar documento:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check com informações de áudio
app.get('/health', (req, res) => {
    const activeClients = clients.size;
    const connectedClients = Array.from(clients.values()).filter(c => c.status === 'connected').length;
    
    // Calcular estatísticas gerais de áudio
    let totalAudioAttempts = 0;
    let totalAudioSuccess = 0;
    let totalEvaluationErrors = 0;
    
    for (const client of clients.values()) {
        const stats = client.getAudioStats();
        totalAudioAttempts += stats.totalAttempts;
        totalAudioSuccess += stats.successfulSends;
        totalEvaluationErrors += stats.evaluationErrors;
    }
    
    const audioSuccessRate = totalAudioAttempts > 0 
        ? (totalAudioSuccess / totalAudioAttempts * 100).toFixed(1)
        : 0;
    
    console.log(`💚 Health check solicitado - ${activeClients} clientes ativos, ${connectedClients} conectados`);
    
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeClients: activeClients,
        connectedClients: connectedClients,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.1.0-audio-fixed',
        server: `${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 4000}`,
        audioStats: {
            totalAttempts: totalAudioAttempts,
            successfulSends: totalAudioSuccess,
            failedSends: totalAudioAttempts - totalAudioSuccess,
            evaluationErrors: totalEvaluationErrors,
            successRate: `${audioSuccessRate}%`
        },
        fixes: {
            whatsappWebVersion: '1.21.0',
            retrySystem: 'enabled',
            fallbackSystem: 'enabled',
            evaluationErrorFix: 'implemented'
        },
        routes: {
            '/api/clients': 'GET, POST',
            '/api/clients/:id/connect': 'POST', 
            '/api/clients/:id/disconnect': 'POST',
            '/api/clients/:id/status': 'GET',
            '/api/clients/:id/chats': 'GET',
            '/api/clients/:id/send-message': 'POST',
            '/api/clients/:id/send-audio': 'POST ⭐ (CORRIGIDO)',
            '/api/clients/:id/audio-stats': 'GET 📊 (NOVO)',
            '/api/clients/:id/send-image': 'POST',
            '/api/clients/:id/send-video': 'POST',
            '/api/clients/:id/send-document': 'POST'
        }
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

// INICIALIZAÇÃO DO SERVIDOR
const port = process.env.PORT || 4000;
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 ===== SERVIDOR WHATSAPP MULTI-CLIENT INICIADO (VERSÃO CORRIGIDA) =====`);
    console.log(`🌐 Servidor rodando na porta: ${port}`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🔧 Node.js: ${process.version}`);
    console.log(`💾 Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log(`🎵 Sistema de áudio: CORRIGIDO com retry inteligente`);
    console.log(`📦 whatsapp-web.js: v1.21.0 (versão estável)`);
    console.log(`🔄 Retry system: 3 tentativas com formatos OGG → WAV → MP3`);
    console.log(`🛡️ Fallback: Conversão para texto em caso de falha`);
    console.log(`📋 Rotas principais:`);
    console.log(`   • GET  /health - Status do servidor com stats de áudio`);
    console.log(`   • POST /api/clients/:id/send-audio - Envio de áudio ⭐ CORRIGIDO`);
    console.log(`   • GET  /api/clients/:id/audio-stats - Estatísticas de áudio 📊`);
    console.log(`   • POST /api/clients/:id/send-message - Envio de texto`);
    console.log(`   • GET  /api/clients - Lista de clientes`);
    console.log(`🔥 SERVIDOR PRONTO PARA RECEBER REQUISIÇÕES!`);
    console.log(`🎯 CORREÇÃO "Evaluation Failed" IMPLEMENTADA!`);
    console.log(`====================================================`);
});
