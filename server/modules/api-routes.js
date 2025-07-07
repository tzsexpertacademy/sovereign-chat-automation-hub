
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

  console.log('✅ Rotas da API configuradas');
}

module.exports = {
  setupApiRoutes
};
