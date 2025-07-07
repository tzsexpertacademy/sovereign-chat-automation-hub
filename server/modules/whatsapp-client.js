
// server/modules/whatsapp-client.js - WhatsApp Client CORRIGIDO E ROBUSTO
const { Client, LocalAuth } = require('whatsapp-web.js');
const { QRCode, fs, path } = require('./config');
const { updateClientStatus, saveMessageToSupabase, syncChatToSupabase } = require('./database');

// Armazenamento de clientes WhatsApp
const clients = new Map();
const clientInitStates = new Map();
const clientRetries = new Map();

// Configurações de retry
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// Logging aprimorado
function logWithContext(level, instanceId, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${instanceId}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

// Função para gerar QR Code com validação
async function generateQRCode(qrString) {
  try {
    if (!qrString || typeof qrString !== 'string') {
      throw new Error('QR string inválida');
    }
    
    const qrCodeDataURL = await QRCode.toDataURL(qrString, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('❌ Erro ao gerar QR Code:', error);
    throw new Error(`Falha ao gerar QR Code: ${error.message}`);
  }
}

// Função para validar instância antes de criar
function validateInstanceCreation(instanceId, io) {
  if (!instanceId || typeof instanceId !== 'string') {
    throw new Error('instanceId deve ser uma string válida');
  }
  
  if (!io) {
    throw new Error('Socket.IO não fornecido');
  }
  
  if (clients.has(instanceId)) {
    throw new Error(`Cliente ${instanceId} já existe`);
  }
  
  return true;
}

// Função para configurar pasta de sessão
function setupSessionPath(instanceId) {
  const sessionPath = path.join(__dirname, '..', 'sessions', instanceId);
  
  try {
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      logWithContext('info', instanceId, `Pasta de sessão criada: ${sessionPath}`);
    }
    return sessionPath;
  } catch (error) {
    logWithContext('error', instanceId, 'Erro ao configurar pasta de sessão', error);
    throw new Error(`Falha ao configurar sessão: ${error.message}`);
  }
}

// Função principal para criar instância do WhatsApp - CORRIGIDA
async function createWhatsAppInstance(instanceId, io) {
  const startTime = Date.now();
  
  try {
    logWithContext('info', instanceId, '🚀 Iniciando criação de instância WhatsApp');
    
    // Validações iniciais
    validateInstanceCreation(instanceId, io);
    
    // Marcar como inicializando
    clientInitStates.set(instanceId, 'initializing');
    await updateClientStatus(instanceId, 'initializing');

    // Configurar pasta de sessão
    const sessionPath = setupSessionPath(instanceId);

    // Configuração Puppeteer otimizada
    const puppeteerConfig = {
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
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off'
      ],
      timeout: 60000
    };

    // Criar cliente WhatsApp
    logWithContext('info', instanceId, '🔧 Criando cliente WhatsApp...');
    
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: instanceId,
        dataPath: sessionPath
      }),
      puppeteer: puppeteerConfig,
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
      ffmpegPath: null // Desabilitar ffmpeg se não disponível
    });

    // Configurar event handlers
    setupClientEventHandlers(client, instanceId, io);

    // Armazenar cliente
    clients.set(instanceId, client);
    clientRetries.set(instanceId, 0);

    // Inicializar cliente com timeout
    logWithContext('info', instanceId, '⚡ Inicializando cliente...');
    
    const initPromise = client.initialize();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout na inicialização')), 120000); // 2 minutos
    });

    await Promise.race([initPromise, timeoutPromise]);

    const elapsedTime = Date.now() - startTime;
    logWithContext('success', instanceId, `✅ Instância criada com sucesso em ${elapsedTime}ms`);

    return { 
      success: true, 
      message: 'Instância criada com sucesso', 
      instanceId,
      elapsedTime 
    };

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    logWithContext('error', instanceId, `💥 Erro ao criar instância (${elapsedTime}ms)`, error);
    
    // Limpeza em caso de erro
    cleanupFailedInstance(instanceId);
    
    // Tentar retry se não excedeu o limite
    const retryCount = clientRetries.get(instanceId) || 0;
    if (retryCount < MAX_RETRIES) {
      logWithContext('warn', instanceId, `🔄 Tentativa ${retryCount + 1}/${MAX_RETRIES} em ${RETRY_DELAY}ms`);
      clientRetries.set(instanceId, retryCount + 1);
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return createWhatsAppInstance(instanceId, io);
    }
    
    await updateClientStatus(instanceId, 'error');
    
    return { 
      success: false, 
      error: error.message,
      instanceId,
      elapsedTime,
      retries: retryCount
    };
  }
}

// Função para limpeza de instância falhada
function cleanupFailedInstance(instanceId) {
  try {
    clientInitStates.delete(instanceId);
    
    if (clients.has(instanceId)) {
      const client = clients.get(instanceId);
      client.destroy().catch(() => {}); // Ignorar erros de destruição
      clients.delete(instanceId);
    }
    
    logWithContext('info', instanceId, '🧹 Limpeza de instância falhada concluída');
  } catch (error) {
    logWithContext('warn', instanceId, 'Erro na limpeza', error);
  }
}

// Configurar event handlers do cliente - MELHORADOS
function setupClientEventHandlers(client, instanceId, io) {
  // QR Code gerado
  client.on('qr', async (qr) => {
    try {
      logWithContext('info', instanceId, '📱 QR Code gerado');
      
      const qrCodeDataURL = await generateQRCode(qr);
      const expiresAt = new Date(Date.now() + 45000).toISOString(); // 45 segundos
      
      await updateClientStatus(instanceId, 'qr_ready', null, qrCodeDataURL, true, expiresAt);
      
      // Emitir via WebSocket
      io.emit('qr_updated', {
        instanceId,
        qrCode: qrCodeDataURL,
        expiresAt,
        timestamp: new Date().toISOString()
      });
      
      logWithContext('success', instanceId, '✅ QR Code processado e enviado');
    } catch (error) {
      logWithContext('error', instanceId, 'Erro ao processar QR', error);
    }
  });

  // Cliente pronto
  client.on('ready', async () => {
    try {
      logWithContext('success', instanceId, '✅ Cliente conectado e pronto!');
      
      const clientInfo = client.info;
      const phoneNumber = clientInfo.wid.user;
      
      await updateClientStatus(instanceId, 'connected', phoneNumber, null, false, null);
      clientInitStates.set(instanceId, 'ready');
      clientRetries.delete(instanceId); // Limpar contadores de retry
      
      // Emitir status via WebSocket
      io.emit('client_ready', {
        instanceId,
        phoneNumber,
        status: 'connected',
        timestamp: new Date().toISOString()
      });
      
      // Sincronizar chats iniciais (não bloqueante)
      syncInitialChats(client, instanceId).catch(error => {
        logWithContext('warn', instanceId, 'Erro na sincronização de chats', error);
      });
      
    } catch (error) {
      logWithContext('error', instanceId, 'Erro ao processar cliente pronto', error);
    }
  });

  // Cliente autenticado
  client.on('authenticated', async () => {
    logWithContext('info', instanceId, '🔐 Cliente autenticado');
    await updateClientStatus(instanceId, 'authenticated');
    clientInitStates.set(instanceId, 'authenticated');
  });

  // Falha na autenticação
  client.on('auth_failure', async (msg) => {
    logWithContext('error', instanceId, 'Falha na autenticação', msg);
    await updateClientStatus(instanceId, 'auth_failed');
    cleanupFailedInstance(instanceId);
  });

  // Cliente desconectado
  client.on('disconnected', async (reason) => {
    logWithContext('warn', instanceId, 'Cliente desconectado', reason);
    await updateClientStatus(instanceId, 'disconnected');
    clientInitStates.delete(instanceId);
    
    // Emitir via WebSocket
    io.emit('client_disconnected', {
      instanceId,
      reason,
      timestamp: new Date().toISOString()
    });
  });

  // Nova mensagem recebida
  client.on('message', async (message) => {
    try {
      logWithContext('info', instanceId, `📨 Nova mensagem de ${message.from}`);
      
      // Salvar mensagem (não bloqueante)
      saveMessageToSupabase(instanceId, message.from, {
        id: message.id.id,
        body: message.body,
        fromMe: message.fromMe,
        from: message.from,
        timestamp: message.timestamp,
        type: message.type
      }).catch(error => {
        logWithContext('warn', instanceId, 'Erro ao salvar mensagem', error);
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
      logWithContext('error', instanceId, 'Erro ao processar mensagem', error);
    }
  });

  // Mudança de estado
  client.on('change_state', (state) => {
    logWithContext('info', instanceId, `🔄 Estado alterado: ${state}`);
  });

  // Eventos de erro
  client.on('loading_screen', (percent, message) => {
    logWithContext('info', instanceId, `⏳ Carregando ${percent}%: ${message}`);
  });
}

// Sincronizar chats iniciais - OTIMIZADA
async function syncInitialChats(client, instanceId) {
  try {
    logWithContext('info', instanceId, '🔄 Iniciando sincronização de chats...');
    
    const chats = await client.getChats();
    logWithContext('info', instanceId, `📊 Encontrados ${chats.length} chats para sincronização`);
    
    // Sincronizar até 20 chats mais recentes (reduzido para performance)
    const recentChats = chats.slice(0, 20);
    
    for (const chat of recentChats) {
      try {
        await syncChatToSupabase(instanceId, chat);
      } catch (error) {
        logWithContext('warn', instanceId, `Erro ao sincronizar chat ${chat.id._serialized}`, error);
        // Continuar com próximo chat
      }
    }
    
    logWithContext('success', instanceId, `✅ Sincronização concluída: ${recentChats.length} chats`);
  } catch (error) {
    logWithContext('error', instanceId, 'Erro na sincronização de chats', error);
  }
}

// Função para enviar mensagem - MELHORADA
async function sendMessage(instanceId, to, message) {
  try {
    const client = clients.get(instanceId);
    
    if (!client) {
      throw new Error('Cliente não encontrado');
    }
    
    const clientState = clientInitStates.get(instanceId);
    if (clientState !== 'ready') {
      throw new Error(`Cliente não está pronto. Estado atual: ${clientState}`);
    }
    
    logWithContext('info', instanceId, `📤 Enviando mensagem para ${to}`);
    
    const result = await client.sendMessage(to, message);
    
    logWithContext('success', instanceId, `✅ Mensagem enviada para ${to}`);
    
    return { success: true, messageId: result.id.id };
  } catch (error) {
    logWithContext('error', instanceId, 'Erro ao enviar mensagem', error);
    throw error;
  }
}

// Função para enviar mídia - MELHORADA
async function sendMedia(instanceId, to, media, caption = '') {
  try {
    const client = clients.get(instanceId);
    
    if (!client) {
      throw new Error('Cliente não encontrado');
    }
    
    const clientState = clientInitStates.get(instanceId);
    if (clientState !== 'ready') {
      throw new Error(`Cliente não está pronto. Estado atual: ${clientState}`);
    }
    
    logWithContext('info', instanceId, `📤 Enviando mídia para ${to}`);
    
    const result = await client.sendMessage(to, media, { caption });
    
    logWithContext('success', instanceId, `✅ Mídia enviada para ${to}`);
    
    return { success: true, messageId: result.id.id };
  } catch (error) {
    logWithContext('error', instanceId, 'Erro ao enviar mídia', error);
    throw error;
  }
}

// Função para desconectar cliente - MELHORADA
async function disconnectClient(instanceId) {
  try {
    logWithContext('info', instanceId, '🔌 Iniciando desconexão...');
    
    const client = clients.get(instanceId);
    
    if (client) {
      await client.logout();
      await client.destroy();
      clients.delete(instanceId);
      clientInitStates.delete(instanceId);
      clientRetries.delete(instanceId);
      
      await updateClientStatus(instanceId, 'disconnected');
      
      logWithContext('success', instanceId, '✅ Cliente desconectado com sucesso');
      return { success: true };
    }
    
    return { success: false, message: 'Cliente não encontrado' };
  } catch (error) {
    logWithContext('error', instanceId, 'Erro ao desconectar', error);
    return { success: false, error: error.message };
  }
}

// Função para obter status do cliente - MELHORADA
function getClientStatus(instanceId) {
  const client = clients.get(instanceId);
  const initState = clientInitStates.get(instanceId);
  const retryCount = clientRetries.get(instanceId) || 0;
  
  if (!client) {
    return { 
      exists: false, 
      state: null,
      isReady: false,
      retries: retryCount
    };
  }
  
  return {
    exists: true,
    state: initState || 'unknown',
    isReady: initState === 'ready',
    retries: retryCount
  };
}

// Função para obter estatísticas do sistema
function getSystemStats() {
  return {
    totalClients: clients.size,
    readyClients: Array.from(clientInitStates.values()).filter(state => state === 'ready').length,
    initializingClients: Array.from(clientInitStates.values()).filter(state => state === 'initializing').length,
    clientStates: Object.fromEntries(clientInitStates),
    memoryUsage: process.memoryUsage()
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
  syncInitialChats,
  getSystemStats,
  logWithContext
};
