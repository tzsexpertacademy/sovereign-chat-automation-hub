
// server/modules/whatsapp-client.js - Lógica completa do WhatsApp
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
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

    // DIAGNÓSTICO DETALHADO - Verificar dependências do sistema
    console.log('🔍 [DIAGNÓSTICO] Verificando dependências do sistema...');
    
    // 1. Verificar Node.js e memória
    console.log(`🔧 Node.js versão: ${process.version}`);
    console.log(`💾 Memória usada: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log(`⚡ Uptime do processo: ${Math.round(process.uptime())} segundos`);
    
    // 2. Verificar espaço em disco
    try {
      const fs = require('fs');
      const stats = fs.statSync('/tmp');
      console.log(`💽 Diretório /tmp acessível: ${stats.isDirectory() ? 'SIM' : 'NÃO'}`);
    } catch (diskError) {
      console.warn(`⚠️ Problema com /tmp:`, diskError.message);
    }

    // 3. Verificar conexão com Supabase ANTES de inicializar Puppeteer
    console.log('🔍 [DIAGNÓSTICO] Testando conexão Supabase...');
    try {
      const { data, error } = await updateClientStatus(instanceId, 'initializing');
      if (error) {
        console.error(`❌ Falha na conexão Supabase para ${instanceId}:`, error);
        throw new Error(`Erro de conexão com banco de dados: ${error.message}`);
      }
      console.log(`✅ Conexão Supabase validada para ${instanceId}`);
    } catch (supabaseError) {
      console.error(`💥 Erro crítico Supabase para ${instanceId}:`, supabaseError);
      return { 
        success: false, 
        error: `Falha na conexão com banco: ${supabaseError.message}`,
        details: 'Verifique as credenciais do Supabase',
        type: 'DatabaseConnectionError'
      };
    }

    // Marcar como inicializando
    clientInitStates.set(instanceId, 'initializing');

    // 4. Configurar pasta de sessão COM VERIFICAÇÕES
    console.log('🔍 [DIAGNÓSTICO] Configurando pasta de sessão...');
    const sessionPath = path.join(__dirname, '..', 'sessions', instanceId);
    try {
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
        console.log(`📁 Pasta de sessão criada: ${sessionPath}`);
      } else {
        console.log(`📁 Pasta de sessão existente: ${sessionPath}`);
      }
      
      // Verificar permissões de escrita
      fs.accessSync(sessionPath, fs.constants.W_OK);
      console.log(`✅ Permissões de escrita OK: ${sessionPath}`);
    } catch (sessionError) {
      console.error(`❌ Erro na pasta de sessão:`, sessionError);
      return {
        success: false,
        error: 'Falha ao configurar pasta de sessão',
        details: sessionError.message,
        type: 'SessionDirectoryError'
      };
    }

    // 5. TESTE DE PUPPETEER ANTES DE CRIAR O CLIENTE
    console.log('🔍 [DIAGNÓSTICO] Testando disponibilidade do Puppeteer...');
    let puppeteerTest = null;
    try {
      // Tentar importar puppeteer para verificar se está disponível
      const puppeteer = require('puppeteer-core') || require('puppeteer');
      console.log('✅ Puppeteer disponível');
      
      // Verificar se pode encontrar o Chrome
      try {
        const executablePath = puppeteer.executablePath();
        console.log(`🌐 Chrome executável encontrado: ${executablePath}`);
      } catch (chromeError) {
        console.warn(`⚠️ Chrome não encontrado automaticamente:`, chromeError.message);
      }
    } catch (puppeteerError) {
      console.error(`❌ Puppeteer não disponível:`, puppeteerError);
      return {
        success: false,
        error: 'Puppeteer não está disponível no sistema',
        details: puppeteerError.message,
        type: 'PuppeteerUnavailableError'
      };
    }

    // 6. Criar cliente WhatsApp COM TIMEOUT E MELHOR TRATAMENTO
    console.log('🔍 [DIAGNÓSTICO] Criando cliente WhatsApp...');
    let client = null;
    try {
      client = new Client({
        authStrategy: new LocalAuth({
          clientId: instanceId,
          dataPath: sessionPath
        }),
        puppeteer: {
          headless: true,
          timeout: 120000, // ✅ Aumentar timeout para 120s
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-renderer-backgrounding',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--no-default-browser-check',
            '--no-first-run',
            '--disable-features=VizDisplayCompositor'
          ],
          timeout: 60000 // 60 segundos de timeout
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
      });
      console.log('✅ Cliente WhatsApp criado com sucesso');
    } catch (clientError) {
      console.error(`❌ Erro ao criar cliente WhatsApp:`, clientError);
      return {
        success: false,
        error: 'Falha ao criar cliente WhatsApp',
        details: clientError.message,
        type: 'ClientCreationError'
      };
    }

    // 7. Configurar event handlers
    console.log('🔍 [DIAGNÓSTICO] Configurando event handlers...');
    setupClientEventHandlers(client, instanceId, io);

    // 8. Armazenar cliente
    clients.set(instanceId, client);

    // 9. Inicializar cliente COM TIMEOUT ESTENDIDO E RETRY
    console.log('🔍 [DIAGNÓSTICO] Inicializando cliente (timeout estendido para 180s)...');
    const initStartTime = Date.now();
    
    // Configurar timeout de 180 segundos (3 minutos) para dar mais tempo
    const timeoutMs = 180000;
    let initAttempt = 0;
    const maxAttempts = 2;
    
    while (initAttempt < maxAttempts) {
      try {
        initAttempt++;
        console.log(`🔄 Tentativa ${initAttempt}/${maxAttempts} de inicialização...`);
        
        // Limpar cliente anterior se existir
        if (initAttempt > 1) {
          try {
            if (client) {
              await client.destroy();
            }
          } catch (cleanupError) {
            console.warn(`⚠️ Aviso na limpeza da tentativa ${initAttempt}:`, cleanupError.message);
          }
          
          // Recriar cliente para nova tentativa
          client = new Client({
            authStrategy: new LocalAuth({
              clientId: instanceId,
              dataPath: sessionPath
            }),
            puppeteer: {
              headless: true,
              timeout: 120000, // ✅ Aumentar timeout para 120s  
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', 
                '--disable-renderer-backgrounding',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--no-default-browser-check',
                '--disable-features=VizDisplayCompositor',
                '--user-data-dir=/tmp/chrome-user-data',
                '--disable-software-rasterizer'
              ],
              timeout: timeoutMs
            },
            webVersionCache: {
              type: 'remote',
              remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
          });
          
          // Reconfigurar event handlers
          setupClientEventHandlers(client, instanceId, io);
          clients.set(instanceId, client);
        }
        
        // Tentar inicializar com timeout estendido
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Timeout na inicialização do cliente (${timeoutMs/1000}s)`));
          }, timeoutMs);
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        
        const initTime = Date.now() - initStartTime;
        console.log(`✅ Cliente inicializado com sucesso em ${initTime}ms na tentativa ${initAttempt}`);
        break; // Sucesso, sair do loop
        
      } catch (initError) {
        console.error(`❌ Erro na tentativa ${initAttempt} de inicialização:`, initError);
        
        // Se for a última tentativa, retornar erro
        if (initAttempt >= maxAttempts) {
          // Limpar recursos em caso de falha final
          try {
            if (client) {
              await client.destroy();
            }
          } catch (cleanupError) {
            console.error(`❌ Erro na limpeza final:`, cleanupError);
          }
          
          clients.delete(instanceId);
          clientInitStates.delete(instanceId);
          
          return {
            success: false,
            error: 'Falha na inicialização do cliente WhatsApp após múltiplas tentativas',
            details: `Tentativa ${initAttempt}: ${initError.message}`,
            type: 'ClientInitializationError',
            initTime: Date.now() - initStartTime,
            attempts: initAttempt
          };
        }
        
        // Aguardar antes da próxima tentativa
        console.log(`⏳ Aguardando 5s antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`✅ Instância ${instanceId} criada com sucesso`);
    return { success: true, message: 'Instância criada com sucesso' };

  } catch (error) {
    console.error(`💥 Erro ao criar instância ${instanceId}:`, error);
    clientInitStates.delete(instanceId);
    clients.delete(instanceId);
    
    // Tentar atualizar status com retry
    try {
      await updateClientStatus(instanceId, 'error');
    } catch (dbError) {
      console.error(`❌ Falha adicional ao atualizar status para ${instanceId}:`, dbError);
    }
    
    return { 
      success: false, 
      error: error.message,
      type: error.name || 'UnknownError',
      instanceId
    };
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
      
      // Emitir via WebSocket - MÚLTIPLOS EVENTOS PARA COMPATIBILIDADE
      io.emit('qr_updated', {
        instanceId,
        qrCode: qrCodeDataURL,
        expiresAt
      });
      
      // Evento específico da instância
      io.emit(`client_status_${instanceId}`, {
        instanceId,
        status: 'qr_ready',
        qrCode: qrCodeDataURL,
        hasQrCode: true,
        qrTimestamp: expiresAt
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
      
      // Emitir status via WebSocket - MÚLTIPLOS EVENTOS
      io.emit('client_ready', {
        instanceId,
        phoneNumber,
        status: 'connected'
      });
      
      // Evento específico da instância
      io.emit(`client_status_${instanceId}`, {
        instanceId,
        status: 'connected',
        phoneNumber,
        hasQrCode: false,
        qrCode: null
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
    return { exists: false, state: null, client: null };
  }
  
  return {
    exists: true,
    state: initState || 'unknown',
    isReady: initState === 'ready',
    client: client
  };
}

// Função para enviar áudio com whatsapp-web.js v1.25.0+ APIs corretas
async function sendAudio(instanceId, to, audioFile) {
  try {
    console.log('🎵 ===== CORREÇÃO DEFINITIVA - APIs CORRETAS =====');
    console.log('🎵 sendAudio() - APIs corretas whatsapp-web.js v1.25.0+');
    const client = clients.get(instanceId);
    
    if (!client) {
      throw new Error('Cliente não encontrado');
    }
    
    if (clientInitStates.get(instanceId) !== 'ready') {
      throw new Error('Cliente não está pronto');
    }

    let result;
    
    if (typeof audioFile === 'string') {
      // ✅ CORREÇÃO DEFINITIVA: Usar método do audioSendService.js que funciona
      console.log('🎵 Usando MessageMedia + sendAudioAsVoice (método comprovado)');
      console.log('📂 Caminho do arquivo:', audioFile);
      
      // ✅ CORREÇÃO 1: Validar se arquivo existe
      if (!fs.existsSync(audioFile)) {
        throw new Error(`Arquivo não encontrado: ${audioFile}`);
      }
      
      // ✅ CORREÇÃO 2: Verificar tamanho do arquivo
      const stats = fs.statSync(audioFile);
      console.log('📊 Tamanho do arquivo:', stats.size, 'bytes');
      
      if (stats.size === 0) {
        throw new Error('Arquivo está vazio');
      }
      
      // ✅ MÉTODO DEFINITIVO: Igual audioSendService.js (comprovadamente funcional)
      const audioBuffer = fs.readFileSync(audioFile);
      const base64Data = audioBuffer.toString('base64');
      const fileName = path.basename(audioFile);
      
      console.log('🎵 Criando MessageMedia com base64...');
      const media = new MessageMedia('audio/ogg', base64Data, fileName);
      
      console.log('🎵 Enviando com sendAudioAsVoice: true (chave do sucesso)');
      result = await client.sendMessage(to, media, {
        sendAudioAsVoice: true  // 🎵 ISTO FAZ O ÁUDIO CHEGAR COMO MENSAGEM DE VOZ
      });
      
      console.log('✅ ÁUDIO ENVIADO COMO VOZ! ID:', result?.id?.id || result?.id || 'sem-id');
      
    } else if (audioFile instanceof File || audioFile.data) {
      // ✅ CORREÇÃO DEFINITIVA: Usar MessageMedia também para File objects 
      console.log('🎵 Enviando File object via MessageMedia + sendAudioAsVoice');
      
      const base64Data = audioFile.data || await fileToBase64NodeJS(audioFile);
      const fileName = audioFile.name || 'audio.ogg';
      
      console.log('🎵 Criando MessageMedia para File object...');
      const media = new MessageMedia('audio/ogg', base64Data, fileName);
      
      console.log('🎵 Enviando File object com sendAudioAsVoice: true');
      result = await client.sendMessage(to, media, {
        sendAudioAsVoice: true  // 🎵 ISTO FAZ O ÁUDIO CHEGAR COMO MENSAGEM DE VOZ
      });
      
      console.log('✅ ÁUDIO ENVIADO COMO VOZ! ID:', result?.id?.id || result?.id || 'sem-id');
    } else {
      throw new Error('Formato de arquivo não suportado');
    }
    
    console.log('✅ Sucesso real - ID da mensagem:', result.id._serialized);
    console.log('✅ Áudio enviado via APIs corretas v1.25.0+');
    return { success: true, messageId: result.id._serialized };
    
  } catch (error) {
    console.error(`❌ Erro ao enviar áudio ${instanceId}:`, error);
    console.error('❌ Stack do erro:', error.stack);
    throw error;
  }
}

// ✅ CORREÇÃO 5: Helper Node.js para converter arquivo para base64
async function fileToBase64NodeJS(file) {
  try {
    if (typeof file === 'string') {
      // É um caminho de arquivo
      const fileData = fs.readFileSync(file);
      return fileData.toString('base64');
    } else if (file.path) {
      // Objeto File com path
      const fileData = fs.readFileSync(file.path);
      return fileData.toString('base64');
    } else {
      throw new Error('Formato de arquivo não suportado para conversão base64');
    }
  } catch (error) {
    console.error('❌ Erro na conversão base64:', error);
    throw error;
  }
}

// ✅ CORREÇÃO DEFINITIVA: Método direto sem MessageMedia
async function sendAudioDirect(instanceId, to, audioPath) {
  console.log('🎵 ===== CORREÇÃO DEFINITIVA - MÉTODO DIRETO =====');
  console.log('🔧 Usando client.sendMessage() com buffer - SEM MessageMedia');
  
  try {
    const client = clients[instanceId];
    if (!client) {
      throw new Error(`Cliente não encontrado: ${instanceId}`);
    }

    // Ler arquivo como buffer
    const audioBuffer = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);
    
    console.log('📦 Enviando buffer direto...', {
      bufferSize: audioBuffer.length,
      fileName: fileName,
      to: to
    });

    // MÉTODO DIRETO: apenas buffer + tipo de mensagem
    const result = await client.sendMessage(to, {
      body: audioBuffer,
      type: 'audio',
      mimetype: 'audio/ogg',
      filename: fileName
    });

    console.log('✅ SUCESSO MÉTODO DIRETO! ID:', result?.id?._serialized || result?.id || 'direto-ok');
    
    return { 
      success: true, 
      messageId: result?.id?._serialized || result?.id || 'direto-success',
      method: 'buffer-direct'
    };
    
  } catch (error) {
    console.error('❌ Erro método direto:', error);
    throw error;
  }
}

module.exports = {
  clients,
  clientInitStates,
  generateQRCode,
  createWhatsAppInstance,
  sendMessage,
  sendMedia,
  sendAudio,  // ✅ Nova função para áudio
  sendAudioDirect,  // ✅ CORREÇÃO DEFINITIVA
  disconnectClient,
  getClientStatus,
  syncInitialChats
};
