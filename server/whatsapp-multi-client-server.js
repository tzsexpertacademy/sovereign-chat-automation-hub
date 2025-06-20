
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Configurações
const PORT = process.env.WHATSAPP_PORT || 4000;
const CLIENTS_DIR = path.join(__dirname, 'whatsapp-sessions');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Armazenamento em memória para instâncias ativas
const activeClients = new Map();
const clientSockets = new Map();

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi-Client API',
      version: '1.0.0',
      description: 'API para gerenciamento de múltiplas instâncias WhatsApp',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de desenvolvimento',
      },
      {
        url: `http://146.59.227.248:${PORT}`,
        description: 'Servidor de produção',
      },
    ],
  },
  apis: ['./whatsapp-multi-client-server.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Garantir que o diretório de sessões existe
async function ensureDirectoryExists() {
  try {
    await fs.access(CLIENTS_DIR);
  } catch {
    await fs.mkdir(CLIENTS_DIR, { recursive: true });
  }
}

// Classe para gerenciar cliente WhatsApp
class WhatsAppClientManager {
  constructor(clientId) {
    this.clientId = clientId;
    this.client = null;
    this.qrCode = null;
    this.status = 'disconnected';
    this.phoneNumber = null;
    this.sessionPath = path.join(CLIENTS_DIR, clientId);
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isDestroying = false;
  }

  async initialize() {
    try {
      if (this.isDestroying) return false;
      
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: this.clientId,
          dataPath: this.sessionPath
        }),
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
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
          timeout: 60000
        }
      });

      this.setupEventListeners();
      await this.client.initialize();
      
      console.log(`[${this.clientId}] Cliente WhatsApp inicializado`);
      return true;
    } catch (error) {
      console.error(`[${this.clientId}] Erro ao inicializar:`, error);
      this.status = 'error';
      this.emitStatusUpdate();
      return false;
    }
  }

  setupEventListeners() {
    this.client.on('qr', async (qr) => {
      try {
        if (this.isDestroying) return;
        this.qrCode = await qrcode.toDataURL(qr);
        this.status = 'qr_ready';
        console.log(`[${this.clientId}] QR Code gerado`);
        this.emitStatusUpdate();
      } catch (error) {
        console.error(`[${this.clientId}] Erro ao gerar QR:`, error);
      }
    });

    this.client.on('ready', async () => {
      if (this.isDestroying) return;
      this.status = 'connected';
      const info = this.client.info;
      this.phoneNumber = info.wid.user;
      this.retryCount = 0;
      console.log(`[${this.clientId}] Conectado: ${this.phoneNumber}`);
      this.emitStatusUpdate();
    });

    this.client.on('authenticated', () => {
      if (this.isDestroying) return;
      console.log(`[${this.clientId}] Autenticado com sucesso`);
      this.status = 'authenticated';
      this.emitStatusUpdate();
    });

    this.client.on('auth_failure', (msg) => {
      console.error(`[${this.clientId}] Falha na autenticação:`, msg);
      this.status = 'auth_failed';
      this.emitStatusUpdate();
    });

    this.client.on('disconnected', (reason) => {
      if (this.isDestroying) return;
      console.log(`[${this.clientId}] Desconectado:`, reason);
      this.status = 'disconnected';
      this.phoneNumber = null;
      this.qrCode = null;
      this.emitStatusUpdate();
      
      // Auto-reconnect com backoff
      if (this.retryCount < this.maxRetries && reason !== 'LOGOUT') {
        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
        console.log(`[${this.clientId}] Tentando reconectar em ${delay}ms (tentativa ${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => {
          if (!this.isDestroying) {
            this.initialize();
          }
        }, delay);
      }
    });

    this.client.on('message', async (message) => {
      if (this.isDestroying) return;
      
      const messageData = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        type: message.type,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
        author: message.author,
        deviceType: message.deviceType
      };

      console.log(`[${this.clientId}] Nova mensagem de ${message.from}`);
      this.emitMessage(messageData);
    });
  }

  emitStatusUpdate() {
    const statusData = {
      clientId: this.clientId,
      status: this.status,
      phoneNumber: this.phoneNumber,
      qrCode: this.qrCode,
      timestamp: new Date().toISOString()
    };

    io.emit(`client_status_${this.clientId}`, statusData);
    io.emit('clients_update', this.getAllClientsStatus());
  }

  emitMessage(messageData) {
    io.emit(`message_${this.clientId}`, messageData);
  }

  async sendMessage(to, message, mediaUrl = null) {
    try {
      if (!this.client || this.status !== 'connected' || this.isDestroying) {
        throw new Error('Cliente não conectado');
      }

      let sentMessage;
      
      if (mediaUrl) {
        const media = await MessageMedia.fromUrl(mediaUrl);
        sentMessage = await this.client.sendMessage(to, media, { caption: message });
      } else {
        sentMessage = await this.client.sendMessage(to, message);
      }

      console.log(`[${this.clientId}] Mensagem enviada para ${to}`);
      return {
        success: true,
        messageId: sentMessage.id._serialized,
        timestamp: sentMessage.timestamp
      };
    } catch (error) {
      console.error(`[${this.clientId}] Erro ao enviar mensagem:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getChats() {
    try {
      if (!this.client || this.status !== 'connected' || this.isDestroying) {
        throw new Error('Cliente não conectado');
      }

      const chats = await this.client.getChats();
      return chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        isReadOnly: chat.isReadOnly,
        unreadCount: chat.unreadCount,
        timestamp: chat.timestamp,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          type: chat.lastMessage.type,
          timestamp: chat.lastMessage.timestamp,
          fromMe: chat.lastMessage.fromMe
        } : null
      }));
    } catch (error) {
      console.error(`[${this.clientId}] Erro ao buscar chats:`, error);
      throw error;
    }
  }

  async getChatMessages(chatId, limit = 50) {
    try {
      if (!this.client || this.status !== 'connected' || this.isDestroying) {
        throw new Error('Cliente não conectado');
      }

      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      
      return messages.map(msg => ({
        id: msg.id._serialized,
        body: msg.body,
        type: msg.type,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        author: msg.author,
        from: msg.from,
        to: msg.to
      }));
    } catch (error) {
      console.error(`[${this.clientId}] Erro ao buscar mensagens:`, error);
      throw error;
    }
  }

  async disconnect() {
    try {
      this.isDestroying = true;
      this.retryCount = this.maxRetries; // Evitar auto-reconnect
      
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      this.status = 'disconnected';
      this.phoneNumber = null;
      this.qrCode = null;
      this.emitStatusUpdate();
      console.log(`[${this.clientId}] Cliente desconectado`);
    } catch (error) {
      console.error(`[${this.clientId}] Erro ao desconectar:`, error);
    }
  }

  getAllClientsStatus() {
    const allClients = [];
    for (const [clientId, manager] of activeClients) {
      allClients.push({
        clientId,
        status: manager.status,
        phoneNumber: manager.phoneNumber,
        hasQrCode: !!manager.qrCode
      });
    }
    return allClients;
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Client:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [connected, qr_ready, connecting, authenticated, disconnected, error, auth_failed]
 *         phoneNumber:
 *           type: string
 *         hasQrCode:
 *           type: boolean
 */

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Lista todos os clientes
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clients:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 */
app.get('/api/clients', (req, res) => {
  const clients = [];
  for (const [clientId, manager] of activeClients) {
    clients.push({
      clientId,
      status: manager.status,
      phoneNumber: manager.phoneNumber,
      hasQrCode: !!manager.qrCode
    });
  }
  res.json({ success: true, clients });
});

/**
 * @swagger
 * /api/clients/{clientId}/connect:
 *   post:
 *     summary: Conecta um cliente WhatsApp
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único do cliente
 *     responses:
 *       200:
 *         description: Cliente conectado com sucesso
 *       500:
 *         description: Erro ao conectar cliente
 */
app.post('/api/clients/:clientId/connect', async (req, res) => {
  const { clientId } = req.params;
  
  try {
    if (activeClients.has(clientId)) {
      const existing = activeClients.get(clientId);
      if (existing.status === 'connected') {
        return res.json({ 
          success: true, 
          message: 'Cliente já conectado',
          status: existing.status 
        });
      }
    }

    const manager = new WhatsAppClientManager(clientId);
    activeClients.set(clientId, manager);
    
    const initialized = await manager.initialize();
    
    if (initialized) {
      res.json({ 
        success: true, 
        message: 'Conexão iniciada',
        clientId,
        status: manager.status 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Falha ao inicializar cliente' 
      });
    }
  } catch (error) {
    console.error(`Erro ao conectar cliente ${clientId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/clients/{clientId}/disconnect:
 *   post:
 *     summary: Desconecta um cliente WhatsApp
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 */
app.post('/api/clients/:clientId/disconnect', async (req, res) => {
  const { clientId } = req.params;
  
  try {
    const manager = activeClients.get(clientId);
    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }

    await manager.disconnect();
    activeClients.delete(clientId);
    
    res.json({ 
      success: true, 
      message: 'Cliente desconectado com sucesso' 
    });
  } catch (error) {
    console.error(`Erro ao desconectar cliente ${clientId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/clients/{clientId}/status:
 *   get:
 *     summary: Obtém status de um cliente
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 */
app.get('/api/clients/:clientId/status', (req, res) => {
  const { clientId } = req.params;
  const manager = activeClients.get(clientId);
  
  if (!manager) {
    return res.status(404).json({ 
      success: false, 
      error: 'Cliente não encontrado' 
    });
  }

  res.json({
    success: true,
    clientId,
    status: manager.status,
    phoneNumber: manager.phoneNumber,
    qrCode: manager.qrCode
  });
});

/**
 * @swagger
 * /api/clients/{clientId}/send-message:
 *   post:
 *     summary: Envia mensagem
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *               message:
 *                 type: string
 *               mediaUrl:
 *                 type: string
 */
app.post('/api/clients/:clientId/send-message', async (req, res) => {
  const { clientId } = req.params;
  const { to, message, mediaUrl } = req.body;
  
  try {
    const manager = activeClients.get(clientId);
    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }

    const result = await manager.sendMessage(to, message, mediaUrl);
    res.json(result);
  } catch (error) {
    console.error(`Erro ao enviar mensagem:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/clients/{clientId}/chats:
 *   get:
 *     summary: Lista chats de um cliente
 *     tags: [Chats]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 */
app.get('/api/clients/:clientId/chats', async (req, res) => {
  const { clientId } = req.params;
  
  try {
    const manager = activeClients.get(clientId);
    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }

    const chats = await manager.getChats();
    res.json({ success: true, chats });
  } catch (error) {
    console.error(`Erro ao buscar chats:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/clients/{clientId}/chats/{chatId}/messages:
 *   get:
 *     summary: Lista mensagens de um chat
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 */
app.get('/api/clients/:clientId/chats/:chatId/messages', async (req, res) => {
  const { clientId, chatId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const manager = activeClients.get(clientId);
    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }

    const messages = await manager.getChatMessages(chatId, parseInt(limit));
    res.json({ success: true, messages });
  } catch (error) {
    console.error(`Erro ao buscar mensagens:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Cliente conectado via WebSocket:', socket.id);
  
  socket.on('join_client', (clientId) => {
    socket.join(`client_${clientId}`);
    clientSockets.set(socket.id, clientId);
    console.log(`Socket ${socket.id} entrou no room do cliente ${clientId}`);
  });

  socket.on('disconnect', () => {
    const clientId = clientSockets.get(socket.id);
    if (clientId) {
      socket.leave(`client_${clientId}`);
      clientSockets.delete(socket.id);
    }
    console.log('Cliente desconectado:', socket.id);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeClients: activeClients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor'
  });
});

// Inicializar servidor
async function startServer() {
  await ensureDirectoryExists();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor WhatsApp Multi-Cliente rodando na porta ${PORT}`);
    console.log(`📚 Swagger API: http://localhost:${PORT}/api-docs`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
    console.log(`🌐 Acesso externo: http://146.59.227.248:${PORT}`);
  });
}

// Graceful shutdown melhorado
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} recebido. Encerrando servidor graciosamente...`);
  
  // Parar de aceitar novas conexões
  server.close(() => {
    console.log('Servidor HTTP fechado');
  });
  
  // Desconectar todos os clientes WhatsApp
  const disconnectPromises = [];
  for (const [clientId, manager] of activeClients) {
    console.log(`Desconectando cliente ${clientId}...`);
    disconnectPromises.push(manager.disconnect());
  }
  
  try {
    await Promise.all(disconnectPromises);
    console.log('Todos os clientes WhatsApp desconectados');
  } catch (error) {
    console.error('Erro ao desconectar clientes:', error);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('Exceção não capturada:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', reason, 'Promise:', promise);
});

startServer().catch(console.error);

module.exports = app;
