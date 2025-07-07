
// server/modules/api-routes.js - API Routes COMPLETA E CORRIGIDA
const { 
  createWhatsAppInstance, 
  getClientStatus, 
  sendMessage, 
  sendMedia, 
  disconnectClient,
  getSystemStats
} = require('./whatsapp-client');
const { supabase } = require('./database');
const { mime } = require('./config');

// Configurar todas as rotas da API
function setupApiRoutes(app, io) {
  console.log('🛣️ Configurando rotas da API CORRIGIDAS...');

  // Middleware de logging para debugging
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });

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
    const stats = getSystemStats();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      server: 'modular-corrected',
      stats
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
      console.log('📋 [API] Listando todas as instâncias...');
      
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
          isReady: clientStatus.isReady,
          retries: clientStatus.retries
        };
      });
      
      console.log(`✅ [API] Retornando ${clientsWithStatus.length} instâncias`);
      
      res.json({
        success: true,
        clients: clientsWithStatus,
        total: clientsWithStatus.length,
        stats: getSystemStats()
      });
      
    } catch (error) {
      console.error('❌ [API] Erro ao listar instâncias:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
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
    const startTime = Date.now();
    
    try {
      const { id: instanceId } = req.params;
      
      console.log(`🔗 [API] Conectando instância: ${instanceId}`);
      
      // Verificar se instância existe no banco
      const { data: existingInstance, error: selectError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();
      
      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }
      
      if (!existingInstance) {
        // Criar instância se não existir
        console.log(`📝 [API] Criando registro para instância: ${instanceId}`);
        
        const { data, error } = await supabase
          .from('whatsapp_instances')
          .insert({
            instance_id: instanceId,
            client_id: instanceId.split('_')[0], // Extrair client_id do instanceId
            status: 'connecting'
          })
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        console.log(`✅ [API] Registro criado para: ${instanceId}`);
      } else {
        // Atualizar status para connecting
        await supabase
          .from('whatsapp_instances')
          .update({ status: 'connecting', updated_at: new Date().toISOString() })
          .eq('instance_id', instanceId);
      }
      
      // Criar instância WhatsApp
      console.log(`🚀 [API] Criando instância WhatsApp: ${instanceId}`);
      const result = await createWhatsAppInstance(instanceId, io);
      
      const elapsedTime = Date.now() - startTime;
      
      if (!result.success) {
        console.error(`❌ [API] Falha ao criar instância ${instanceId}:`, result);
        return res.status(500).json({
          success: false,
          error: result.error,
          instanceId,
          elapsedTime,
          retries: result.retries || 0
        });
      }
      
      console.log(`✅ [API] Instância conectada: ${instanceId} (${elapsedTime}ms)`);
      
      res.json({
        success: true,
        message: 'Instância conectada com sucesso',
        clientId: instanceId,
        instanceId,
        elapsedTime,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`❌ [API] Erro ao conectar instância ${req.params.id}:`, error);
      
      res.status(500).json({
        success: false,
        error: error.message,
        instanceId: req.params.id,
        elapsedTime,
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
      
      console.log(`🔌 [API] Desconectando instância: ${instanceId}`);
      
      const result = await disconnectClient(instanceId);
      
      // Atualizar banco de dados
      await supabase
        .from('whatsapp_instances')
        .update({ 
          status: 'disconnected', 
          updated_at: new Date().toISOString(),
          qr_code: null,
          has_qr_code: false,
          qr_expires_at: null
        })
        .eq('instance_id', instanceId);
      
      console.log(`✅ [API] Instância desconectada: ${instanceId}`);
      
      res.json({
        success: true,
        message: 'Instância desconectada com sucesso',
        data: result,
        instanceId,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ [API] Erro ao desconectar instância ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        instanceId: req.params.id,
        timestamp: new Date().toISOString()
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
      
      console.log(`📊 [API] Verificando status da instância: ${instanceId}`);
      
      // Buscar no banco
      const { data: dbInstance, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (!dbInstance) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada',
          instanceId
        });
      }
      
      // Verificar status do cliente ativo
      const clientStatus = getClientStatus(instanceId);
      
      const response = {
        success: true,
        clientId: instanceId,
        instanceId,
        status: dbInstance.status,
        phoneNumber: dbInstance.phone_number,
        hasQrCode: dbInstance.has_qr_code || false,
        qrCode: dbInstance.qr_code,
        qrExpiresAt: dbInstance.qr_expires_at,
        clientActive: clientStatus.exists,
        clientState: clientStatus.state,
        isReady: clientStatus.isReady,
        retries: clientStatus.retries,
        customName: dbInstance.custom_name,
        createdAt: dbInstance.created_at,
        updatedAt: dbInstance.updated_at,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ [API] Status obtido para ${instanceId}:`, {
        status: response.status,
        hasQrCode: response.hasQrCode,
        clientActive: response.clientActive
      });
      
      res.json(response);
      
    } catch (error) {
      console.error(`❌ [API] Erro ao obter status da instância ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        instanceId: req.params.id,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Endpoints de API RESTful adicionais

  /**
   * @swagger
   * /api/clients:
   *   post:
   *     summary: Criar nova instância WhatsApp
   *     tags: [Instâncias]
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
      
      console.log(`📝 [API] Criando instância: ${instanceId} para cliente: ${clientId}`);
      
      // Verificar se instância já existe
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
      
      res.status(201).json({
        success: true,
        message: 'Instância criada com sucesso',
        data: { instanceId, clientId },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ [API] Erro ao criar instância:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @swagger
   * /api/clients/{id}/send:
   *   post:
   *     summary: Enviar mensagem de texto
   *     tags: [Mensagens]
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
      
      console.log(`📤 [API] Enviando mensagem de ${instanceId} para ${to}`);
      
      const result = await sendMessage(instanceId, to, message);
      
      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ [API] Erro ao enviar mensagem:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Endpoint para estatísticas do sistema
  app.get('/api/stats', (req, res) => {
    const stats = getSystemStats();
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  });

  console.log('✅ Rotas da API CORRIGIDAS configuradas');
}

module.exports = {
  setupApiRoutes
};
