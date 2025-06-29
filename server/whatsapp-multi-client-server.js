const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { phoneNumberFormatter } = require('./helpers/formatter');
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
            console.log('Client sessions loaded from file.');
        }
    } catch (error) {
        console.error('Error loading client sessions:', error);
    }
};

loadClientSessions();

const saveClientSessions = () => {
    try {
        fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(clientSessions, null, 2));
        console.log('Client sessions saved to file.');
    } catch (error) {
        console.error('Error saving client sessions:', error);
    }
};

// Configuração CORS atualizada
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://146.59.227.248',
    'http://146.59.227.248:4000',
    'https://146.59.227.248:4000',
    'https://*.lovableproject.com',
    'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Handle preflight requests
app.options('*', cors());

const clients = {};

const initClient = (clientId) => {
    if (clients[clientId]) {
        console.log(`Client ${clientId} already initialized.`);
        return;
    }

    const client = new Client({
        session: clientSessions[clientId],
        puppeteer: {
            args: [
                '--no-sandbox',
            ],
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR RECEIVED', qr);
        const qrCodeDataUrl = await qrcode.toDataURL(qr);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'qr_ready', qrCode: qrCodeDataUrl });
    });

    client.on('authenticated', (session) => {
        console.log('AUTHENTICATED', session);
        clientSessions[clientId] = session;
        saveClientSessions();
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'authenticated' });
    });

    client.on('auth_failure', function (session) {
        console.error('Auth failure', session);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'auth_failed' });
    });

    client.on('ready', () => {
        console.log('READY');
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'connected' });
    });

    client.on('message', msg => {
        console.log('MESSAGE RECEIVED', msg);
        io.emit(`message_${clientId}`, msg);
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        io.emit(`client_status_${clientId}`, { clientId: clientId, status: 'disconnected' });
        client.destroy();
        delete clients[clientId];
    });

    client.initialize();
    clients[clientId] = client;
    console.log(`Client ${clientId} initialized.`);
};

io.on('connection', socket => {
    console.log('a user connected', socket.id);

    socket.on('join_client', clientId => {
        socket.join(clientId);
        console.log(`Socket ${socket.id} joined client room: ${clientId}`);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
    });
});

app.get('/health', (req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        activeClients: Object.keys(clients).length
    };
    res.send(healthcheck);
});

app.get('/clients', (req, res) => {
    const clientList = Object.keys(clients).map(clientId => {
        const client = clients[clientId];
        return {
            clientId: clientId,
            status: client.info?.wid ? 'connected' : 'disconnected',
            phoneNumber: client.info?.wid?.user ? phoneNumberFormatter(client.info.wid.user) : null
        };
    });
    res.json({ success: true, clients: clientList });
});

app.post('/clients/:clientId/connect', (req, res) => {
    const clientId = req.params.clientId;
    initClient(clientId);
    res.json({ success: true, message: `Client ${clientId} connect command executed.` });
});

app.post('/clients/:clientId/disconnect', async (req, res) => {
    const clientId = req.params.clientId;
    if (clients[clientId]) {
        try {
            await clients[clientId].logout();
            delete clients[clientId];
            res.json({ success: true, message: `Client ${clientId} disconnected.` });
        } catch (error) {
            console.error(`Error disconnecting client ${clientId}:`, error);
            res.status(500).json({ success: false, error: `Failed to disconnect client ${clientId}.` });
        }
    } else {
        res.status(404).json({ success: false, error: `Client ${clientId} not found.` });
    }
});

app.get('/clients/:clientId/status', async (req, res) => {
    const clientId = req.params.clientId;
    if (clients[clientId]) {
        try {
            let qrCode = null;
            if (clients[clientId].qr) {
                qrCode = await qrcode.toDataURL(clients[clientId].qr);
            }
            const status = clients[clientId].info?.wid ? 'connected' : 'disconnected';
            const phoneNumber = clients[clientId].info?.wid?.user ? phoneNumberFormatter(clients[clientId].info.wid.user) : null;
            res.json({ success: true, clientId: clientId, status: status, phoneNumber: phoneNumber, qrCode: qrCode });
        } catch (error) {
            console.error(`Error getting status for client ${clientId}:`, error);
            res.status(500).json({ success: false, error: `Failed to get status for client ${clientId}.` });
        }
    } else {
        res.status(404).json({ success: false, error: `Client ${clientId} not found.` });
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

server.listen(port, () => {
    console.log(`Application running on port ${port}`);
});
