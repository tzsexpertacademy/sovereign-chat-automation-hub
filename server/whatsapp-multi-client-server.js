
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { convertJsonToFiles, cleanupTempFile } = require('./utils/jsonToMultipart');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Enable files upload
app.use(fileUpload({
    createParentPath: true,
    limits: {
        fileSize: 20 * 1024 * 1024 //20MB max file(s) size
    },
}));

// Enable CORS
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use('/files', express.static('files'));

const whatsappClients = new Map();

// Generate a unique clientId
function generateClientId() {
    return uuidv4();
}

app.get('/health', (req, res) => {
    const healthcheck = {
        status: 'up',
        timestamp: new Date(),
        activeClients: whatsappClients.size,
        connectedClients: Array.from(whatsappClients.values()).filter(client => client.status === 'authenticated').length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        server: 'WhatsApp Multi Client Server',
        protocol: req.protocol,
        cors: req.headers.origin
    };
    res.json(healthcheck);
});

app.get('/clients', (req, res) => {
    const clients = Array.from(whatsappClients.entries()).map(([clientId, client]) => ({
        clientId: clientId,
        status: client.status,
        phoneNumber: client.phoneNumber,
        hasQrCode: client.hasQrCode,
        qrCode: client.qrCode,
        timestamp: client.timestamp,
        qrTimestamp: client.qrTimestamp
    }));
    res.json({ success: true, clients: clients });
});

app.post('/clients/create', (req, res) => {
    const clientId = generateClientId();
    whatsappClients.set(clientId, { status: 'disconnected' });
    res.json({ success: true, clientId: clientId });
});

app.post('/clients/:clientId/connect', async (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    if (client.status === 'connecting' || client.status === 'authenticated') {
        return res.status(400).json({ success: false, error: 'Client is already connecting or authenticated' });
    }

    client.status = 'connecting';
    client.hasQrCode = false;
    client.qrCode = null;
    client.phoneNumber = null;
    client.timestamp = new Date();

    whatsappClients.set(clientId, client);

    const waClient = new Client({
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        authStrategy: new (require('whatsapp-web.js').LocalAuth)({ clientId: clientId }),
    });

    waClient.on('qr', async qr => {
        console.log('QR RECEIVED', qr);
        client.hasQrCode = true;
        client.qrCode = await qrcode.toDataURL(qr);
        client.qrTimestamp = new Date();
        whatsappClients.set(clientId, client);
        io.emit(`client_status_${clientId}`, client);
    });

    waClient.on('authenticated', (session) => {
        console.log('WHATSAPP WEB => Authenticated');
        client.status = 'authenticated';
        client.hasQrCode = false;
        client.qrCode = null;
        client.timestamp = new Date();
        whatsappClients.set(clientId, client);
        io.emit(`client_status_${clientId}`, client);
    });

    waClient.on('auth_failure', msg => {
        console.error('WHATSAPP WEB => Auth failure', msg);
        client.status = 'auth_failed';
        client.timestamp = new Date();
        whatsappClients.set(clientId, client);
        io.emit(`client_status_${clientId}`, client);
    });

    waClient.on('ready', () => {
        console.log('WHATSAPP WEB => Ready');
        client.status = 'connected';
        client.phoneNumber = waClient.info.wid.user;
        client.timestamp = new Date();
        whatsappClients.set(clientId, client);
        io.emit(`client_status_${clientId}`, client);
    });

    waClient.on('disconnected', (reason) => {
        console.log('WHATSAPP WEB => Disconnected', reason);
        client.status = 'disconnected';
        client.timestamp = new Date();
        whatsappClients.set(clientId, client);
        io.emit(`client_status_${clientId}`, client);
        waClient.destroy();
    });

    waClient.initialize().then(() => {
        client.client = waClient;
        whatsappClients.set(clientId, client);
    }).catch(err => {
        console.error('WHATSAPP WEB => Initialize error', err);
        client.status = 'disconnected';
        client.timestamp = new Date();
        whatsappClients.set(clientId, client);
        io.emit(`client_status_${clientId}`, client);
    });

    res.json({ success: true, clientId: clientId });
});

app.post('/clients/:clientId/disconnect', (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    if (client.client) {
        client.client.logout();
        client.client.destroy();
    }

    client.status = 'disconnected';
    client.timestamp = new Date();
    whatsappClients.set(clientId, client);
    io.emit(`client_status_${clientId}`, client);
    res.json({ success: true, clientId: clientId });
});

app.get('/clients/:clientId/status', (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    res.json({
        success: true,
        clientId: clientId,
        status: client.status,
        phoneNumber: client.phoneNumber,
        hasQrCode: client.hasQrCode,
        qrCode: client.qrCode,
        qrExpiresAt: client.qrTimestamp
    });
});

app.post('/clients/:clientId/send-message', async (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    if (client.status !== 'authenticated') {
        return res.status(400).json({ success: false, error: 'Client is not authenticated' });
    }

    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ success: false, error: 'to and message are required' });
    }

    try {
        await client.client.sendMessage(to, message);
        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message', error);
        res.status(500).json({ success: false, error: 'Error sending message' });
    }
});

app.post('/clients/:clientId/send-image', async (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);

    if (!client) {
        return res.status(404).json({
            success: false,
            error: 'Cliente não encontrado'
        });
    }

    if (client.status !== 'authenticated') {
        return res.status(400).json({
            success: false,
            error: 'Cliente não está autenticado'
        });
    }

    const { to, caption } = req.body;
    if (!to) {
        return res.status(400).json({
            success: false,
            error: 'Número de destino é obrigatório'
        });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Nenhum arquivo foi enviado.'
        });
    }

    const file = req.files.file;
    const { MessageMedia } = require('whatsapp-web.js');

    try {
        const media = MessageMedia.fromFilePath(file.tempFilePath);
        await client.client.sendMessage(to, media, { caption: caption });

        res.json({
            success: true,
            message: 'Imagem enviada com sucesso'
        });
    } catch (error) {
        console.error('Erro no envio de imagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/clients/:clientId/chats', async (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);

    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }

    if (client.status !== 'authenticated') {
        return res.status(400).json({ success: false, error: 'Client is not authenticated' });
    }

    try {
        const chats = await client.client.getChats();
        res.json({ success: true, chats: chats });
    } catch (error) {
        console.error('Error getting chats', error);
        res.status(500).json({ success: false, error: 'Error getting chats' });
    }
});

// ===== NOVOS ENDPOINTS JSON+BASE64 (ADICIONADOS SEM ALTERAR EXISTENTES) =====

// Endpoint para envio de áudio via JSON+base64
app.post('/api/clients/:clientId/send-audio', async (req, res) => {
  console.log('🎵 ===== ENDPOINT JSON AUDIO =====');
  console.log('📨 Dados recebidos:', {
    clientId: req.params.clientId,
    hasAudioData: !!req.body.audioData,
    fileName: req.body.fileName,
    to: req.body.to
  });

  const clientId = req.params.clientId;
  let tempFiles = null;

  try {
    // Converte JSON+base64 para req.files simulado
    tempFiles = convertJsonToFiles(req.body);
    
    // Simula req.files para reutilizar lógica existente
    const originalFiles = req.files;
    req.files = tempFiles;
    
    // Busca cliente (mesmo código existente)
    const client = whatsappClients.get(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    if (client.status !== 'authenticated') {
      return res.status(400).json({
        success: false,
        error: 'Cliente não está autenticado'
      });
    }

    // Validação (mesma lógica existente)
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Número de destino é obrigatório'
      });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado.'
      });
    }

    const file = req.files.file;
    console.log('📁 Arquivo processado:', {
      name: file.name,
      size: file.size,
      mimetype: file.mimetype
    });

    // Usa MessageMedia (mesma lógica existente)
    const { MessageMedia } = require('whatsapp-web.js');
    const fs = require('fs');
    
    const buffer = fs.readFileSync(file.tempFilePath);
    const media = new MessageMedia(file.mimetype, buffer.toString('base64'), file.name);

    console.log('📤 Enviando áudio via WhatsApp Web.js...');
    
    // Envia mensagem (mesma lógica existente)
    const message = await client.client.sendMessage(to, media);
    
    console.log('✅ Áudio enviado com sucesso:', message.id._serialized);

    // Restaura req.files original
    req.files = originalFiles;

    res.json({
      success: true,
      message: 'Áudio enviado com sucesso',
      messageId: message.id._serialized,
      details: {
        format: 'JSON+base64 convertido',
        fileName: file.name,
        fileSize: file.size
      }
    });

  } catch (error) {
    console.error('❌ Erro no envio de áudio JSON:', error);
    
    // Restaura req.files original em caso de erro
    if (req.files !== null) {
      req.files = null;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  } finally {
    // Limpa arquivo temporário
    if (tempFiles) {
      cleanupTempFile(tempFiles);
    }
  }
});

// Endpoint para envio de imagem via JSON+base64
app.post('/api/clients/:clientId/send-image', async (req, res) => {
  console.log('🖼️ ===== ENDPOINT JSON IMAGE =====');
  
  const clientId = req.params.clientId;
  let tempFiles = null;

  try {
    // Converte JSON+base64 para req.files simulado
    tempFiles = convertJsonToFiles({
      audioData: req.body.imageData || req.body.fileData,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType
    });
    
    // Simula req.files
    req.files = tempFiles;
    
    // Reutiliza lógica existente do endpoint /clients/:id/send-image
    const client = whatsappClients.get(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    if (client.status !== 'authenticated') {
      return res.status(400).json({
        success: false,
        error: 'Cliente não está autenticado'
      });
    }

    const { to, caption } = req.body;
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Número de destino é obrigatório'
      });
    }

    const file = req.files.file;
    const { MessageMedia } = require('whatsapp-web.js');
    const fs = require('fs');
    
    const buffer = fs.readFileSync(file.tempFilePath);
    const media = new MessageMedia(file.mimetype, buffer.toString('base64'), file.name);

    const message = await client.client.sendMessage(to, media, { caption });
    
    res.json({
      success: true,
      message: 'Imagem enviada com sucesso',
      messageId: message.id._serialized
    });
    
  } catch (error) {
    console.error('❌ Erro no envio de imagem JSON:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (tempFiles) {
      cleanupTempFile(tempFiles);
    }
  }
});

// Endpoint para envio de vídeo via JSON+base64
app.post('/api/clients/:clientId/send-video', async (req, res) => {
  console.log('🎬 ===== ENDPOINT JSON VIDEO =====');
  
  const clientId = req.params.clientId;
  let tempFiles = null;

  try {
    tempFiles = convertJsonToFiles({
      audioData: req.body.videoData || req.body.fileData,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType
    });
    
    req.files = tempFiles;
    
    const client = whatsappClients.get(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    if (client.status !== 'authenticated') {
      return res.status(400).json({
        success: false,
        error: 'Cliente não está autenticado'
      });
    }

    const { to, caption } = req.body;
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Número de destino é obrigatório'
      });
    }

    const file = req.files.file;
    const { MessageMedia } = require('whatsapp-web.js');
    const fs = require('fs');
    
    const buffer = fs.readFileSync(file.tempFilePath);
    const media = new MessageMedia(file.mimetype, buffer.toString('base64'), file.name);

    const message = await client.client.sendMessage(to, media, { caption });
    
    res.json({
      success: true,
      message: 'Vídeo enviado com sucesso',
      messageId: message.id._serialized
    });
    
  } catch (error) {
    console.error('❌ Erro no envio de vídeo JSON:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (tempFiles) {
      cleanupTempFile(tempFiles);
    }
  }
});

// Endpoint para envio de documento via JSON+base64
app.post('/api/clients/:clientId/send-document', async (req, res) => {
  console.log('📄 ===== ENDPOINT JSON DOCUMENT =====');
  
  const clientId = req.params.clientId;
  let tempFiles = null;

  try {
    tempFiles = convertJsonToFiles({
      audioData: req.body.documentData || req.body.fileData,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType
    });
    
    req.files = tempFiles;
    
    const client = whatsappClients.get(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    if (client.status !== 'authenticated') {
      return res.status(400).json({
        success: false,
        error: 'Cliente não está autenticado'
      });
    }

    const { to } = req.body;
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Número de destino é obrigatório'
      });
    }

    const file = req.files.file;
    const { MessageMedia } = require('whatsapp-web.js');
    const fs = require('fs');
    
    const buffer = fs.readFileSync(file.tempFilePath);
    const media = new MessageMedia(file.mimetype, buffer.toString('base64'), file.name);

    const message = await client.client.sendMessage(to, media);
    
    res.json({
      success: true,
      message: 'Documento enviado com sucesso',
      messageId: message.id._serialized
    });
    
  } catch (error) {
    console.error('❌ Erro no envio de documento JSON:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (tempFiles) {
      cleanupTempFile(tempFiles);
    }
  }
});

io.on('connection', socket => {
    console.log('a user connected');

    socket.on('join_client', clientId => {
        socket.join(clientId);
        console.log(`Socket joined room ${clientId}`);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
