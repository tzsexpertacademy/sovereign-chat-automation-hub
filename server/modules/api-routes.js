// server/modules/api-routes.js - Todos os endpoints da API
const { 
  createWhatsAppInstance, 
  getClientStatus, 
  sendMessage, 
  sendMedia, 
  disconnectClient 
} = require('./whatsapp-client');
const { supabase } = require('./database');
const { mime } = require('./config');

// Configurar todas as rotas da API
function setupApiRoutes(app, io) {
  console.log('🛣️ Configurando rotas da API...');

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Verificar saúde do servidor
   *     tags: [Sistema]
   *     responses:
   *       200:
   *         description: Servidor funcionando
   */
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  /**
   * @swagger
   * /clients:
   *   get:
   *     summary: Listar todas as instâncias WhatsApp
   *     tags: [Instâncias]
   *     responses:
   *       200:
   *         description: Lista de instâncias
   */
  app.get('/clients', async (req, res) => {
    try {
      console.log('📋 Listando todas as instâncias...');
      
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Adicionar status dos clientes ativos
      const clientsWithStatus = instances.map(instance => {
        const clientStatus = getClientStatus(instance.instance_id);
        return {
          ...instance,
          clientId: instance.instance_id,
          clientActive: clientStatus.exists,
          clientState: clientStatus.state,
          isReady: clientStatus.isReady
        };
      });
      
      res.json({
        success: true,
        clients: clientsWithStatus
      });
      
    } catch (error) {
      console.error('❌ Erro ao listar instâncias:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /clients/{id}/connect:
   *   post:
   *     summary: Conectar instância WhatsApp
   *     tags: [Instâncias]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Instância conectada
   *       500:
   *         description: Erro ao conectar
   */
  app.post('/clients/:id/connect', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      console.log(`🔗 Conectando instância: ${instanceId}`);
      
      // Validar instanceId
      if (!instanceId || instanceId.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'ID da instância inválido',
          provided: instanceId
        });
      }
      
      // Verificar se instância existe no banco com retry
      let existingInstance = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const { data, error } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('instance_id', instanceId)
            .maybeSingle();
          
          if (error) {
            throw error;
          }
          
          existingInstance = data;
          break;
          
        } catch (dbError) {
          retryCount++;
          console.error(`❌ Tentativa ${retryCount} falhou para buscar instância ${instanceId}:`, dbError);
          
          if (retryCount >= maxRetries) {
            return res.status(500).json({
              success: false,
              error: 'Falha na conexão com banco de dados após múltiplas tentativas',
              details: dbError.message,
              instanceId
            });
          }
          
          // Aguardar antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      if (!existingInstance) {
        // Criar instância se não existir
        try {
          const { data, error } = await supabase
            .from('whatsapp_instances')
            .insert({
              instance_id: instanceId,
              client_id: instanceId.split('_')[0] || instanceId, // Extrair client_id do instanceId
              status: 'connecting'
            })
            .select()
            .single();
          
          if (error) {
            throw error;
          }
          
          console.log(`✅ Instância criada no banco: ${instanceId}`);
        } catch (insertError) {
          console.error(`❌ Erro ao criar instância ${instanceId}:`, insertError);
          return res.status(500).json({
            success: false,
            error: 'Falha ao criar instância no banco',
            details: insertError.message,
            instanceId
          });
        }
      }
      
      // Criar instância WhatsApp
      console.log(`🎯 Iniciando criação do cliente WhatsApp para: ${instanceId}`);
      const result = await createWhatsAppInstance(instanceId, io);
      
      if (!result.success) {
        console.error(`❌ Falha ao criar cliente WhatsApp ${instanceId}:`, result);
        return res.status(500).json({
          success: false,
          error: result.error || 'Falha ao criar cliente WhatsApp',
          details: result.details,
          type: result.type,
          instanceId
        });
      }
      
      console.log(`✅ Cliente WhatsApp criado com sucesso: ${instanceId}`);
      res.json({
        success: true,
        message: 'Instância conectada com sucesso',
        clientId: instanceId,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`💥 Erro crítico ao conectar instância ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.DEBUG ? error.stack : undefined,
        instanceId: req.params.id,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @swagger
   * /clients/{id}/disconnect:
   *   post:
   *     summary: Desconectar instância WhatsApp
   *     tags: [Instâncias]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Instância desconectada
   *       500:
   *         description: Erro ao desconectar
   */
  app.post('/clients/:id/disconnect', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
      const result = await disconnectClient(instanceId);
      
      res.json({
        success: true,
        message: 'Instância desconectada com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error(`❌ Erro ao desconectar instância ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /clients/{id}/status:
   *   get:
   *     summary: Obter status detalhado da instância
   *     tags: [Instâncias]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Status da instância
   *       404:
   *         description: Instância não encontrada
   */
  app.get('/clients/:id/status', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      console.log(`📊 Verificando status da instância: ${instanceId}`);
      
      // Buscar no banco
      const { data: dbInstance, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();
      
      if (error || !dbInstance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada'
        });
      }
      
      // Verificar status do cliente ativo
      const clientStatus = getClientStatus(instanceId);
      
      res.json({
        success: true,
        clientId: instanceId,
        status: dbInstance.status,
        phoneNumber: dbInstance.phone_number,
        hasQrCode: dbInstance.has_qr_code || false,
        qrCode: dbInstance.qr_code,
        qrExpiresAt: dbInstance.qr_expires_at,
        clientActive: clientStatus.exists,
        clientState: clientStatus.state,
        isReady: clientStatus.isReady
      });
      
    } catch (error) {
      console.error(`❌ Erro ao obter status da instância ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients:
   *   post:
   *     summary: Criar nova instância WhatsApp
   *     tags: [Instâncias]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               instanceId:
   *                 type: string
   *               clientId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Instância criada com sucesso
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro interno
   */
  app.post('/api/clients', async (req, res) => {
    try {
      const { instanceId, clientId } = req.body;
      
      if (!instanceId || !clientId) {
        return res.status(400).json({
          success: false,
          error: 'instanceId e clientId são obrigatórios'
        });
      }
      
      console.log(`📝 Criando instância: ${instanceId} para cliente: ${clientId}`);
      
      // Verificar se instância já existe no banco
      const { data: existingInstance } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();
      
      if (existingInstance) {
        return res.status(400).json({
          success: false,
          error: 'Instância já existe'
        });
      }
      
      // Criar registro no banco
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          instance_id: instanceId,
          client_id: clientId,
          status: 'initializing'
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Criar instância WhatsApp
      const result = await createWhatsAppInstance(instanceId, io);
      
      if (!result.success) {
        // Remover do banco se falhou
        await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('instance_id', instanceId);
        
        return res.status(500).json(result);
      }
      
      res.status(201).json({
        success: true,
        message: 'Instância criada com sucesso',
        data: { instanceId, clientId }
      });
      
    } catch (error) {
      console.error('❌ Erro ao criar instância:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}:
   *   get:
   *     summary: Obter status da instância
   *     tags: [Instâncias]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Status da instância
   *       404:
   *         description: Instância não encontrada
   */
  app.get('/api/clients/:id', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      // Buscar no banco
      const { data: dbInstance, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();
      
      if (error || !dbInstance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada'
        });
      }
      
      // Verificar status do cliente ativo
      const clientStatus = getClientStatus(instanceId);
      
      res.json({
        success: true,
        data: {
          ...dbInstance,
          clientActive: clientStatus.exists,
          clientState: clientStatus.state,
          isReady: clientStatus.isReady
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao obter status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}/send:
   *   post:
   *     summary: Enviar mensagem de texto
   *     tags: [Mensagens]
   *     parameters:
   *       - in: path
   *         name: id
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
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro ao enviar
   */
  app.post('/api/clients/:id/send', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'to e message são obrigatórios'
        });
      }
      
      console.log(`📤 Enviando mensagem de ${instanceId} para ${to}`);
      
      const result = await sendMessage(instanceId, to, message);
      
      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}/send-media:
   *   post:
   *     summary: Enviar arquivo de mídia
   *     tags: [Mensagens]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               to:
   *                 type: string
   *               caption:
   *                 type: string
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: Mídia enviada
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro ao enviar
   */
  app.post('/api/clients/:id/send-media', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      const { to, caption = '' } = req.body;
      
      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'Campo to é obrigatório'
        });
      }
      
      if (!req.files || !req.files.file) {
        return res.status(400).json({
          success: false,
          error: 'Arquivo é obrigatório'
        });
      }
      
      const file = req.files.file;
      console.log(`📤 Enviando mídia de ${instanceId} para ${to}:`, file.name);
      
      // Preparar mídia para envio
      const media = {
        data: file.data.toString('base64'),
        mimetype: file.mimetype,
        filename: file.name
      };
      
      const result = await sendMedia(instanceId, to, media, caption);
      
      res.json({
        success: true,
        message: 'Mídia enviada com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao enviar mídia:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}/logout:
   *   post:
   *     summary: Desconectar instância
   *     tags: [Instâncias]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Instância desconectada
   *       500:
   *         description: Erro ao desconectar
   */
  app.post('/api/clients/:id/logout', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
      const result = await disconnectClient(instanceId);
      
      res.json({
        success: true,
        message: 'Instância desconectada com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}/close:
   *   post:
   *     summary: Fechar instância completamente
   *     tags: [Instâncias]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Instância fechada
   *       500:
   *         description: Erro ao fechar
   */
  app.post('/api/clients/:id/close', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      console.log(`❌ Fechando instância: ${instanceId}`);
      
      // Desconectar cliente
      const result = await disconnectClient(instanceId);
      
      // Remover do banco de dados
      await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('instance_id', instanceId);
      
      res.json({
        success: true,
        message: 'Instância fechada e removida com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao fechar instância:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ===============================================
  // ENDPOINTS DE COMPATIBILIDADE (para não quebrar frontend antigo)
  // ===============================================
  
  /**
   * @swagger
   * /clients/{id}/send-message:
   *   post:
   *     summary: Enviar mensagem (compatibilidade)
   *     tags: [Compatibilidade]
   *     description: Endpoint de compatibilidade que redireciona para /api/clients/{id}/send
   */
  app.post('/clients/:id/send-message', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      const { to, message } = req.body;
      
      console.log(`📤 [COMPAT] Redirecionando send-message para /api/clients/${instanceId}/send`);
      
      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'to e message são obrigatórios'
        });
      }
      
      const result = await sendMessage(instanceId, to, message);
      
      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem (compat):', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}/chats:
   *   get:
   *     summary: Listar conversas do cliente
   *     tags: [Conversas]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Lista de conversas
   *       404:
   *         description: Cliente não encontrado
   */
  app.get('/api/clients/:id/chats', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      
      console.log(`💬 Buscando chats da instância: ${instanceId}`);
      
      // Buscar conversas no banco de dados
      const { data: tickets, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customers (
            name,
            phone,
            email
          )
        `)
        .eq('instance_id', instanceId)
        .order('last_message_at', { ascending: false })
        .limit(50);
      
      if (error) {
        throw error;
      }
      
      // Formatar resposta para o frontend
      const chats = (tickets || []).map(ticket => ({
        id: ticket.chat_id,
        name: ticket.customers?.name || 'Usuário',
        phone: ticket.customers?.phone || '',
        lastMessage: ticket.last_message_preview || '',
        lastMessageTime: ticket.last_message_at,
        unreadCount: 0, // TODO: implementar contagem de não lidas
        status: ticket.status
      }));
      
      res.json({
        success: true,
        chats: chats
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar chats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * @swagger
   * /clients/{id}/chats:
   *   get:
   *     summary: Listar conversas (compatibilidade)
   *     tags: [Compatibilidade]
   *     description: Endpoint de compatibilidade que redireciona para /api/clients/{id}/chats
   */
  app.get('/clients/:id/chats', async (req, res) => {
    try {
      const { id: instanceId } = req.params;
      console.log(`💬 [COMPAT] Redirecionando chats para /api/clients/${instanceId}/chats`);
      
      // Redirecionar para o endpoint API
      req.url = `/api/clients/${instanceId}/chats`;
      req.params.id = instanceId;
      
      // Chamar o handler do endpoint API
      const apiHandler = app._router.stack.find(layer => 
        layer.route && layer.route.path === '/api/clients/:id/chats'
      );
      
      if (apiHandler) {
        return apiHandler.route.stack[0].handle(req, res);
      } else {
        // Fallback: buscar chats diretamente
        const { data: tickets, error } = await supabase
          .from('conversation_tickets')
          .select(`
            *,
            customers (name, phone, email)
          `)
          .eq('instance_id', instanceId)
          .order('last_message_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        
        const chats = (tickets || []).map(ticket => ({
          id: ticket.chat_id,
          name: ticket.customers?.name || 'Usuário',
          phone: ticket.customers?.phone || '',
          lastMessage: ticket.last_message_preview || '',
          lastMessageTime: ticket.last_message_at,
          unreadCount: 0,
          status: ticket.status
        }));
        
        res.json({
          success: true,
          chats: chats
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar chats (compat):', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  console.log('✅ Rotas da API configuradas (incluindo compatibilidade)');
}

module.exports = {
  setupApiRoutes
};
