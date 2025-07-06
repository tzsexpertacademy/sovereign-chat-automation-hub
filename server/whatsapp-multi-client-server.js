
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi-Client API',
      version: '1.0.0',
      description: 'API para gerenciar múltiplas instâncias do WhatsApp',
    },
    servers: [
      {
        url: 'http://146.59.227.248:4000',
        description: 'Servidor de Produção',
      },
    ],
  },
  apis: ['./whatsapp-multi-client-server.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Armazenamento global dos clientes
const clients = new Map();
const clientStatuses = new Map();

// Configuração do Puppeteer atualizada
const getPuppeteerConfig = () => ({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--disable-plugins',
    '--window-size=1366,768',
    '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  ],
  timeout: 120000,
  protocolTimeout: 120000,
  ignoreHTTPSErrors: true,
  handleSIGINT: false,
  handleSIGTERM: false
});

// Função para inicializar cliente (corrigida - sem duplicação)
const initClient = (clientId) => {
  console.log(`🚀 Inicializando cliente: ${clientId}`);
  
  try {
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: clientId,
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: getPuppeteerConfig()
    });

    // Event listeners
    client.on('qr', async (qr) => {
      console.log(`📱 QR CODE GERADO para ${clientId}`);
      try {
        const qrDataUrl = await qrcode.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        clientStatuses.set(clientId, {
          clientId,
          status: 'qr_ready',
          hasQrCode: true,
          qrCode: qrDataUrl,
          qrTimestamp: new Date().toISOString()
        });

        console.log(`✅ QR Code convertido para cliente ${clientId}`);
        io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));
      } catch (error) {
        console.error(`❌ Erro ao gerar QR Code para ${clientId}:`, error);
      }
    });

    client.on('ready', () => {
      console.log(`✅ Cliente ${clientId} conectado!`);
      clientStatuses.set(clientId, {
        clientId,
        status: 'connected',
        hasQrCode: false,
        qrCode: null,
        phoneNumber: client.info?.wid?.user || null
      });
      io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));
    });

    client.on('authenticated', () => {
      console.log(`🔐 Cliente ${clientId} autenticado`);
      clientStatuses.set(clientId, {
        clientId,
        status: 'authenticated',
        hasQrCode: false,
        qrCode: null
      });
      io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));
    });

    client.on('auth_failure', (msg) => {
      console.log(`❌ Falha de autenticação ${clientId}:`, msg);
      clientStatuses.set(clientId, {
        clientId,
        status: 'auth_failed',
        hasQrCode: false,
        qrCode: null,
        error: msg
      });
      io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));
    });

    client.on('disconnected', (reason) => {
      console.log(`🔌 Cliente ${clientId} desconectado:`, reason);
      clientStatuses.set(clientId, {
        clientId,
        status: 'disconnected',
        hasQrCode: false,
        qrCode: null,
        reason
      });
      io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));
    });

    clients.set(clientId, client);
    clientStatuses.set(clientId, {
      clientId,
      status: 'connecting',
      hasQrCode: false,
      qrCode: null
    });

    // Inicializar cliente
    client.initialize().catch(error => {
      console.error(`❌ Erro ao inicializar cliente ${clientId}:`, error);
      clientStatuses.set(clientId, {
        clientId,
        status: 'error',
        hasQrCode: false,
        qrCode: null,
        error: error.message
      });
      io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));
    });

    return client;
  } catch (error) {
    console.error(`❌ Erro fatal ao criar cliente ${clientId}:`, error);
    throw error;
  }
};

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('🔌 Novo cliente conectado:', socket.id);

  socket.on('join_client', (clientId) => {
    console.log(`📱 Cliente ${socket.id} entrou na sala: ${clientId}`);
    socket.join(clientId);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificação de saúde do servidor
 *     responses:
 *       200:
 *         description: Servidor funcionando
 */
app.get('/health', (req, res) => {
  const activeClients = clients.size;
  const connectedClients = Array.from(clientStatuses.values())
    .filter(status => status.status === 'connected').length;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeClients,
    connectedClients,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0',
    server: 'WhatsApp Multi-Client HTTPS'
  });
});

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Lista todos os clientes
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
app.get('/clients', (req, res) => {
  const clientList = Array.from(clientStatuses.values());
  res.json({
    success: true,
    clients: clientList,
    total: clientList.length
  });
});

/**
 * @swagger
 * /clients/{clientId}/connect:
 *   post:
 *     summary: Conecta um cliente
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cliente conectado
 */
app.post('/clients/:clientId/connect', async (req, res) => {
  const { clientId } = req.params;
  
  try {
    console.log(`🔗 Conectando cliente: ${clientId}`);
    
    if (clients.has(clientId)) {
      const client = clients.get(clientId);
      if (client.pupPage) {
        console.log(`⚠️ Cliente ${clientId} já existe, reiniciando...`);
        await client.destroy();
        clients.delete(clientId);
      }
    }

    const client = initClient(clientId);
    
    res.json({
      success: true,
      message: `Cliente ${clientId} iniciado`,
      clientId,
      status: 'connecting'
    });
  } catch (error) {
    console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      clientId
    });
  }
});

/**
 * @swagger
 * /clients/{clientId}/disconnect:
 *   post:
 *     summary: Desconecta um cliente
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cliente desconectado
 */
app.post('/clients/:clientId/disconnect', async (req, res) => {
  const { clientId } = req.params;
  
  try {
    console.log(`🔌 Desconectando cliente: ${clientId}`);
    
    if (clients.has(clientId)) {
      const client = clients.get(clientId);
      await client.destroy();
      clients.delete(clientId);
    }

    clientStatuses.set(clientId, {
      clientId,
      status: 'disconnected',
      hasQrCode: false,
      qrCode: null
    });

    io.emit(`client_status_${clientId}`, clientStatuses.get(clientId));

    res.json({
      success: true,
      message: `Cliente ${clientId} desconectado`,
      clientId
    });
  } catch (error) {
    console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      clientId
    });
  }
});

/**
 * @swagger
 * /clients/{clientId}/status:
 *   get:
 *     summary: Obtém status de um cliente
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status do cliente
 */
app.get('/clients/:clientId/status', (req, res) => {
  const { clientId } = req.params;
  
  const status = clientStatuses.get(clientId) || {
    clientId,
    status: 'disconnected',
    hasQrCode: false,
    qrCode: null
  };

  res.json({
    success: true,
    ...status
  });
});

/**
 * @swagger
 * /clients/{clientId}/send-message:
 *   post:
 *     summary: Envia mensagem
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
 *     responses:
 *       200:
 *         description: Mensagem enviada
 */
app.post('/clients/:clientId/send-message', async (req, res) => {
  const { clientId } = req.params;
  const { to, message } = req.body;
  
  try {
    const client = clients.get(clientId);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    const result = await client.sendMessage(to, message);
    
    res.json({
      success: true,
      messageId: result.id.id,
      to,
      message
    });
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Inicializar servidor
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor WhatsApp Multi-Cliente rodando na porta ${PORT}`);
  console.log(`📚 Documentação Swagger: http://146.59.227.248:${PORT}/api-docs`);
  console.log(`❤️ Health Check: http://146.59.227.248:${PORT}/health`);
  console.log(`📦 WhatsApp Web.js: Versão mais recente`);
  console.log(`🤖 Puppeteer: Versão mais recente`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
});

// Cleanup ao sair
process.on('SIGINT', async () => {
  console.log('🛑 Encerrando servidor...');
  
  for (const [clientId, client] of clients) {
    try {
      console.log(`🔌 Desconectando cliente ${clientId}...`);
      await client.destroy();
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
    }
  }
  
  process.exit(0);
});
