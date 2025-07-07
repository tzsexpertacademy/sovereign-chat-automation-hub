const express = require('express');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const mime = require('mime-types');
const { OpenAI } = require("openai");
const { Readable } = require('stream');

// Load environment variables
require('dotenv').config();

// AWS S3 Configuration
const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    },
});

// OpenAI Configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    debug: false
}));

const port = process.env.PORT || 4000;

// WhatsApp Clients Map
const clients = new Map();

// Health Endpoint
app.get('/health', (req, res) => {
    const healthcheck = {
        status: 'up',
        timestamp: new Date(),
        activeClients: clients.size,
        connectedClients: Array.from(clients.entries()).filter(([clientId, client]) => client.status === 'CONNECTED').length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '0.0.0',
        server: 'WhatsApp Multi Client Server',
        protocol: req.protocol,
        cors: req.headers.origin
    };
    console.log('Health Check:', healthcheck);
    res.send(healthcheck);
});

// Function to initialize WhatsApp client
const initWhatsappClient = async (clientId, io) => {
    console.log(`Initializing WhatsApp client: ${clientId}`);
    const client = new Client({
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <- May be unstable
                '--disable-gpu'
            ],
        },
        authStrategy: new (require('whatsapp-web.js').LocalAuth)({ clientId: clientId }),
    });

    client.clientId = clientId;
    client.status = 'INIT';
    clients.set(clientId, { client: client, status: 'INIT' });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, { margin: 4, scale: 4 }, (err, url) => {
            if (err) {
                console.error(err);
                return;
            }
            client.status = 'QR_READY';
            clients.set(clientId, { client: client, status: 'QR_READY', qr: url });
            io.emit('client_status_' + clientId, { clientId: clientId, status: 'QR_READY', qr: url });
            io.emit('message', { clientId: clientId, status: 'QR_RECEIVED', qr: url });
        });
    });

    client.on('authenticated', () => {
        console.log('WHATSAPP WEB => Authenticated');
        client.status = 'AUTHENTICATED';
        clients.set(clientId, { client: client, status: 'AUTHENTICATED' });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'AUTHENTICATED' });
        io.emit('message', { clientId: clientId, status: 'AUTHENTICATED' });
    });

    client.on('auth_failure', function (session) {
        console.error('WHATSAPP WEB => Auth failure', session);
        client.status = 'AUTH_FAILED';
        clients.set(clientId, { client: client, status: 'AUTH_FAILED' });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'AUTH_FAILED' });
        io.emit('message', { clientId: clientId, status: 'AUTH_FAILURE' });
    });

    client.on('ready', () => {
        console.log('WHATSAPP WEB => Ready');
        client.status = 'CONNECTED';
        clients.set(clientId, { client: client, status: 'CONNECTED' });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'CONNECTED' });
        io.emit('message', { clientId: clientId, status: 'READY' });
    });

    client.on('disconnected', (reason) => {
        console.log('WHATSAPP WEB => Disconnected: ' + reason);
        client.status = 'DISCONNECTED';
        clients.set(clientId, { client: client, status: 'DISCONNECTED' });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'DISCONNECTED' });
        client.destroy();
    });

    client.on('message', async msg => {
        console.log('Message received', msg.body);
        io.emit('message', { clientId: clientId, status: 'MESSAGE', message: msg });
    });

    try {
        await client.initialize();
        console.log(`WhatsApp client initialized: ${clientId}`);
    } catch (error) {
        console.error(`Error initializing WhatsApp client ${clientId}:`, error);
        client.status = 'INIT_FAILED';
        clients.set(clientId, { client: client, status: 'INIT_FAILED', error: error.message });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'INIT_FAILED', error: error.message });
    }
};

// Socket IO
io.on('connection', function (socket) {
    console.log('Client Socket connected');
    socket.on('message', msg => {
        console.log('message from client: ', msg);
    });
    socket.on('join_client', (clientId) => {
        console.log('join_client: ', clientId);
        socket.join(clientId);
    });
});

// WhatsApp Client Management Endpoints
app.post('/clients/create', async (req, res) => {
    const clientId = req.body.id;
    if (!clientId) {
        return res.status(400).json({ status: false, message: 'Client ID is required' });
    }
    if (clients.has(clientId)) {
        return res.status(409).json({ status: false, message: 'Client ID already exists' });
    }
    await initWhatsappClient(clientId, io);
    return res.status(201).json({ status: true, id: clientId, message: 'Client created' });
});

app.post('/clients/:clientId/connect', async (req, res) => {
    const clientId = req.params.clientId;
    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client ID not found' });
    }
    const client = clients.get(clientId).client;
    if (client.status === 'CONNECTED') {
        return res.status(409).json({ status: false, message: 'Client is already connected' });
    }
    await initWhatsappClient(clientId, io);
    return res.status(200).json({ status: true, id: clientId, message: 'Client connected' });
});

app.get('/clients', (req, res) => {
    const clientList = Array.from(clients.entries()).map(([clientId, client]) => {
        return {
            clientId: clientId,
            status: client.status,
            phoneNumber: client?.client?.info?.wid?.user ? client.client.info.wid.user : null
        };
    });
    return res.status(200).json({ status: true, clients: clientList });
});

app.get('/clients/:clientId/status', (req, res) => {
    const clientId = req.params.clientId;
    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client ID not found' });
    }
    const client = clients.get(clientId);
    const status = client.status;
    const qr = client.qr;
    const phoneNumber = client?.client?.info?.wid?.user ? client.client.info.wid.user : null;
    return res.status(200).json({ status: true, clientId: clientId, status: status, qr: qr, phoneNumber: phoneNumber });
});

app.post('/clients/:clientId/disconnect', async (req, res) => {
    const clientId = req.params.clientId;
    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client ID not found' });
    }
    const client = clients.get(clientId).client;
    try {
        await client.logout();
        client.status = 'DISCONNECTED';
        clients.set(clientId, { client: client, status: 'DISCONNECTED' });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'DISCONNECTED' });
        return res.status(200).json({ status: true, message: 'Client disconnected' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ status: false, message: 'Logout failed' });
    }
});

app.delete('/clients/:clientId', async (req, res) => {
    const clientId = req.params.clientId;
    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client ID not found' });
    }
    const client = clients.get(clientId).client;
    try {
        await client.logout();
        client.status = 'DISCONNECTED';
        clients.set(clientId, { client: client, status: 'DISCONNECTED' });
        io.emit('client_status_' + clientId, { clientId: clientId, status: 'DISCONNECTED' });
        clients.delete(clientId);
        return res.status(200).json({ status: true, message: 'Client deleted' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ status: false, message: 'Logout failed' });
    }
});

// Message Management Endpoints
const sendMessage = async (client, number, message) => {
    try {
        const numberFormated = phoneNumberFormatter(number);
        const isRegisteredNumber = await client.isRegisteredUser(numberFormated);
        if (!isRegisteredNumber) {
            throw new Error('The number is not registered');
        }
        await client.sendMessage(numberFormated, message);
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

app.post('/clients/:clientId/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
], async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
        return msg;
    });
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        });
    }
    const clientId = req.params.clientId;
    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client ID not found' });
    }
    const client = clients.get(clientId).client;
    const number = req.body.number;
    const message = req.body.message;
    try {
        await sendMessage(client, number, message);
        return res.status(200).json({ status: true, message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ status: false, message: error.message });
    }
});

app.post('/clients/:clientId/send-media', async (req, res) => {
    const clientId = req.params.clientId;
    const number = req.body.number;
    const caption = req.body.caption;

    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client is not registered. Please scan the QR code.' });
    }

    const client = clients.get(clientId).client;

    // Getting media info
    const file = req.files.file;

    try {
        const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
        await client.sendMessage(phoneNumberFormatter(number), media, {
            caption: caption
        });

        res.status(200).json({
            status: true,
            message: 'Media sent'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: 'Failed to send media'
        });
    }
});

// OpenAI Endpoint
app.post('/clients/:clientId/openai', async (req, res) => {
    const clientId = req.params.clientId;
    const number = req.body.number;
    const prompt = req.body.prompt;

    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client is not registered. Please scan the QR code.' });
    }

    const client = clients.get(clientId).client;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
        });

        const response = completion.choices[0].message.content;

        await client.sendMessage(phoneNumberFormatter(number), response);

        res.status(200).json({
            status: true,
            message: 'OpenAI response sent',
            response: response
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: 'Failed to get OpenAI response'
        });
    }
});

// S3 Upload Endpoint
app.post('/clients/:clientId/upload-s3', async (req, res) => {
    const clientId = req.params.clientId;
    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client is not registered. Please scan the QR code.' });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ status: false, message: 'No files were uploaded.' });
    }

    const file = req.files.file;
    const fileKey = `${clientId}/${Date.now()}_${file.name}`;

    try {
        const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.data,
            ContentType: file.mimetype,
            ACL: 'private', // Set to 'public-read' if you want the file to be publicly accessible
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        res.status(200).json({
            status: true,
            message: 'File uploaded to S3',
            fileKey: fileKey
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: 'Failed to upload file to S3'
        });
    }
});

// S3 Download Endpoint
app.get('/clients/:clientId/download-s3/:fileKey', async (req, res) => {
    const clientId = req.params.clientId;
    const fileKey = req.params.fileKey;

    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client is not registered. Please scan the QR code.' });
    }

    try {
        const getObjectParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.status(200).json({
            status: true,
            message: 'File URL retrieved',
            url: url
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve file URL from S3'
        });
    }
});

// Get Chats
app.get('/clients/:clientId/chats', async (req, res) => {
    const clientId = req.params.clientId;

    if (!clients.has(clientId)) {
        return res.status(404).json({ status: false, message: 'Client is not registered. Please scan the QR code.' });
    }

    const client = clients.get(clientId).client;

    try {
        const chats = await client.getChats();

        res.status(200).json({
            status: true,
            message: 'Chats retrieved',
            chats: chats
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: 'Failed to get chats'
        });
    }
});

const FileProcessor = require('./utils/fileProcessor');

// ===== NOVOS ENDPOINTS PARA ENVIO DE ARQUIVOS VIA JSON + BASE64 =====

// Endpoint para envio de áudio via JSON + base64
app.post('/api/clients/:clientId/send-audio', async (req, res) => {
  const { clientId } = req.params;
  const { to, audioData, fileName = 'audio.ogg', mimeType = 'audio/ogg', caption = '' } = req.body;
  
  console.log('🎵 ===== ENDPOINT SEND-AUDIO (JSON + BASE64) =====');
  console.log('📋 Dados recebidos:', { 
    clientId, 
    to, 
    fileName, 
    mimeType,
    dataLength: audioData?.length || 0,
    hasCaption: !!caption
  });
  
  if (!audioData) {
    console.error('❌ Dados de áudio não fornecidos');
    return res.status(400).json({ success: false, error: 'Dados de áudio são obrigatórios' });
  }
  
  let tempFile = null;
  
  try {
    // Validar tipo de arquivo
    const typeValidation = FileProcessor.validateFileType(mimeType, 'audio');
    if (!typeValidation.isSupported) {
      console.error('❌ Tipo de áudio não suportado:', mimeType);
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de áudio não suportado: ${mimeType}`,
        supportedTypes: typeValidation.supportedTypes
      });
    }
    
    // Converter base64 para arquivo temporário
    tempFile = await FileProcessor.processBase64File(audioData, fileName, mimeType);
    
    // Validar tamanho
    const sizeValidation = FileProcessor.validateFileSize(tempFile.size, 'audio');
    if (!sizeValidation.isValid) {
      console.error('❌ Arquivo de áudio muito grande:', tempFile.size);
      return res.status(400).json({ 
        success: false, 
        error: `Arquivo muito grande. Máximo: ${(sizeValidation.maxSize / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    // Simular req.files para reutilizar lógica existente
    const mockReq = {
      params: { clientId },
      body: { to, caption },
      files: { file: tempFile }
    };
    
    console.log('🔄 Reutilizando lógica existente de envio de áudio...');
    
    // Encontrar cliente
    const client = clients.get(clientId);
    if (!client || !client.client) {
      console.error('❌ Cliente não encontrado ou não conectado:', clientId);
      return res.status(404).json({ success: false, error: 'Cliente não encontrado ou não conectado' });
    }
    
    // Usar a lógica existente de envio (adaptada)
    const media = MessageMedia.fromFilePath(tempFile.path);
    
    console.log('📤 Enviando áudio via WhatsApp...', { to, fileName, size: tempFile.size });
    const result = await client.client.sendMessage(to, media, { caption });
    
    console.log('✅ Áudio enviado com sucesso:', result.id._serialized);
    
    res.json({ 
      success: true, 
      messageId: result.id._serialized,
      details: {
        fileName,
        mimeType,
        size: tempFile.size,
        format: 'audio',
        attempts: 1,
        isFallback: false
      },
      message: 'Áudio enviado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar áudio:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: { attempts: 1 }
    });
  } finally {
    // Cleanup do arquivo temporário
    if (tempFile) {
      FileProcessor.cleanupTempFile(tempFile.path);
    }
  }
});

// Endpoint para envio de imagem via JSON + base64
app.post('/api/clients/:clientId/send-image', async (req, res) => {
  const { clientId } = req.params;
  const { to, imageData, fileName = 'image.jpg', mimeType = 'image/jpeg', caption = '' } = req.body;
  
  console.log('🖼️ ===== ENDPOINT SEND-IMAGE (JSON + BASE64) =====');
  console.log('📋 Dados recebidos:', { clientId, to, fileName, mimeType, dataLength: imageData?.length || 0 });
  
  if (!imageData) {
    return res.status(400).json({ success: false, error: 'Dados de imagem são obrigatórios' });
  }
  
  let tempFile = null;
  
  try {
    // Validações
    const typeValidation = FileProcessor.validateFileType(mimeType, 'image');
    if (!typeValidation.isSupported) {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de imagem não suportado: ${mimeType}`,
        supportedTypes: typeValidation.supportedTypes
      });
    }
    
    // Processar arquivo
    tempFile = await FileProcessor.processBase64File(imageData, fileName, mimeType);
    
    const sizeValidation = FileProcessor.validateFileSize(tempFile.size, 'image');
    if (!sizeValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: `Arquivo muito grande. Máximo: ${(sizeValidation.maxSize / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    // Encontrar cliente
    const client = clients.get(clientId);
    if (!client || !client.client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado ou não conectado' });
    }
    
    // Enviar via WhatsApp
    const media = MessageMedia.fromFilePath(tempFile.path);
    const result = await client.client.sendMessage(to, media, { caption });
    
    console.log('✅ Imagem enviada com sucesso:', result.id._serialized);
    
    res.json({ 
      success: true, 
      messageId: result.id._serialized,
      details: { fileName, mimeType, size: tempFile.size, format: 'image' },
      message: 'Imagem enviada com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar imagem:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (tempFile) {
      FileProcessor.cleanupTempFile(tempFile.path);
    }
  }
});

// Endpoint para envio de vídeo via JSON + base64
app.post('/api/clients/:clientId/send-video', async (req, res) => {
  const { clientId } = req.params;
  const { to, videoData, fileName = 'video.mp4', mimeType = 'video/mp4', caption = '' } = req.body;
  
  console.log('🎬 ===== ENDPOINT SEND-VIDEO (JSON + BASE64) =====');
  console.log('📋 Dados recebidos:', { clientId, to, fileName, mimeType, dataLength: videoData?.length || 0 });
  
  if (!videoData) {
    return res.status(400).json({ success: false, error: 'Dados de vídeo são obrigatórios' });
  }
  
  let tempFile = null;
  
  try {
    // Validações
    const typeValidation = FileProcessor.validateFileType(mimeType, 'video');
    if (!typeValidation.isSupported) {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de vídeo não suportado: ${mimeType}`,
        supportedTypes: typeValidation.supportedTypes
      });
    }
    
    // Processar arquivo
    tempFile = await FileProcessor.processBase64File(videoData, fileName, mimeType);
    
    const sizeValidation = FileProcessor.validateFileSize(tempFile.size, 'video');
    if (!sizeValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: `Arquivo muito grande. Máximo: ${(sizeValidation.maxSize / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    // Encontrar cliente
    const client = clients.get(clientId);
    if (!client || !client.client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado ou não conectado' });
    }
    
    // Enviar via WhatsApp
    const media = MessageMedia.fromFilePath(tempFile.path);
    const result = await client.client.sendMessage(to, media, { caption });
    
    console.log('✅ Vídeo enviado com sucesso:', result.id._serialized);
    
    res.json({ 
      success: true, 
      messageId: result.id._serialized,
      details: { fileName, mimeType, size: tempFile.size, format: 'video' },
      message: 'Vídeo enviado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar vídeo:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (tempFile) {
      FileProcessor.cleanupTempFile(tempFile.path);
    }
  }
});

// Endpoint para envio de documento via JSON + base64
app.post('/api/clients/:clientId/send-document', async (req, res) => {
  const { clientId } = req.params;
  const { to, documentData, fileName = 'document.pdf', mimeType = 'application/pdf', caption = '' } = req.body;
  
  console.log('📄 ===== ENDPOINT SEND-DOCUMENT (JSON + BASE64) =====');
  console.log('📋 Dados recebidos:', { clientId, to, fileName, mimeType, dataLength: documentData?.length || 0 });
  
  if (!documentData) {
    return res.status(400).json({ success: false, error: 'Dados de documento são obrigatórios' });
  }
  
  let tempFile = null;
  
  try {
    // Validações
    const typeValidation = FileProcessor.validateFileType(mimeType, 'document');
    if (!typeValidation.isSupported) {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de documento não suportado: ${mimeType}`,
        supportedTypes: typeValidation.supportedTypes
      });
    }
    
    // Processar arquivo
    tempFile = await FileProcessor.processBase64File(documentData, fileName, mimeType);
    
    const sizeValidation = FileProcessor.validateFileSize(tempFile.size, 'document');
    if (!sizeValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: `Arquivo muito grande. Máximo: ${(sizeValidation.maxSize / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    // Encontrar cliente
    const client = clients.get(clientId);
    if (!client || !client.client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado ou não conectado' });
    }
    
    // Enviar via WhatsApp
    const media = MessageMedia.fromFilePath(tempFile.path);
    const result = await client.client.sendMessage(to, media, { caption });
    
    console.log('✅ Documento enviado com sucesso:', result.id._serialized);
    
    res.json({ 
      success: true, 
      messageId: result.id._serialized,
      details: { fileName, mimeType, size: tempFile.size, format: 'document' },
      message: 'Documento enviado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar documento:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (tempFile) {
      FileProcessor.cleanupTempFile(tempFile.path);
    }
  }
});

// Endpoint para obter estatísticas de envio de arquivos
app.get('/api/clients/:clientId/file-stats', async (req, res) => {
  const { clientId } = req.params;
  
  try {
    const client = clients.get(clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    
    const stats = {
      success: true,
      clientId,
      status: client.status,
      supportedFormats: {
        audio: ['mp3', 'wav', 'ogg', 'webm', 'aac', 'm4a'],
        image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
        video: ['mp4', 'avi', 'mov', 'webm', '3gp', 'mkv'],
        document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar']
      },
      maxSizes: {
        audio: '16MB',
        image: '5MB', 
        video: '64MB',
        document: '100MB'
      },
      endpoints: {
        audio: `/api/clients/${clientId}/send-audio`,
        image: `/api/clients/${clientId}/send-image`,
        video: `/api/clients/${clientId}/send-video`,
        document: `/api/clients/${clientId}/send-document`
      }
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

server.listen(port, function () {
    console.log('App running on *: ' + port);
});
