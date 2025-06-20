const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionData;
if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

const clients = new Map();

// Função para gerar um ID único para o cliente
function generateClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Função para salvar a sessão
const saveSession = (clientId, session) => {
    fs.writeFile(`./sessions/whatsapp-session-${clientId}.json`, JSON.stringify(session), err => {
        if (err) {
            console.error('Erro ao salvar a sessão:', err);
        }
    });
};

// Função para carregar a sessão
const loadSession = (clientId) => {
    const sessionFile = `./sessions/whatsapp-session-${clientId}.json`;
    if (fs.existsSync(sessionFile)) {
        const sessionData = fs.readFileSync(sessionFile, 'utf-8');
        return JSON.parse(sessionData);
    }
    return null;
};

// Função para obter chats de forma mais robusta
async function getChats(client) {
    try {
        console.log('🔍 Obtendo chats do cliente...');
        
        // Aguardar um pouco para garantir que o WhatsApp está pronto
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const chats = await client.getChats();
        console.log(`📱 Total de chats encontrados: ${chats.length}`);
        
        const processedChats = [];
        
        for (const chat of chats) {
            try {
                // Verificar se o chat tem as propriedades necessárias
                if (!chat || !chat.id || !chat.id._serialized) {
                    console.log('⚠️ Chat inválido encontrado, pulando...');
                    continue;
                }
                
                // Obter informações básicas do chat de forma segura
                const chatInfo = {
                    id: chat.id._serialized,
                    name: chat.name || 'Contato sem nome',
                    isGroup: chat.isGroup || false,
                    isReadOnly: chat.isReadOnly || false,
                    unreadCount: chat.unreadCount || 0,
                    timestamp: Date.now()
                };
                
                // Tentar obter a última mensagem de forma segura
                try {
                    const messages = await chat.fetchMessages({ limit: 1 });
                    if (messages && messages.length > 0) {
                        const lastMessage = messages[0];
                        chatInfo.lastMessage = {
                            body: lastMessage.body || '',
                            type: lastMessage.type || 'text',
                            timestamp: lastMessage.timestamp * 1000 || Date.now(),
                            fromMe: lastMessage.fromMe || false
                        };
                        chatInfo.timestamp = lastMessage.timestamp * 1000 || Date.now();
                    }
                } catch (msgError) {
                    console.log('⚠️ Erro ao buscar última mensagem:', msgError.message);
                    // Continuar sem a última mensagem
                }
                
                processedChats.push(chatInfo);
                
            } catch (chatError) {
                console.log('⚠️ Erro ao processar chat individual:', chatError.message);
                continue;
            }
        }
        
        // Ordenar por timestamp
        processedChats.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log(`✅ Chats processados com sucesso: ${processedChats.length}`);
        return processedChats;
        
    } catch (error) {
        console.error('❌ Erro ao obter chats:', error);
        throw new Error(`Falha ao obter chats: ${error.message}`);
    }
}

// Função para obter mensagens de um chat
async function getChatMessages(client, chatId, limit = 20) {
    try {
        console.log(`🔍 Obtendo mensagens do chat ${chatId}...`);
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });
        
        const processedMessages = messages.map(message => ({
            id: message.id.id,
            body: message.body,
            type: message.type,
            timestamp: message.timestamp,
            fromMe: message.fromMe,
            author: message.author,
            from: message.from,
            to: message.to
        }));
        
        console.log(`✅ Mensagens obtidas com sucesso: ${processedMessages.length}`);
        return processedMessages;
    } catch (error) {
        console.error('❌ Erro ao obter mensagens:', error);
        throw new Error(`Falha ao obter mensagens: ${error.message}`);
    }
}

// Função para enviar mensagem
async function sendMessage(client, to, message, mediaUrl = null) {
    try {
        console.log(`✉️ Enviando mensagem para ${to}...`);
        
        if (mediaUrl) {
            console.log(`🔗 Enviando mensagem com media URL: ${mediaUrl}`);
            const media = await MessageMedia.fromUrl(mediaUrl);
            await client.sendMessage(to, media, { caption: message });
        } else {
            await client.sendMessage(to, message);
        }
        
        console.log('✅ Mensagem enviada com sucesso');
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        throw new Error(`Falha ao enviar mensagem: ${error.message}`);
    }
}

// Função para conectar um cliente
async function connectClient(clientId) {
    console.log(`🔌 Conectando cliente: ${clientId}`);
    
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: clientId }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <- May be the thing that causes the problems
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', qr => {
        console.log('🔄 QR Code recebido, convertendo para base64...');
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('❌ Erro ao converter QR code:', err);
                return;
            }
            console.log('✅ QR Code convertido com sucesso');
            io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'qr_ready', qrCode: url, hasQrCode: true });
        });
    });

    client.on('authenticated', (session) => {
        console.log('🔑 Cliente autenticado:', clientId);
        clients.get(clientId).session = session;
        saveSession(clientId, session);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'authenticated', hasQrCode: false });
    });

    client.on('auth_failure', msg => {
        console.error('❌ Falha na autenticação:', msg);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'auth_failed', error: msg, hasQrCode: false });
    });

    client.on('ready', () => {
        console.log('✅ Cliente pronto para uso:', clientId);
        clients.get(clientId).client = client;
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'connected', hasQrCode: false });
    });

    client.on('message', msg => {
        console.log('✉️ Mensagem recebida:', msg.body);
        io.emit(`message_${clientId}`, {
            id: msg.id.id,
            body: msg.body,
            type: msg.type,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            author: msg.author,
            from: msg.from,
            to: msg.to
        });
    });

    client.on('disconnected', (reason) => {
        console.log('❌ Cliente desconectado:', clientId, reason);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'disconnected', reason: reason, hasQrCode: false });
        client.destroy();
    });

    try {
        console.log(`🔄 Inicializando cliente ${clientId}...`);
        await client.initialize();
        console.log(`🚀 Cliente ${clientId} inicializado`);
        return client;
    } catch (error) {
        console.error(`❌ Erro ao inicializar o cliente ${clientId}:`, error);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'error', error: error.message, hasQrCode: false });
        throw error;
    }
}

// WebSocket connection
io.on('connection', socket => {
    console.log('🔗 Nova conexão WebSocket:', socket.id);

    socket.on('join_client', clientId => {
        console.log(`🤝 Cliente ${clientId} entrou na sala`);
        socket.join(clientId);
    });

    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
});

// Rota para criar um novo cliente
app.post('/api/clients', async (req, res) => {
    const clientId = generateClientId();
    console.log(`➕ Criando novo cliente: ${clientId}`);
    clients.set(clientId, { clientId: clientId, status: 'disconnected', hasQrCode: false });
    io.emit('clients_update', Array.from(clients.values()));
    res.status(201).json({ success: true, clientId: clientId });
});

// Rota para conectar um cliente
app.post('/api/clients/:clientId/connect', async (req, res) => {
    const { clientId } = req.params;
    console.log(`🔗 Tentando conectar cliente: ${clientId}`);
    
    try {
        const client = await connectClient(clientId);
        res.json({ success: true, clientId: clientId, status: 'connecting' });
    } catch (error) {
        console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para desconectar um cliente
app.post('/api/clients/:clientId/disconnect', async (req, res) => {
    const { clientId } = req.params;
    console.log(`🔌 Desconectando cliente: ${clientId}`);
    
    try {
        const client = clients.get(clientId)?.client;
        if (client) {
            await client.logout();
            await client.destroy();
        }
        clients.delete(clientId);
        io.emit('clients_update', Array.from(clients.values()));
        res.json({ success: true, clientId: clientId, status: 'disconnected' });
    } catch (error) {
        console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para obter todos os clientes
app.get('/api/clients', (req, res) => {
    console.log('📡 Solicitando todos os clientes');
    const clientList = Array.from(clients.values());
    console.log(`✅ Total de clientes encontrados: ${clientList.length}`);
    res.json({ success: true, clients: clientList });
});

// Rota para obter o status de um cliente
app.get('/api/clients/:clientId/status', async (req, res) => {
    const { clientId } = req.params;
    console.log(`ℹ️ Solicitando status do cliente: ${clientId}`);
    
    try {
        const client = clients.get(clientId);
        if (!client) {
            console.log('Cliente não encontrado:', clientId);
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        let phoneNumber = null;
        try {
            if (client.client) {
                phoneNumber = client.client.info.wid.user;
            }
        } catch (phoneNumberError) {
            console.error(`Erro ao obter número de telefone para ${clientId}:`, phoneNumberError);
        }

        const statusData = {
            clientId: clientId,
            status: client.status,
            phoneNumber: phoneNumber,
            hasQrCode: client.hasQrCode,
            qrCode: client.qrCode
        };
        
        console.log('Status do cliente:', statusData);
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
        
        const client = clients.get(clientId);
        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'Cliente não encontrado'
            });
        }
        
        if (!client.client) {
            return res.status(400).json({
                success: false,
                error: 'Cliente não está conectado'
            });
        }
        
        // Verificar se o cliente está pronto
        const state = await client.client.getState();
        if (state !== 'CONNECTED') {
            return res.status(400).json({
                success: false,
                error: `Cliente não está conectado. Estado atual: ${state}`
            });
        }
        
        const chats = await getChats(client.client);
        
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
        
        const client = clients.get(clientId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!client.client) {
            return res.status(400).json({ success: false, error: 'Cliente não está conectado' });
        }
        
        const messages = await getChatMessages(client.client, chatId, limit);
        
        res.json({ success: true, messages: messages });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar mensagens do chat ${chatId} para o cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para enviar mensagem
app.post('/api/clients/:clientId/send-message', async (req, res) => {
    const { clientId } = req.params;
    const { to, message } = req.body;
    
    try {
        console.log(`✉️ Tentando enviar mensagem para ${to} do cliente ${clientId}`);
        
        const client = clients.get(clientId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!client.client) {
            return res.status(400).json({ success: false, error: 'Cliente não está conectado' });
        }
        
        await sendMessage(client.client, to, message);
        
        res.json({ success: true, message: 'Mensagem enviada' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${to} do cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para enviar mensagem com media URL
app.post('/api/clients/:clientId/send-media-url', async (req, res) => {
    const { clientId } = req.params;
    const { to, message, mediaUrl } = req.body;
    
    try {
        console.log(`✉️ Tentando enviar mensagem com media URL para ${to} do cliente ${clientId}`);
        
        const client = clients.get(clientId);
        if (!client) {
            return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
        }
        
        if (!client.client) {
            return res.status(400).json({ success: false, error: 'Cliente não está conectado' });
        }
        
        await sendMessage(client.client, to, message, mediaUrl);
        
        res.json({ success: true, message: 'Mensagem enviada com media URL' });
        
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem com media URL para ${to} do cliente ${clientId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', activeClients: clients.size });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
