const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// NOVO: Importar módulo de file handlers
const { setupFileRoutes } = require('./modules/file-handlers');

const app = express();
const server = require('http').createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://ymygyvagdvsdkduxmgu.supabase.co",
      "https://fafec97e-8cd2-472c-a8ce-3bd8e2ed0b08.lovableproject.com",
      "http://localhost:5173",
      "http://localhost:8080",
      "https://localhost:8080"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

app.use(cors({
  origin: [
    "https://ymygyvagdvsdkduxmgu.supabase.co",
    "https://fafec97e-8cd2-472c-a8ce-3bd8e2ed0b08.lovableproject.com", 
    "http://localhost:5173",
    "http://localhost:8080",
    "https://localhost:8080"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi Client API',
      version: '1.0.0',
      description: 'API para gerenciar múltiplas instâncias do WhatsApp com autenticação via QR code e envio de mensagens.'
    },
  },
  apis: ['./whatsapp-multi-client-server.js'], // files containing annotations as above
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const supabaseUrl = 'https://ymygyvagdvsdkduxmgu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI';
const supabase = createClient(supabaseUrl, supabaseKey);

const clients = {};

function generateQRCode(text) {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(text, (err, url) => {
      if (err) {
        reject(err);
      } else {
        resolve(url);
      }
    });
  });
}

async function updateClientStatus(instanceId, status) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .update({ status: status })
      .eq('instance_id', instanceId);

    if (error) {
      console.error('Erro ao atualizar o status do cliente no Supabase:', error);
    } else {
      console.log(`Status do cliente ${instanceId} atualizado para ${status} no Supabase.`);
    }
  } catch (error) {
    console.error('Erro ao atualizar o status do cliente no Supabase:', error);
  }
}

io.on('connection', (socket) => {
  console.log('Novo cliente Socket.IO conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('Cliente Socket.IO desconectado:', socket.id);
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verifica a saúde do servidor.
 *     responses:
 *       200:
 *         description: Servidor está saudável.
 */
app.get('/health', (req, res) => {
  res.send('Servidor está saudável');
});

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Cria uma nova instância do cliente WhatsApp.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceId:
 *                 type: string
 *                 description: ID único para a instância do cliente.
 *     responses:
 *       200:
 *         description: Instância do cliente criada com sucesso.
 *       400:
 *         description: ID da instância já existe.
 */
app.post('/api/clients', async (req, res) => {
  const instanceId = req.body.instanceId;

  if (!instanceId) {
    return res.status(400).json({ error: 'O ID da instância é obrigatório.' });
  }

  if (clients[instanceId]) {
    return res.status(400).json({ error: 'ID da instância já existe.' });
  }

  clients[instanceId] = new Client({
    authStrategy: new LocalAuth({ clientId: instanceId }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- May be required on some systems
        '--disable-gpu'
      ]
    }
  });

  clients[instanceId].initialize();

  clients[instanceId].on('qr', async qr => {
    console.log(`QR recebido para ${instanceId}`);
    try {
      const qrCodeURL = await generateQRCode(qr);
      io.emit('qr', { instanceId: instanceId, qr: qrCodeURL });
    } catch (error) {
      console.error('Erro ao gerar o QR code:', error);
      io.emit('qr_error', { instanceId: instanceId, error: 'Falha ao gerar QR Code' });
    }
  });

  clients[instanceId].on('authenticated', (session) => {
    console.log(`Cliente ${instanceId} autenticado`);
    io.emit('authenticated', { instanceId: instanceId, message: 'Autenticado!' });
  });

  clients[instanceId].on('auth_failure', msg => {
    console.error(`Falha na autenticação do cliente ${instanceId}:`, msg);
    io.emit('auth_failure', { instanceId: instanceId, message: 'Falha na autenticação' });
  });

  clients[instanceId].on('ready', async () => {
    console.log(`Cliente ${instanceId} está pronto!`);
    io.emit('ready', { instanceId: instanceId, message: 'WhatsApp está pronto!' });
    await updateClientStatus(instanceId, 'ready');
  });

  clients[instanceId].on('disconnected', async (reason) => {
    console.log(`Cliente ${instanceId} foi desconectado: ${reason}`);
    io.emit('disconnected', { instanceId: instanceId, message: 'WhatsApp foi desconectado.' });
    await updateClientStatus(instanceId, 'disconnected');
    delete clients[instanceId];
  });

  clients[instanceId].on('message', async msg => {
    console.log('Mensagem recebida', msg.body);
    io.emit('message', { instanceId: instanceId, message: msg.body });
  });

  res.json({ message: 'Instância do cliente WhatsApp criada com sucesso.', instanceId: instanceId });
});

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Recupera o status de uma instância do cliente WhatsApp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância do cliente.
 *     responses:
 *       200:
 *         description: Status da instância do cliente.
 *       404:
 *         description: Instância do cliente não encontrada.
 */
app.get('/api/clients/:id', async (req, res) => {
  const instanceId = req.params.id;

  if (!clients[instanceId]) {
    return res.status(404).json({ error: 'Instância do cliente não encontrada.' });
  }

  try {
    const state = await clients[instanceId].getState();
    res.json({ instanceId: instanceId, status: state });
  } catch (error) {
    console.error(`Erro ao obter o estado do cliente ${instanceId}:`, error);
    res.status(500).json({ error: 'Erro ao obter o estado do cliente.' });
  }
});

/**
 * @swagger
 * /api/clients/{id}/logout:
 *   post:
 *     summary: Desconecta uma instância do cliente WhatsApp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância do cliente.
 *     responses:
 *       200:
 *         description: Instância do cliente desconectada com sucesso.
 *       404:
 *         description: Instância do cliente não encontrada.
 */
app.post('/api/clients/:id/logout', async (req, res) => {
  const instanceId = req.params.id;

  if (!clients[instanceId]) {
    return res.status(404).json({ error: 'Instância do cliente não encontrada.' });
  }

  try {
    await clients[instanceId].logout();
    res.json({ message: `Cliente ${instanceId} desconectado com sucesso.` });
  } catch (error) {
    console.error(`Erro ao desconectar o cliente ${instanceId}:`, error);
    res.status(500).json({ error: 'Erro ao desconectar o cliente.' });
  }
});

/**
 * @swagger
 * /api/clients/{id}/close:
 *   post:
 *     summary: Fecha e remove uma instância do cliente WhatsApp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância do cliente.
 *     responses:
 *       200:
 *         description: Instância do cliente fechada com sucesso.
 *       404:
 *         description: Instância do cliente não encontrada.
 */
app.post('/api/clients/:id/close', async (req, res) => {
  const instanceId = req.params.id;

  if (!clients[instanceId]) {
    return res.status(404).json({ error: 'Instância do cliente não encontrada.' });
  }

  try {
    await clients[instanceId].destroy();
    delete clients[instanceId];
    res.json({ message: `Cliente ${instanceId} fechado e removido com sucesso.` });
  } catch (error) {
    console.error(`Erro ao fechar o cliente ${instanceId}:`, error);
    res.status(500).json({ error: 'Erro ao fechar o cliente.' });
  }
});

/**
 * @swagger
 * /api/clients/{id}/send:
 *   post:
 *     summary: Envia uma mensagem de texto via WhatsApp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância do cliente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number:
 *                 type: string
 *                 description: Número do destinatário.
 *               message:
 *                 type: string
 *                 description: Conteúdo da mensagem.
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso.
 *       400:
 *         description: Número e mensagem são obrigatórios.
 *       404:
 *         description: Instância do cliente não encontrada.
 */
app.post('/api/clients/:id/send', async (req, res) => {
  const instanceId = req.params.id;
  const number = req.body.number;
  const message = req.body.message;

  if (!number || !message) {
    return res.status(400).json({ error: 'Número e mensagem são obrigatórios.' });
  }

  if (!clients[instanceId]) {
    return res.status(404).json({ error: 'Instância do cliente não encontrada.' });
  }

  try {
    await clients[instanceId].sendMessage(number, message);
    res.json({ message: 'Mensagem enviada com sucesso.' });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
});

/**
 * @swagger
 * /api/clients/{id}/send-media:
 *   post:
 *     summary: Envia um arquivo de mídia via WhatsApp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância do cliente.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               number:
 *                 type: string
 *                 description: Número do destinatário.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de mídia a ser enviado.
 *     responses:
 *       200:
 *         description: Arquivo de mídia enviado com sucesso.
 *       400:
 *         description: Número e arquivo são obrigatórios.
 *       404:
 *         description: Instância do cliente não encontrada.
 */
app.post('/api/clients/:id/send-media', async (req, res) => {
  const instanceId = req.params.id;
  const number = req.body.number;
  const file = req.files.file;

  if (!number || !file) {
    return res.status(400).json({ error: 'Número e arquivo são obrigatórios.' });
  }

  if (!clients[instanceId]) {
    return res.status(404).json({ error: 'Instância do cliente não encontrada.' });
  }

  try {
    const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
    await clients[instanceId].sendMessage(number, media);
    res.json({ message: 'Arquivo de mídia enviado com sucesso.' });
  } catch (error) {
    console.error('Erro ao enviar arquivo de mídia:', error);
    res.status(500).json({ error: 'Erro ao enviar arquivo de mídia.' });
  }
});

// NOVO: Configurar rotas de file handlers (ADICIONAR ANTES DAS ROTAS EXISTENTES)
setupFileRoutes(app, clients);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 WhatsApp Multi-Cliente Server rodando na porta ${PORT}`);
  console.log(`📊 Swagger UI disponível em: http://localhost:${PORT}/api-docs`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Módulo File Handlers: ATIVO`);
});
