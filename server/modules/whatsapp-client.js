
// server/modules/whatsapp-client.js - Lógica completa do WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js');
const { QRCode, fs, path } = require('./config');
const { updateClientStatus, saveMessageToSupabase, syncChatToSupabase } = require('./database');

// Armazenamento de clientes WhatsApp
const clients = new Map();

// Estados de inicialização dos clientes
const clientInitStates = new Map();

// Função para gerar QR Code
async function generateQRCode(qrString) {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrString, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('❌ Erro ao gerar QR Code:', error);
    throw error;
  }
}

// Função para criar instância do WhatsApp
async function createWhatsAppInstance(instanceId, io) {
  try {
    console.log(`🚀 Criando instância WhatsApp: ${instanceId}`);
    
    // Verificar se cliente já existe
    if (clients.has(instanceId)) {
      console.log(`⚠️ Cliente ${instanceId} já existe`);
      return { success: false, message: 'Cliente já existe' };
    }

    // Marcar como inicializando
    clientInitStates.set(instanceId, 'initializing');

    // Configurar pasta de sessão
    const sessionPath = path.join(__dirname, '..', 'sessions', instanceId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Criar cliente WhatsApp
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: instanceId,
        dataPath: sessionPath
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
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      }
    });

    // Event Handlers
    setupClientEventHandlers(client, instanceId, io);

    // Armazenar cliente
    clients.set(instanceId, client);

    // Inicializar cliente
    await client.initialize();

    console.log(`✅ Instância ${instanceId} criada com sucesso`);
    return { success: true, message: 'Instância criada com sucesso' };

  } catch (error) {
    console.error(`💥 Erro ao criar instância ${instanceId}:`, error);
    clientInitStates.delete(instanceId);
    clients.delete(instanceId);
    
    await updateClientStatus(instanceId, 'error');
    
    return { success: false, error: error.message };
  }
}

// Configurar event handlers do cliente
function setupClientEventHandlers(client, instanceId, io) {
  // QR Code gerado
  client.on('qr', async (qr) => {
    try {
      console.log(`📱 QR Code gerado para ${instanceId}`);
      
      const qrCodeDataURL = await generateQRCode(qr);
      const expiresAt = new Date(Date.now() + 45000).toISOString(); // 45 segundos
      
      await updateClientStatus(instanceId, 'qr_ready', null, qrCodeDataURL, true, expiresAt);
      
      // Emitir via WebSocket
      io.emit('qr_updated', {
        instanceId,
        qrCode: qrCodeDataURL,
        expiresAt
      });
      
      console.log(`✅ QR Code salvo para ${instanceId}`);
    } catch (error) {
      console.error(`❌ Erro ao processar QR para ${instanceId}:`, error);
    }
  });

  // Cliente pronto
  client.on('ready', async () => {
    try {
      console.log(`✅ Cliente ${instanceId} conectado e pronto!`);
      
      const clientInfo = client.info;
      const phoneNumber = clientInfo.wid.user;
      
      await updateClientStatus(instanceId, 'connected', phoneNumber, null, false, null);
      clientInitStates.set(instanceId, 'ready');
      
      // Emitir status via WebSocket
      io.emit('client_ready', {
        instanceId,
        phoneNumber,
        status: 'connected'
      });
      
      // Sincronizar chats iniciais
      await syncInitialChats(client, instanceId);
      
    } catch (error) {
      console.error(`❌ Erro ao processar cliente pronto ${instanceId}:`, error);
    }
  });

  // Cliente autenticado
  client.on('authenticated', async () => {
    console.log(`🔐 Cliente ${instanceId} autenticado`);
    await updateClientStatus(instanceId, 'authenticated');
    clientInitStates.set(instanceId, 'authenticated');
  });

  // Falha na autenticação
  client.on('auth_failure', async (msg) => {
    console.error(`❌ Falha na autenticação ${instanceId}:`, msg);
    await updateClientStatus(instanceId, 'auth_failed');
    clientInitStates.delete(instanceId);
  });

  // Cliente desconectado
  client.on('disconnected', async (reason) => {
    console.log(`⚠️ Cliente ${instanceId} desconectado:`, reason);
    await updateClientStatus(instanceId, 'disconnected');
    clientInitStates.delete(instanceId);
    
    // Emitir via WebSocket
    io.emit('client_disconnected', {
      instanceId,
      reason
    });
  });

  // Nova mensagem recebida
  client.on('message', async (message) => {
    try {
      console.log(`📨 Nova mensagem em ${instanceId}: ${message.from}`);
      
      // Salvar mensagem
      await saveMessageToSupabase(instanceId, message.from, {
        id: message.id.id,
        body: message.body,
        fromMe: message.fromMe,
        from: message.from,
        timestamp: message.timestamp,
        type: message.type
      });
      
      // Emitir via WebSocket
      io.emit('new_message', {
        instanceId,
        chatId: message.from,
        message: {
          id: message.id.id,
          body: message.body,
          fromMe: message.fromMe,
          timestamp: message.timestamp,
          type: message.type
        }
      });
      
    } catch (error) {
      console.error(`❌ Erro ao processar mensagem ${instanceId}:`, error);
    }
  });

  // Mudança de estado
  client.on('change_state', (state) => {
    console.log(`🔄 Estado alterado ${instanceId}:`, state);
  });
}

// Sincronizar chats iniciais
async function syncInitialChats(client, instanceId) {
  try {
    console.log(`🔄 Sincronizando chats iniciais para ${instanceId}...`);
    
    const chats = await client.getChats();
    console.log(`📊 Encontrados ${chats.length} chats para sincronização`);
    
    // Sincronizar até 50 chats mais recentes
    const recentChats = chats.slice(0, 50);
    
    for (const chat of recentChats) {
      await syncChatToSupabase(instanceId, chat);
    }
    
    console.log(`✅ Sincronização de chats concluída para ${instanceId}`);
  } catch (error) {
    console.error(`❌ Erro na sincronização de chats ${instanceId}:`, error);
  }
}

// Função para enviar mensagem
async function sendMessage(instanceId, to, message) {
  try {
    const client = clients.get(instanceId);
    
    if (!client) {
      throw new Error('Cliente não encontrado');
    }
    
    if (clientInitStates.get(instanceId) !== 'ready') {
      throw new Error('Cliente não está pronto');
    }
    
    const result = await client.sendMessage(to, message);
    console.log(`✅ Mensagem enviada de ${instanceId} para ${to}`);
    
    return { success: true, messageId: result.id.id };
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem ${instanceId}:`, error);
    throw error;
  }
}

// Função para enviar mídia
async function sendMedia(instanceId, to, media, caption = '') {
  try {
    const client = clients.get(instanceId);
    
    if (!client) {
      throw new Error('Cliente não encontrado');
    }
    
    if (clientInitStates.get(instanceId) !== 'ready') {
      throw new Error('Cliente não está pronto');
    }
    
    const result = await client.sendMessage(to, media, { caption });
    console.log(`✅ Mídia enviada de ${instanceId} para ${to}`);
    
    return { success: true, messageId: result.id.id };
  } catch (error) {
    console.error(`❌ Erro ao enviar mídia ${instanceId}:`, error);
    throw error;
  }
}

// Função para desconectar cliente
async function disconnectClient(instanceId) {
  try {
    const client = clients.get(instanceId);
    
    if (client) {
      await client.logout();
      await client.destroy();
      clients.delete(instanceId);
      clientInitStates.delete(instanceId);
      
      await updateClientStatus(instanceId, 'disconnected');
      
      console.log(`✅ Cliente ${instanceId} desconectado`);
      return { success: true };
    }
    
    return { success: false, message: 'Cliente não encontrado' };
  } catch (error) {
    console.error(`❌ Erro ao desconectar ${instanceId}:`, error);
    return { success: false, error: error.message };
  }
}

// Função para obter status do cliente
function getClientStatus(instanceId) {
  const client = clients.get(instanceId);
  const initState = clientInitStates.get(instanceId);
  
  if (!client) {
    return { exists: false, state: null };
  }
  
  return {
    exists: true,
    state: initState || 'unknown',
    isReady: initState === 'ready'
  };
}

module.exports = {
  clients,
  clientInitStates,
  generateQRCode,
  createWhatsAppInstance,
  sendMessage,
  sendMedia,
  disconnectClient,
  getClientStatus,
  syncInitialChats
};
