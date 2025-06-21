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

// Sistema de detecção de emoções
const detectEmotion = (message) => {
    const emotions = {
        love: {
            keywords: ['amor', 'amo', 'adoro', 'maravilhoso', 'incrível', 'perfeito', 'excelente', 'fantástico'],
            emoji: '❤️'
        },
        approval: {
            keywords: ['sim', 'correto', 'certo', 'concordo', 'aprovado', 'ok', 'beleza', 'show'],
            emoji: '👍'
        },
        laugh: {
            keywords: ['haha', 'kkkk', 'rsrs', 'engraçado', 'risos', 'hilário', 'kk'],
            emoji: '😂'
        },
        surprise: {
            keywords: ['nossa', 'uau', 'inacreditável', 'sério', 'caramba', 'impressionante'],
            emoji: '😮'
        },
        sadness: {
            keywords: ['triste', 'chateado', 'decepcionado', 'frustrado', 'mal', 'pena'],
            emoji: '😢'
        },
        anger: {
            keywords: ['raiva', 'irritado', 'bravo', 'furioso', 'odio', 'detesto', 'péssimo'],
            emoji: '😠'
        }
    };

    const messageText = message.toLowerCase();
    
    for (const [emotionType, config] of Object.entries(emotions)) {
        for (const keyword of config.keywords) {
            if (messageText.includes(keyword)) {
                return {
                    type: emotionType,
                    emoji: config.emoji,
                    detected: true
                };
            }
        }
    }
    
    return { detected: false };
};

// Sistema de detecção de mensagens citadas
const extractQuotedMessage = (message) => {
    try {
        if (message.quotedMessage || message._data?.quotedMsg || message.quotedMsg) {
            const quotedData = message.quotedMessage || message._data?.quotedMsg || message.quotedMsg;
            
            return {
                id: quotedData.id || quotedData._serialized || 'unknown',
                body: quotedData.body || quotedData.caption || '',
                author: quotedData.author || quotedData.from || 'Desconhecido',
                timestamp: quotedData.timestamp || Date.now()
            };
        }
        return null;
    } catch (error) {
        console.error('Erro ao extrair mensagem citada:', error);
        return null;
    }
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
        this.presenceState = 'unavailable'; // available, unavailable, composing, recording
        this.isOnline = false;
        this.presenceUpdateInterval = null;
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
            this.isOnline = true;
            
            try {
                // Obter informações do usuário
                const info = this.client.info;
                if (info && info.wid) {
                    this.phoneNumber = info.wid.user;
                }
            } catch (error) {
                console.log(`⚠️ Não foi possível obter número do telefone para ${this.clientId}`);
            }
            
            // Iniciar atualizações automáticas de presença
            this.startPresenceUpdates();
            
            this.updateStatus('connected');
        });

        this.client.on('message', async (msg) => {
            console.log(`📨 Mensagem recebida em ${this.clientId}:`, msg.body?.substring(0, 50));
            this.lastActivity = Date.now();
            
            // Detectar emoção e reagir automaticamente
            const emotion = detectEmotion(msg.body || '');
            if (emotion.detected && !msg.fromMe) {
                console.log(`😊 Emoção detectada: ${emotion.type} - ${emotion.emoji}`);
                
                // Delay natural de 1-3 segundos
                const delay = Math.random() * 2000 + 1000;
                setTimeout(async () => {
                    try {
                        await this.sendReaction(msg.id._serialized, emotion.emoji);
                        console.log(`✅ Reação ${emotion.emoji} enviada automaticamente`);
                    } catch (error) {
                        console.error('❌ Erro ao enviar reação automática:', error);
                    }
                }, delay);
            }
            
            // Extrair mensagem citada se existir
            const quotedMessage = extractQuotedMessage(msg);
            
            const messageData = {
                id: msg.id.id,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp * 1000,
                fromMe: msg.fromMe,
                author: msg.author,
                from: msg.from,
                to: msg.to,
                quotedMessage: quotedMessage,
                emotion: emotion.detected ? emotion : null
            };
            
            io.emit(`message_${this.clientId}`, messageData);
        });

        this.client.on('disconnected', (reason) => {
            console.log(`❌ Cliente desconectado ${this.clientId}:`, reason);
            this.isReady = false;
            this.isOnline = false;
            this.stopPresenceUpdates();
            this.updateStatus('disconnected', reason);
        });

        // Adicionar handler para erros
        this.client.on('error', (error) => {
            console.error(`❌ Erro no cliente ${this.clientId}:`, error);
        });
    }

    // Sistema de presença automática
    startPresenceUpdates() {
        if (this.presenceUpdateInterval) {
            clearInterval(this.presenceUpdateInterval);
        }
        
        // Atualizar presença a cada 30 segundos
        this.presenceUpdateInterval = setInterval(async () => {
            if (this.isReady && this.isOnline) {
                try {
                    await this.updatePresence('available');
                    console.log(`👤 Presença atualizada automaticamente para ${this.clientId}`);
                } catch (error) {
                    console.error(`❌ Erro ao atualizar presença automática:`, error);
                }
            }
        }, 30000);
    }

    stopPresenceUpdates() {
        if (this.presenceUpdateInterval) {
            clearInterval(this.presenceUpdateInterval);
            this.presenceUpdateInterval = null;
        }
    }

    async updatePresence(presence) {
        try {
            if (!this.isReady || !this.client) {
                throw new Error('Cliente não está pronto');
            }
            
            this.presenceState = presence;
            
            // Simular atualização de presença (whatsapp-web.js não tem API direta para isso)
            console.log(`👤 Presença definida como: ${presence} para ${this.clientId}`);
            
            // Emitir evento de presença atualizada
            io.emit(`presence_${this.clientId}`, {
                clientId: this.clientId,
                presence: presence,
                isOnline: this.isOnline,
                timestamp: Date.now()
            });
            
            return { success: true, presence };
        } catch (error) {
            console.error(`❌ Erro ao atualizar presença:`, error);
            throw error;
        }
    }

    async sendReaction(messageId, emoji) {
        try {
            if (!this.isReady || !this.client) {
                throw new Error('Cliente não está pronto');
            }
            
            // Encontrar a mensagem pelo ID
            const message = await this.client.getMessageById(messageId);
            if (!message) {
                throw new Error('Mensagem não encontrada');
            }
            
            // Enviar reação
            await message.react(emoji);
            
            console.log(`✅ Reação ${emoji} enviada para mensagem ${messageId}`);
            return { success: true, messageId, emoji };
        } catch (error) {
            console.error(`❌ Erro ao enviar reação:`, error);
            throw error;
        }
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
            isOnline: this.isOnline,
            presenceState: this.presenceState,
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
                to: message.to,
                quotedMessage: extractQuotedMessage(message)
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
            
            // Atualizar presença para "digitando" antes de enviar
            await this.updatePresence('composing');
            
            // Delay para simular digitação
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await this.client.sendMessage(to, message, options);
            
            // Voltar presença para "disponível" após enviar
            await this.updatePresence('available');
            
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
            
            // Atualizar presença para "gravando" se for áudio
            if (options.sendAudioAsVoice) {
                await this.updatePresence('recording');
            } else {
                await this.updatePresence('composing');
            }
            
            // Delay para simular preparação da mídia
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.client.sendMessage(to, media, options);
            
            // Voltar presença para "disponível" após enviar
            await this.updatePresence('available');
            
            console.log(`✅ Mídia enviada com sucesso via ${this.clientId}`);
        } catch (error) {
            console.error(`❌ Erro ao enviar mídia via ${this.clientId}:`, error);
            throw new Error(`Falha ao enviar mídia: ${error.message}`);
        }
    }

    async disconnect() {
        try {
            this.stopPresenceUpdates();
            
            if (this.client) {
                await this.client.logout();
                await this.client.destroy();
            }
            this.isReady = false;
            this.isOnline = false;
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
            hasQrCode: !!c.qrCode,
            isOnline: c.isOnline,
            presenceState: c.presenceState
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
            hasQrCode: !!c.qrCode,
            isOnline: c.isOnline,
            presenceState: c.presenceState
        })));
        
        res.json({ success: true, clientId: clientId, status: 'disconnected' });
        
    } catch (error) {
        console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Nova rota para atualizar presença
app.post('/api/clients/:clientId/presence', async (req, res) => {
    const { clientId } = req.params;
    const { presence } = req.body;
    
    try {
        console.log(`👤 Atualizando presença para ${clientId}: ${presence}`);
        
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        const result = await clientManager.updatePresence(presence);
        res.json({ success: true, ...result });
        
    } catch (error) {
        console.error(`❌ Erro ao atualizar presença para ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Nova rota para enviar reação
app.post('/api/clients/:clientId/send-reaction', async (req, res) => {
    const { clientId } = req.params;
    const { chatId, messageId, emoji } = req.body;
    
    try {
        console.log(`🎭 Enviando reação ${emoji} para mensagem ${messageId} em ${chatId}`);
        
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        const result = await clientManager.sendReaction(messageId, emoji);
        res.json({ success: true, ...result });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar reação:`, error);
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
            hasQrCode: !!c.qrCode,
            isOnline: c.isOnline,
            presenceState: c.presenceState
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
            qrCode: clientManager.qrCode,
            isOnline: clientManager.isOnline,
            presenceState: clientManager.presenceState
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

app.post('/api/clients/:clientId/send-audio', upload.single('file'), async (req, res) => {
    const { clientId } = req.params;
    const { to } = req.body;
    
    try {
        const clientManager = clients.get(clientId);
        if (!clientManager) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Arquivo não fornecido' });
        }
        
        const media = MessageMedia.fromFilePath(req.file.path);
        media.mimetype = 'audio/ogg; codecs=opus';
        
        await clientManager.sendMedia(to, media, { sendAudioAsVoice: true });
        
        // Limpar arquivo temporário
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'Áudio enviado' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar áudio:`, error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
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

// Health check
app.get('/health', (req, res) => {
    const activeClients = clients.size;
    const connectedClients = Array.from(clients.values()).filter(c => c.status === 'connected').length;
    const onlineClients = Array.from(clients.values()).filter(c => c.isOnline).length;
    
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeClients: activeClients,
        connectedClients: connectedClients,
        onlineClients: onlineClients,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
        server: `${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 4000}`,
        features: {
            autoOnlineStatus: true,
            autoReactions: true,
            quotedMessages: true
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

const port = process.env.PORT || 4000;
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor WhatsApp Multi-Client rodando na porta ${port}`);
    console.log(`📊 Timestamp: ${new Date().toISOString()}`);
    console.log(`🔧 Node.js: ${process.version}`);
    console.log(`💾 Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log(`✨ Recursos habilitados:`);
    console.log(`   📡 Status Online Automático`);
    console.log(`   😊 Sistema de Reações Automáticas`);
    console.log(`   💬 Resposta a Mensagens Citadas`);
});

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
