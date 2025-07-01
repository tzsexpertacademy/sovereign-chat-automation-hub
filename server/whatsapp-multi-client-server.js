const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const http = require('http');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const clients = {};

// Função para atualizar status no banco de dados
const updateInstanceStatusInDB = async (instanceId, status, phoneNumber = null, additionalData = {}) => {
  try {
    console.log(`📊 [DB-UPDATE] Atualizando ${instanceId}: ${status}${phoneNumber ? ` | ${phoneNumber}` : ''}`);
    
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };
    
    if (phoneNumber) {
      updateData.phone_number = phoneNumber;
    }
    
    // Simular chamada para banco (implementar com sua conexão real)
    // await supabase.from('whatsapp_instances').update(updateData).eq('instance_id', instanceId);
    
    console.log(`✅ [DB-UPDATE] Status atualizado no banco: ${instanceId} = ${status}`);
    return true;
  } catch (error) {
    console.error(`❌ [DB-UPDATE] Erro ao atualizar banco ${instanceId}:`, error);
    return false;
  }
};

// Função para notificar mudança de status via WebSocket
const notifyStatusChange = (instanceId, statusData) => {
  try {
    console.log(`📡 [WEBSOCKET] Notificando mudança ${instanceId}:`, statusData);
    
    // Emitir para a sala específica da instância
    io.to(`client_${instanceId}`).emit(`client_status_${instanceId}`, statusData);
    
    // Emitir para administradores
    io.emit('instance_status_update', {
      instanceId,
      ...statusData
    });
    
    console.log(`✅ [WEBSOCKET] Notificação enviada para ${instanceId}`);
  } catch (error) {
    console.error(`❌ [WEBSOCKET] Erro ao notificar ${instanceId}:`, error);
  }
};

// Middleware para verificar se o cliente existe
const ensureClientExists = (req, res, next) => {
  const clientId = req.params.id;
  if (!clients[clientId]) {
    return res.status(404).json({
      success: false,
      message: 'Cliente não encontrado'
    });
  }
  next();
};

// Rota para gerar um novo ID de cliente
app.get('/generate-id', (req, res) => {
  const clientId = `client_${Date.now()}`;
  res.json({ clientId });
});

// Rota para listar todos os clientes
app.get('/clients', (req, res) => {
  const clientList = Object.keys(clients).map(clientId => {
    const client = clients[clientId];
    return {
      clientId,
      status: client.status,
      phoneNumber: client.phoneNumber,
      qrCode: client.qrCode
    };
  });
  res.json({
    success: true,
    clients: clientList
  });
});

app.get('/clients/:id/status', (req, res) => {
  const clientId = req.params.id;
  console.log(`📊 [STATUS-CHECK] Verificando status de ${clientId}`);
  
  try {
    const client = clients[clientId];
    
    if (!client) {
      console.log(`❌ [STATUS-CHECK] Cliente ${clientId} não encontrado`);
      return res.json({
        success: true,
        clientId,
        status: 'disconnected',
        phoneNumber: null,
        hasQrCode: false,
        qrCode: null,
        timestamp: new Date().toISOString()
      });
    }

    // Verificar status real da conexão
    let actualStatus = 'disconnected';
    let phoneNumber = null;
    let hasQrCode = false;
    let qrCode = null;

    // PRIORIDADE 1: Cliente conectado com número
    if (client.info && client.info.wid && client.info.wid._serialized) {
      actualStatus = 'connected';
      phoneNumber = client.info.wid._serialized.split('@')[0];
      hasQrCode = false;
      qrCode = null;
      
      console.log(`✅ [STATUS-CHECK] ${clientId} CONECTADO: ${phoneNumber}`);
      
      // FORÇAR atualização no banco imediatamente
      updateInstanceStatusInDB(clientId, 'connected', phoneNumber);
      
      // Notificar WebSocket sobre conexão
      const statusData = {
        clientId,
        status: 'connected',
        phoneNumber,
        hasQrCode: false,
        qrCode: null,
        timestamp: new Date().toISOString()
      };
      
      notifyStatusChange(clientId, statusData);
      
      return res.json({
        success: true,
        ...statusData
      });
    }

    // PRIORIDADE 2: QR Code disponível (apenas se NÃO conectado)
    if (client.qrCode && !phoneNumber) {
      actualStatus = 'qr_ready';
      hasQrCode = true;
      qrCode = client.qrCode;
      
      console.log(`📱 [STATUS-CHECK] ${clientId} QR_READY - QR disponível`);
      
      updateInstanceStatusInDB(clientId, 'qr_ready', null, { hasQrCode: true });
    }
    // PRIORIDADE 3: Conectando/Autenticando
    else if (client.status === 'connecting' || client.status === 'authenticated') {
      actualStatus = client.status;
      console.log(`🔄 [STATUS-CHECK] ${clientId} ${actualStatus.toUpperCase()}`);
      
      updateInstanceStatusInDB(clientId, actualStatus);
    }
    // PRIORIDADE 4: Desconectado
    else {
      actualStatus = 'disconnected';
      console.log(`❌ [STATUS-CHECK] ${clientId} DESCONECTADO`);
      
      updateInstanceStatusInDB(clientId, 'disconnected');
    }

    const responseData = {
      success: true,
      clientId,
      status: actualStatus,
      phoneNumber,
      hasQrCode,
      qrCode,
      timestamp: new Date().toISOString()
    };

    console.log(`📊 [STATUS-RESPONSE] ${clientId}:`, {
      status: actualStatus,
      phone: phoneNumber || 'none',
      hasQR: hasQrCode
    });

    return res.json(responseData);

  } catch (error) {
    console.error(`❌ [STATUS-CHECK] Erro para ${clientId}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message,
      clientId,
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/clients/:id/send-message', ensureClientExists, async (req, res) => {
  const clientId = req.params.id;
  const { to, message } = req.body;

  try {
    await clients[clientId].sendMessage(to, message);
    res.json({
      success: true,
      message: 'Mensagem enviada'
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem'
    });
  }
});

app.get('/clients/:id/chats', ensureClientExists, async (req, res) => {
  const clientId = req.params.id;

  try {
    const chats = await clients[clientId].getChats();
    res.json({
      success: true,
      chats
    });
  } catch (error) {
    console.error('Erro ao obter chats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter chats'
    });
  }
});

// Configurar eventos do cliente WhatsApp com atualização imediata
const setupClientEvents = (client, clientId) => {
  console.log(`🎯 [EVENTS] Configurando eventos para ${clientId}`);

  // Evento: QR Code gerado
  client.on('qr', async (qr) => {
    console.log(`📱 [QR-GENERATED] ${clientId} - QR Code gerado`);
    
    clients[clientId].qrCode = qr;
    clients[clientId].status = 'qr_ready';
    
    // Atualizar banco
    await updateInstanceStatusInDB(clientId, 'qr_ready', null, { hasQrCode: true });
    
    // Notificar WebSocket
    notifyStatusChange(clientId, {
      clientId,
      status: 'qr_ready',
      phoneNumber: null,
      hasQrCode: true,
      qrCode: qr,
      timestamp: new Date().toISOString()
    });
  });

  // Evento: Cliente autenticado
  client.on('authenticated', async () => {
    console.log(`✅ [AUTHENTICATED] ${clientId} - Autenticado`);
    
    clients[clientId].status = 'authenticated';
    
    // Atualizar banco
    await updateInstanceStatusInDB(clientId, 'authenticated');
    
    // Notificar WebSocket
    notifyStatusChange(clientId, {
      clientId,
      status: 'authenticated',
      phoneNumber: null,
      hasQrCode: false,
      qrCode: null,
      timestamp: new Date().toISOString()
    });
  });

  // Evento: Cliente pronto (CONECTADO)
  client.on('ready', async () => {
    console.log(`🚀 [READY] ${clientId} - Cliente conectado e pronto!`);
    
    try {
      // Obter informações do cliente
      const info = await client.getState();
      const phoneNumber = client.info?.wid?._serialized?.split('@')[0] || null;
      
      console.log(`📱 [READY] ${clientId} - Número: ${phoneNumber}`);
      
      // Atualizar objeto cliente
      clients[clientId].status = 'connected';
      clients[clientId].phoneNumber = phoneNumber;
      clients[clientId].qrCode = null; // LIMPAR QR Code
      
      // FORÇAR atualização no banco IMEDIATAMENTE
      await updateInstanceStatusInDB(clientId, 'connected', phoneNumber);
      
      // Notificar WebSocket IMEDIATAMENTE
      const statusData = {
        clientId,
        status: 'connected',
        phoneNumber,
        hasQrCode: false,
        qrCode: null,
        timestamp: new Date().toISOString()
      };
      
      notifyStatusChange(clientId, statusData);
      
      console.log(`✅ [READY] ${clientId} - Status atualizado: connected | ${phoneNumber}`);
      
    } catch (error) {
      console.error(`❌ [READY] Erro ao processar ready ${clientId}:`, error);
    }
  });

  // Evento: Cliente desconectado
  client.on('disconnected', async (reason) => {
    console.log(`❌ [DISCONNECTED] ${clientId} - Razão: ${reason}`);
    
    clients[clientId].status = 'disconnected';
    clients[clientId].phoneNumber = null;
    clients[clientId].qrCode = null;
    
    // Atualizar banco
    await updateInstanceStatusInDB(clientId, 'disconnected');
    
    // Notificar WebSocket
    notifyStatusChange(clientId, {
      clientId,
      status: 'disconnected',
      phoneNumber: null,
      hasQrCode: false,
      qrCode: null,
      timestamp: new Date().toISOString()
    });
  });
};

// Melhorar endpoint de conexão
app.post('/clients/:id/connect', async (req, res) => {
  const clientId = req.params.id;
  console.log(`🔗 [CONNECT] Iniciando conexão para ${clientId}`);

  try {
    // Se já existe cliente conectado
    if (clients[clientId]) {
      const currentStatus = clients[clientId].status;
      
      // Se já conectado, retornar status atual
      if (currentStatus === 'connected' && clients[clientId].phoneNumber) {
        console.log(`✅ [CONNECT] ${clientId} já conectado: ${clients[clientId].phoneNumber}`);
        return res.json({
          success: true,
          message: 'Cliente já conectado',
          status: 'connected',
          phoneNumber: clients[clientId].phoneNumber
        });
      }
      
      // Se conectando, retornar status atual
      if (['connecting', 'qr_ready', 'authenticated'].includes(currentStatus)) {
        console.log(`🔄 [CONNECT] ${clientId} já em processo: ${currentStatus}`);
        return res.json({
          success: true,
          message: `Cliente ${currentStatus}`,
          status: currentStatus
        });
      }
    }

    // Criar novo cliente
    console.log(`🚀 [CONNECT] Criando cliente ${clientId}`);
    
    const client = new Client({
      authStrategy: new LocalAuth({ clientId }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // Armazenar cliente
    clients[clientId] = client;
    clients[clientId].status = 'connecting';

    // Configurar eventos
    setupClientEvents(client, clientId);

    // Inicializar cliente
    client.initialize();

    // Atualizar banco
    await updateInstanceStatusInDB(clientId, 'connecting');

    res.json({
      success: true,
      message: 'Conexão iniciada',
      clientId,
      status: 'connecting'
    });

  } catch (error) {
    console.error(`❌ [CONNECT] Erro ${clientId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/clients/:id/disconnect', ensureClientExists, async (req, res) => {
  const clientId = req.params.id;

  try {
    await clients[clientId].logout();
    await clients[clientId].destroy();
    delete clients[clientId];

    res.json({
      success: true,
      message: 'Cliente desconectado'
    });
  } catch (error) {
    console.error('Erro ao desconectar cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desconectar cliente'
    });
  }
});

// WebSocket para atualizações em tempo real
io.on('connection', socket => {
  console.log('Novo cliente conectado via WebSocket');

  socket.on('join_client', clientId => {
    console.log(`Cliente ${socket.id} entrou na sala ${clientId}`);
    socket.join(`client_${clientId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado do WebSocket');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
