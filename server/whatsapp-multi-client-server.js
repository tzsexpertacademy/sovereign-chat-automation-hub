const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { phoneNumberFormatter } = require('./helpers/formatter');
const { imageToBase64 } = require('./helpers/image');
const { downloadMediaMessage } = require('./helpers/download');
const { transcribeAudio } = require('./services/openai');
const { sendAudio } = require('./services/elevenlabs');
const { AudioSendService } = require('./services/audioSendService');
const { SERVER_URL, PORT, WA_TIMEOUT } = require('./config/environment');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Static Files
app.use('/', express.static('public'))

// WhatsApp Client Manager
const whatsappClients = new Map();

// Audio Send Service
const audioSendService = new AudioSendService();

// Generate session name
const generateSessionName = () => {
    return `session-${uuidv4()}`;
};

// Save session data
const saveSession = (clientId, data) => {
    const sessionFile = `./sessions/session-${clientId}.json`;
    fs.writeFileSync(sessionFile, JSON.stringify(data));
};

// Load session data
const loadSession = (clientId) => {
    const sessionFile = `./sessions/session-${clientId}.json`;
    if (fs.existsSync(sessionFile)) {
        const sessionData = fs.readFileSync(sessionFile, 'utf-8');
        return JSON.parse(sessionData);
    }
    return null;
};

// Remove session file
const removeSessionFile = (clientId) => {
    const sessionFile = `./sessions/session-${clientId}.json`;
    if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
    }
};

// Initialize client
const initClient = async (clientId, io) => {
    console.log(`Initializing client: ${clientId}`);
    let client;
    const sessionData = loadSession(clientId);

    if (sessionData) {
        client = new Client({
            session: sessionData,
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // <- May be unstable
                    '--disable-gpu'
                ]
            }
        });
    } else {
        client = new Client({
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // <- May be unstable
                    '--disable-gpu'
                ]
            }
        });
    }

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Failed to generate QR code:', err);
                io.emit('client_status', { clientId: clientId, status: 'qr_error', error: err.message });
                return;
            }
            io.emit('client_status', { clientId: clientId, status: 'qr_ready', qrCode: url });
        });
    });

    client.on('authenticated', (session) => {
        console.log('WHATSAPP WEB => Authenticated');
        saveSession(clientId, session);
        io.emit('client_status', { clientId: clientId, status: 'authenticated' });
    });

    client.on('auth_failure', (msg) => {
        console.error('AUTHENTICATION FAILURE', msg);
        io.emit('client_status', { clientId: clientId, status: 'auth_failed', error: msg });
    });

    client.on('ready', () => {
        console.log('WHATSAPP WEB => Ready');
        whatsappClients.set(clientId, { client: client, connected: true });
        io.emit('client_status', { clientId: clientId, status: 'connected', phoneNumber: client.info.wid.user });
    });

    client.on('disconnected', (reason) => {
        console.log('WHATSAPP WEB => Disconnected: ' + reason);
        whatsappClients.delete(clientId);
        removeSessionFile(clientId);
        io.emit('client_status', { clientId: clientId, status: 'disconnected', reason: reason });
    });

    client.on('message', async msg => {
        console.log('Message received', msg.body);
        io.emit('message', { clientId: clientId, message: msg });

        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media) {
                    console.log('Media downloaded', media.filename);
                    io.emit('media', { clientId: clientId, media: media });
                }
            } catch (error) {
                console.error('Error downloading media:', error);
                io.emit('media_error', { clientId: clientId, error: error.message });
            }
        }
    });

    try {
        console.log(`Connecting client: ${clientId}`);
        await client.initialize();
        console.log(`Client initialized: ${clientId}`);
    } catch (error) {
        console.error(`Error initializing client ${clientId}:`, error);
        io.emit('client_status', { clientId: clientId, status: 'init_failed', error: error.message });
    }
};

// Socket.IO
io.on('connection', socket => {
    console.log('Client connected', socket.id);

    socket.on('join_client', clientId => {
        socket.join(clientId);
        console.log(`Socket ${socket.id} joined client room ${clientId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthcheck = {
        status: 'up',
        timestamp: new Date(),
        activeClients: whatsappClients.size,
        connectedClients: Array.from(whatsappClients.entries()).filter(([clientId, { connected }]) => connected).length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
        server: 'WhatsApp Multi Client Server'
    };
    console.log('Health check requested', healthcheck);
    res.json(healthcheck);
});

// Get all clients
app.get('/clients', (req, res) => {
    const clients = Array.from(whatsappClients.entries()).map(([clientId, { connected, client }]) => ({
        clientId,
        connected,
        phoneNumber: client?.info?.wid?.user
    }));
    console.log('Clients requested', clients);
    res.json({ success: true, clients });
});

// Initialize a new client
app.post('/clients/new', (req, res) => {
    const clientId = generateSessionName();
    console.log(`New client requested, generating id ${clientId}`);
    initClient(clientId, io);
    res.json({ success: true, clientId });
});

// Connect to an existing client
app.post('/clients/:clientId/connect', (req, res) => {
    const clientId = req.params.clientId;
    console.log(`Connect client requested for ${clientId}`);
    const client = whatsappClients.get(clientId);
    if (!client) {
        initClient(clientId, io);
        res.json({ success: true, message: 'Client connecting' });
    } else if (client.connected) {
        res.json({ success: false, message: 'Client already connected', clientId });
    } else {
        res.json({ success: true, message: 'Client connecting' });
    }
});

// Disconnect client
app.post('/clients/:clientId/disconnect', (req, res) => {
    const clientId = req.params.clientId;
    console.log(`Disconnect client requested for ${clientId}`);
    const client = whatsappClients.get(clientId);
    if (client && client.client) {
        client.client.logout().then(() => {
            whatsappClients.delete(clientId);
            removeSessionFile(clientId);
            res.json({ success: true, message: 'Client disconnected' });
        }).catch(err => {
            console.error('Error disconnecting client:', err);
            res.status(500).json({ success: false, message: 'Failed to disconnect client', error: err.message });
        });
    } else {
        res.status(404).json({ success: false, message: 'Client not found' });
    }
});

// Get client status
app.get('/clients/:clientId/status', (req, res) => {
    const clientId = req.params.clientId;
    const client = whatsappClients.get(clientId);
    if (!client) {
        return res.status(404).json({ success: false, error: 'Client not found' });
    }
    const clientStatus = {
        clientId: clientId,
        status: client.client.readyState,
        phoneNumber: client.client?.info?.wid?.user,
    };
    console.log('Client status requested', clientStatus);
    res.json({ success: true, ...clientStatus });
});

// Send a message
app.post('/clients/:clientId/send-message', async (req, res) => {
    const clientId = req.params.clientId;
    const { to, message } = req.body;
    console.log(`Send message requested for ${clientId} to ${to}`);
    const client = whatsappClients.get(clientId);

    if (!client || !client.client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
    }

    client.client.sendMessage(phoneNumberFormatter(to), message).then(response => {
        console.log('Message sent', response);
        res.json({ success: true, message: 'Message sent', response });
    }).catch(err => {
        console.error('Error sending message:', err);
        res.status(500).json({ success: false, message: 'Failed to send message', error: err.message });
    });
});

// Get chats
app.get('/clients/:clientId/chats', async (req, res) => {
    const clientId = req.params.clientId;
    console.log(`Get chats requested for ${clientId}`);
    const client = whatsappClients.get(clientId);

    if (!client || !client.client) {
        return res.status(404).json({ success: false, message: 'Client not found' });
    }

    try {
        const chats = await client.client.getChats();
        console.log('Chats retrieved', chats.length);
        res.json({ success: true, chats });
    } catch (err) {
        console.error('Error getting chats:', err);
        res.status(500).json({ success: false, message: 'Failed to get chats', error: err.message });
    }
});

const { AudioProcessor } = require('./utils/audioProcessor');

// Função para adicionar headers CORS seletivos
function addSelectiveCORS(req, res, next) {
  // Aplicar CORS apenas para rotas que começam com /api/
  if (req.path.startsWith('/api/')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
}

// Aplicar CORS seletivo ANTES das rotas
app.use(addSelectiveCORS);

// ====== NOVA SEÇÃO: ROTAS DE API COMPATÍVEIS ======
// Estas rotas complementam as existentes sem alterá-las

// Nova rota para envio de áudio compatível com frontend (JSON + base64)
app.post('/api/clients/:clientId/send-audio', async (req, res) => {
  const startTime = Date.now();
  const { clientId } = req.params;
  const { to, audioData, fileName, mimeType } = req.body;

  console.log('🎵 ===== NOVA ROTA DE ÁUDIO (API/JSON) =====');
  console.log('📊 Dados recebidos:', {
    clientId,
    to,
    fileName: fileName || 'audio.ogg',
    mimeType: mimeType || 'audio/ogg',
    audioDataLength: audioData ? audioData.length : 0,
    timestamp: new Date().toISOString()
  });

  try {
    // Validar dados obrigatórios
    if (!to || !audioData) {
      console.error('❌ Dados obrigatórios ausentes:', { to: !!to, audioData: !!audioData });
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: to (destinatário) e audioData (base64)',
        details: { missingTo: !to, missingAudioData: !audioData }
      });
    }

    // Verificar se cliente existe e está conectado
    const client = whatsappClients.get(clientId);
    if (!client || !client.client) {
      console.error('❌ Cliente não encontrado ou não conectado:', clientId);
      return res.status(404).json({
        success: false,
        error: 'Cliente WhatsApp não encontrado ou não conectado',
        clientId
      });
    }

    // Processar áudio base64
    const audioFileName = fileName || `audio_${Date.now()}.ogg`;
    const audioMimeType = AudioProcessor.optimizeMimeType(mimeType || 'audio/ogg');
    
    console.log('🔄 Processando áudio com AudioProcessor...');
    const media = AudioProcessor.processBase64Audio(audioData, audioFileName, audioMimeType);
    
    // Obter estatísticas do áudio
    const audioStats = AudioProcessor.getAudioStats(audioData, mimeType || 'audio/ogg');
    console.log('📊 Estatísticas do áudio:', audioStats);

    // Usar o AudioSendService existente para enviar
    console.log('📤 Enviando áudio via AudioSendService...');
    const sendResult = await audioSendService.sendAudioWithRetry(
      client.client,
      to,
      media,
      audioFileName
    );

    const processingTime = Date.now() - startTime;

    if (sendResult.success) {
      console.log('✅ Áudio enviado com sucesso via nova rota API:', {
        processingTimeMs: processingTime,
        attempts: sendResult.attempts,
        format: sendResult.format
      });

      res.json({
        success: true,
        message: 'Áudio enviado com sucesso',
        details: {
          attempts: sendResult.attempts,
          format: sendResult.format,
          isFallback: sendResult.isFallback,
          processingTimeMs: processingTime,
          audioStats
        }
      });
    } else {
      console.error('❌ Falha no envio via AudioSendService:', sendResult.error);
      res.status(500).json({
        success: false,
        error: sendResult.error,
        details: {
          attempts: sendResult.attempts,
          processingTimeMs: processingTime,
          audioStats
        }
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Erro crítico na nova rota de áudio:', error);
    
    res.status(500).json({
      success: false,
      error: `Erro no processamento: ${error.message}`,
      details: {
        processingTimeMs: processingTime,
        errorType: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

// Nova rota para obter estatísticas de áudio (compatível com frontend)
app.get('/api/clients/:clientId/audio-stats', (req, res) => {
  const { clientId } = req.params;
  
  console.log('📊 Solicitação de estatísticas de áudio:', clientId);
  
  try {
    const client = whatsappClients.get(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Obter estatísticas do AudioSendService se disponível
    const stats = audioSendService.getStats ? audioSendService.getStats(clientId) : null;
    
    res.json({
      success: true,
      clientId,
      stats: stats || {
        totalSent: 0,
        successRate: 100,
        averageProcessingTime: 0,
        supportedFormats: ['audio/ogg', 'audio/mpeg', 'audio/wav'],
        lastActivity: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====== FIM DA NOVA SEÇÃO ======

// Start server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
