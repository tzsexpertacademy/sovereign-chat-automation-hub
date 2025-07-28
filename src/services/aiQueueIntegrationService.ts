/**
 * Serviço de Integração IA + Filas
 * FASE 4: Conectar recebimento de mensagens com processamento automático
 */

import { supabase } from '@/integrations/supabase/client';
import { useMessageBatch } from '@/hooks/useMessageBatch';
import { messageProcessingController } from './messageProcessingController';

export interface QueueProcessingConfig {
  queueId: string;
  queueName: string;
  assistantId?: string;
  assistantName?: string;
  isActive: boolean;
  autoProcessing: boolean;
  processingDelay: number;
  humanHandoff?: {
    enabled: boolean;
    conditions: string[];
    timeout: number;
  };
}

export interface MessageProcessingResult {
  success: boolean;
  response?: string;
  error?: string;
  shouldHandoffToHuman?: boolean;
  processingTime: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

class AIQueueIntegrationService {
  private processingQueue: Map<string, boolean> = new Map();
  private chatLocks: Map<string, boolean> = new Map(); // NOVO: Lock global por chat_id
  private messageBatcher: any = null;
  private processingLogs: Array<{
    ticketId: string;
    timestamp: Date;
    action: string;
    result: 'success' | 'error' | 'handoff';
    details: string;
  }> = [];

  constructor() {
    this.initializeBatcher();
  }

  private initializeBatcher() {
    // Criar uma instância manual do message batcher para usar fora do React
    this.messageBatcher = {
      config: { timeout: 4000, enabled: true }, // REMOVER maxBatchSize - sem limite
      batches: new Map(),
      processedMessages: new Set(),
      
      addMessage: (message: any) => this.handleBatchMessage(message),
      processBatch: (chatId: string) => this.processBatchedMessages(chatId)
    };
  }

  /**
   * NOVO: Adicionar mensagem ao batch com controle centralizado
   */
  addMessageToBatch(
    ticketId: string,
    messageContent: string,
    clientId: string,
    instanceId: string,
    messageId: string,
    timestamp: number
  ) {
    // NOVO: Usar controlador centralizado para verificar se pode processar
    if (!messageProcessingController.canProcessMessage(messageId, ticketId)) {
      console.log('🚫 [AI-QUEUE] Mensagem não pode ser processada (lock ou já processada):', messageId);
      return;
    }

    const message = {
      id: messageId,
      ticketId,
      content: messageContent,
      clientId,
      instanceId,
      timestamp,
      chatId: ticketId // usar ticketId como chatId para agrupamento
    };

    console.log('📦 [AI-QUEUE] Adicionando mensagem ao batch:', {
      ticketId,
      messageId,
      contentLength: messageContent.length,
      controllerStatus: messageProcessingController.getStatus()
    });

    this.messageBatcher.addMessage(message);
  }

  /**
   * NOVO: Manipular mensagem no batch
   */
  private handleBatchMessage(message: any) {
    const chatId = message.chatId;
    const messageId = message.id;
    const now = Date.now();
    
    // Anti-duplicação
    if (this.messageBatcher.processedMessages.has(messageId)) {
      console.log(`🚫 [AI-QUEUE] Mensagem duplicada ignorada: ${messageId}`);
      return;
    }
    
    this.messageBatcher.processedMessages.add(messageId);
    
    const existingBatch = this.messageBatcher.batches.get(chatId);
    
    if (existingBatch) {
      // NOVA LÓGICA: Sempre cancelar timeout anterior e resetar
      if (existingBatch.timeoutId) {
        clearTimeout(existingBatch.timeoutId);
      }
      
      const updatedMessages = [...existingBatch.messages, message];
      
      // NOVO: Criar timeout de 4 segundos a partir da última mensagem
      const timeoutId = setTimeout(() => {
        console.log(`⏰ [AI-QUEUE] 4 segundos de inatividade - processando batch`);
        this.processBatchedMessages(chatId, updatedMessages);
      }, this.messageBatcher.config.timeout);
      
      this.messageBatcher.batches.set(chatId, {
        ...existingBatch,
        messages: updatedMessages,
        timeoutId,
        lastMessageTime: now
      });
      
      console.log(`📦 [AI-QUEUE] Batch atualizado: ${updatedMessages.length} mensagens (timeout resetado)`);
    } else {
      // Criar novo batch
      const timeoutId = setTimeout(() => {
        console.log(`⏰ [AI-QUEUE] Timeout inicial atingido, processando batch`);
        const batch = this.messageBatcher.batches.get(chatId);
        if (batch) {
          this.processBatchedMessages(chatId, batch.messages);
        }
      }, this.messageBatcher.config.timeout);
      
      this.messageBatcher.batches.set(chatId, {
        chatId,
        messages: [message],
        timeoutId,
        lastMessageTime: now,
        isProcessing: false
      });
      
      console.log(`📦 [AI-QUEUE] Novo batch criado com 1 mensagem`);
    }
  }

  /**
   * RIGOROSO: Processar batch de mensagens com controle ÚNICO
   */
  private async processBatchedMessages(chatId: string, messages?: any[]) {
    const lockKey = `batch_${chatId}`;
    
    try {
      const batch = this.messageBatcher.batches.get(chatId);
      const messagesToProcess = messages || batch?.messages || [];
      
      if (messagesToProcess.length === 0) {
        console.log('⚠️ [AI-QUEUE] Nenhuma mensagem para processar no batch');
        return;
      }
      
      const ticketId = messagesToProcess[0].ticketId;
      
      // CONTROLE RIGOROSO: Múltiplas verificações de lock
      if (messageProcessingController.isChatLocked(chatId) || 
          this.processingQueue.get(ticketId) ||
          this.processingQueue.get(chatId)) {
        console.log('🔒 [AI-QUEUE] BLOQUEADO - Chat/Ticket já sendo processado:', {
          chatId,
          ticketId,
          chatLocked: messageProcessingController.isChatLocked(chatId),
          ticketProcessing: this.processingQueue.get(ticketId),
          chatProcessing: this.processingQueue.get(chatId)
        });
        return;
      }
      
      console.log(`🚀 [AI-QUEUE] INICIANDO processamento ÚNICO de ${messagesToProcess.length} mensagens:`, {
        chatId,
        ticketId,
        messageIds: messagesToProcess.map(m => m.id)
      });
      
      // APLICAR TODOS OS LOCKS
      messageProcessingController.lockChatWithTimestamp(chatId, Date.now());
      this.processingQueue.set(ticketId, true);
      this.processingQueue.set(chatId, true);
      
      // Limpar batch e timeout
      if (batch?.timeoutId) {
        clearTimeout(batch.timeoutId);
      }
      this.messageBatcher.batches.delete(chatId);
      
      try {
        // NOVO: Verificar se as mensagens ainda NÃO foram processadas no DB e no controlador
        const messageIds = messagesToProcess.map(m => m.id);
        const { data: existingMessages } = await supabase
          .from('whatsapp_messages')
          .select('message_id, is_processed')
          .in('message_id', messageIds);
        
        const unprocessedMessages = messagesToProcess.filter(msg => {
          const dbMessage = existingMessages?.find(em => em.message_id === msg.id);
          const isProcessedInDB = dbMessage?.is_processed;
          const isProcessedInController = messageProcessingController.isMessageProcessed(msg.id);
          
          return !isProcessedInDB && !isProcessedInController;
        });
        
        if (unprocessedMessages.length === 0) {
          console.log('⚠️ [AI-QUEUE] Todas as mensagens já foram processadas, cancelando batch');
          return;
        }
        
        console.log(`📋 [AI-QUEUE] ${unprocessedMessages.length}/${messagesToProcess.length} mensagens ainda não processadas`);
        
        // Processar apenas mensagens não processadas
        await this.processMessageBatch(unprocessedMessages);
        
        // NOVO: Marcar mensagens como processadas no DB e no controlador
        await this.markMessagesAsProcessed(unprocessedMessages);
        messageProcessingController.markMessagesProcessed(unprocessedMessages.map(m => m.id));
        
      } finally {
        // NOVO: Liberar lock centralizado sempre
        messageProcessingController.unlockChat(ticketId);
        this.processingQueue.delete(ticketId);
        console.log('🔓 [AI-QUEUE] Lock centralizado liberado para:', ticketId);
      }
      
    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao processar batch:', error);
      // Em caso de erro, também liberar lock
      const firstMessage = messages?.[0] || this.messageBatcher.batches.get(chatId)?.messages?.[0];
      if (firstMessage) {
        messageProcessingController.unlockChat(firstMessage.ticketId);
        this.processingQueue.delete(firstMessage.ticketId);
      }
    }
  }

  /**
   * NOVO: Verificar se o ticket deve ser processado pela IA
   */
  private async shouldProcessWithAI(ticketId: string): Promise<{ shouldProcess: boolean; reason?: string }> {
    try {
      console.log('🔍 [AI-QUEUE] Verificando se ticket deve ser processado pela IA:', ticketId);
      
      // Buscar ticket com informações da fila
      const { data: ticket, error } = await supabase
        .from('conversation_tickets')
        .select(`
          id,
          status,
          assigned_queue_id,
          human_takeover_reason,
          queues:assigned_queue_id (
            id,
            is_active,
            assistant_id,
            name
          )
        `)
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        console.log('❌ [AI-QUEUE] Ticket não encontrado:', error?.message);
        return { shouldProcess: false, reason: 'Ticket não encontrado' };
      }

      // Verificar se ticket tem fila atribuída
      if (!ticket.assigned_queue_id) {
        console.log('⚠️ [AI-QUEUE] Ticket sem fila atribuída - não processando IA');
        return { shouldProcess: false, reason: 'Ticket não está em nenhuma fila' };
      }

      // Verificar se está em modo de takeover humano
      if (ticket.human_takeover_reason) {
        console.log('👤 [AI-QUEUE] Ticket em modo humano - não processando IA:', ticket.human_takeover_reason);
        return { shouldProcess: false, reason: 'Ticket assumido humanamente' };
      }

      // Verificar status do ticket
      if (['pending', 'closed', 'resolved'].includes(ticket.status)) {
        console.log('🚫 [AI-QUEUE] Status do ticket não permite IA:', ticket.status);
        return { shouldProcess: false, reason: `Status não permite IA: ${ticket.status}` };
      }

      // Verificar se a fila existe e está ativa
      const queue = ticket.queues;
      if (!queue) {
        console.log('❌ [AI-QUEUE] Fila não encontrada para o ticket');
        return { shouldProcess: false, reason: 'Fila não encontrada' };
      }

      if (!queue.is_active) {
        console.log('⚠️ [AI-QUEUE] Fila não está ativa:', queue.name);
        return { shouldProcess: false, reason: 'Fila não está ativa' };
      }

      if (!queue.assistant_id) {
        console.log('🤖 [AI-QUEUE] Fila sem assistente configurado:', queue.name);
        return { shouldProcess: false, reason: 'Fila sem assistente IA configurado' };
      }

      console.log('✅ [AI-QUEUE] Ticket aprovado para processamento IA:', {
        ticketId,
        queueName: queue.name,
        status: ticket.status
      });

      return { shouldProcess: true };

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao verificar processamento IA:', error);
      return { shouldProcess: false, reason: 'Erro interno na verificação' };
    }
  }

  /**
   * NOVO: Processar batch completo de mensagens
   */
  private async processMessageBatch(messages: any[]): Promise<MessageProcessingResult> {
    const startTime = Date.now();
    const firstMessage = messages[0];
    const { ticketId, clientId, instanceId } = firstMessage;
    
    try {
      console.log('🤖 [AI-QUEUE] Processando batch automático:', {
        ticketId,
        clientId,
        messageCount: messages.length,
        totalContentLength: messages.reduce((sum, msg) => sum + msg.content.length, 0)
      });

      // 🔍 NOVA VERIFICAÇÃO: Verificar se o ticket deve ser processado pela IA
      const shouldProcessCheck = await this.shouldProcessWithAI(ticketId);
      if (!shouldProcessCheck.shouldProcess) {
        console.log('🚫 [AI-QUEUE] Ticket não deve ser processado pela IA:', shouldProcessCheck.reason);
        return {
          success: true,
          error: shouldProcessCheck.reason,
          processingTime: Date.now() - startTime
        };
      }

      // 1. Buscar configuração da fila ativa para esta instância
      const queueConfig = await this.getActiveQueueConfig(instanceId);
      
      if (!queueConfig) {
        console.log('⚠️ [AI-QUEUE] Nenhuma fila ativa encontrada para a instância');
        return {
          success: false,
          error: 'Nenhuma fila ativa configurada',
          processingTime: Date.now() - startTime
        };
      }

      // 2. Se não tem assistente IA, passar para humano
      if (!queueConfig.assistantId) {
        console.log('👤 [AI-QUEUE] Sem assistente IA - direcionando para humano');
        await this.handoffToHuman(ticketId, 'Sem assistente IA configurado');
        return {
          success: true,
          shouldHandoffToHuman: true,
          processingTime: Date.now() - startTime
        };
      }

      // 3. Processar batch com IA
      const aiResponse = await this.processWithAI(
        messages, // Passar array completo de mensagens
        queueConfig,
        ticketId,
        clientId
      );

      // 4. Verificar se deve transferir para humano
      if (aiResponse.shouldHandoffToHuman) {
        await this.handoffToHuman(ticketId, 'IA solicitou transferência para humano');
        return aiResponse;
      }

      // 5. Enviar resposta automática se sucesso
      if (aiResponse.success && aiResponse.response) {
        await this.sendAutomaticResponse(
          ticketId,
          aiResponse.response,
          instanceId,
          queueConfig
        );
      }

      // 6. Registrar log
      this.addProcessingLog(ticketId, 'ai_batch_processing', 'success', 
        `Batch de ${messages.length} mensagens processado em ${Date.now() - startTime}ms`);

      return aiResponse;

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro no processamento do batch:', error);
      
      this.addProcessingLog(ticketId, 'ai_batch_processing', 'error', 
        error instanceof Error ? error.message : 'Erro desconhecido');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no processamento',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * NOVO: Marcar mensagens como processadas APENAS após sucesso
   */
  private async markMessagesAsProcessed(messages: any[]): Promise<void> {
    try {
      const messageIds = messages.map(m => m.id);
      
      console.log('🏷️ [AI-QUEUE] Marcando mensagens como processadas:', messageIds);
      
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ 
          is_processed: true,
          processed_at: new Date().toISOString()
        })
        .in('message_id', messageIds);
      
      if (error) {
        console.error('❌ [AI-QUEUE] Erro ao marcar mensagens como processadas:', error);
      } else {
        console.log('✅ [AI-QUEUE] Mensagens marcadas como processadas com sucesso');
      }
    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao marcar mensagens como processadas:', error);
    }
  }

  /**
   * DESABILITADO: Processamento individual de mensagens
   * Agora apenas processamento em BATCH é permitido
   */
  async processIncomingMessage(
    ticketId: string,
    messageContent: string,
    clientId: string,
    instanceId: string
  ): Promise<MessageProcessingResult> {
    const startTime = Date.now();
    
    console.log('🚫 [AI-QUEUE] Processamento individual DESABILITADO - use apenas batch:', {
      ticketId,
      messageLength: messageContent.length
    });
    
    return {
      success: false,
      error: 'Processamento individual desabilitado - use batch apenas',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Buscar configuração da fila ativa para uma instância
   */
  private async getActiveQueueConfig(instanceId: string): Promise<QueueProcessingConfig | null> {
    try {
      const { data: connections, error } = await supabase
        .from('instance_queue_connections')
        .select(`
          *,
          queues:queue_id (
            id,
            name,
            is_active,
            assistants:assistant_id (
              id,
              name,
              prompt,
              model,
              advanced_settings
            )
          ),
          whatsapp_instances:instance_id (
            id,
            instance_id,
            status
          )
        `)
        .eq('whatsapp_instances.instance_id', instanceId)
        .eq('is_active', true)
        .eq('queues.is_active', true);

      if (error || !connections || connections.length === 0) {
        return null;
      }

      const connection = connections[0];
      const queue = connection.queues;
      const assistant = queue?.assistants;

      return {
        queueId: queue.id,
        queueName: queue.name,
        assistantId: assistant?.id,
        assistantName: assistant?.name,
        isActive: queue.is_active,
        autoProcessing: true,
        processingDelay: (assistant?.advanced_settings as any)?.response_delay_seconds || 3
      };

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao buscar configuração da fila:', error);
      return null;
    }
  }

  /**
   * ATUALIZADO: Processar com IA (suporta mensagem única ou batch)
   */
  private async processWithAI(
    messageData: string | any[],
    queueConfig: QueueProcessingConfig,
    ticketId: string,
    clientId: string
  ): Promise<MessageProcessingResult> {
    const startTime = Date.now();

    try {
      // Buscar configuração de IA do cliente
      const { data: aiConfig, error: aiConfigError } = await supabase
        .from('client_ai_configs')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (aiConfigError || !aiConfig) {
        return {
          success: false,
          error: 'Configuração de IA não encontrada',
          shouldHandoffToHuman: true,
          processingTime: Date.now() - startTime
        };
      }

      // Buscar dados do assistente
      const { data: assistant } = await supabase
        .from('assistants')
        .select('*')
        .eq('id', queueConfig.assistantId)
        .single();

      if (!assistant) {
        return {
          success: false,
          error: 'Assistente não encontrado',
          shouldHandoffToHuman: true,
          processingTime: Date.now() - startTime
        };
      }

      // Aguardar delay configurado (humanização)
      if (queueConfig.processingDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, queueConfig.processingDelay * 1000));
      }

      // Preparar dados para a edge function
      const isBatch = Array.isArray(messageData);
      const payload = isBatch ? {
        // Enviar batch de mensagens
        messages: messageData.map(msg => ({
          content: msg.content,
          timestamp: msg.timestamp,
          id: msg.id
        })),
        ticketId,
        instanceId: messageData[0].instanceId,
        clientId,
        assistant: {
          id: assistant.id,
          name: assistant.name,
          prompt: assistant.prompt,
          model: assistant.model || aiConfig.default_model,
          settings: assistant.advanced_settings
        }
      } : {
        // Enviar mensagem única
        message: messageData,
        ticketId,
        clientId,
        assistant: {
          prompt: assistant.prompt,
          model: assistant.model || aiConfig.default_model,
          settings: assistant.advanced_settings
        },
        apiKey: aiConfig.openai_api_key
      };

      console.log(`🤖 [AI-QUEUE] Chamando IA com ${isBatch ? 'batch' : 'mensagem única'}:`, {
        isBatch,
        messageCount: isBatch ? messageData.length : 1,
        assistantId: assistant.id
      });

      // Chamar edge function de processamento de IA
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
        body: payload
      });

      if (aiError) {
        throw new Error(`Erro na IA: ${aiError.message}`);
      }

      console.log('🤖 [AI-QUEUE] Resposta da IA gerada:', {
        hasResponse: !!aiResult?.response,
        confidence: aiResult?.confidence,
        shouldHandoff: aiResult?.shouldHandoffToHuman
      });

      return {
        success: true,
        response: aiResult?.response,
        confidence: aiResult?.confidence,
        shouldHandoffToHuman: aiResult?.shouldHandoffToHuman || false,
        processingTime: Date.now() - startTime,
        metadata: {
          assistantId: queueConfig.assistantId,
          model: assistant.model,
          queueId: queueConfig.queueId
        }
      };

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro no processamento com IA:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no processamento da IA',
        shouldHandoffToHuman: true,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Enviar resposta automática
   */
  private async sendAutomaticResponse(
    ticketId: string,
    response: string,
    instanceId: string,
    queueConfig: QueueProcessingConfig
  ): Promise<void> {
    try {
      // Buscar informações do ticket
      const { data: ticket } = await supabase
        .from('conversation_tickets')
        .select('*, customers(*)')
        .eq('id', ticketId)
        .single();

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      // Salvar mensagem de resposta no banco
      const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          message_id: `ai_response_${Date.now()}`,
          content: response,
          from_me: true,
          is_ai_response: true,
          sender_name: queueConfig.assistantName || 'Assistente IA',
          timestamp: new Date().toISOString(),
          processing_status: 'processed'
        });

      if (messageError) {
        throw messageError;
      }

      // Enviar via WhatsApp usando yumer-webhook
      const { error: sendError } = await supabase.functions.invoke('yumer-webhook', {
        body: {
          action: 'send_message',
          instanceId: instanceId,
          chatId: ticket.chat_id,
          message: response,
          isAutomatic: true
        }
      });

      if (sendError) {
        console.error('⚠️ [AI-QUEUE] Erro ao enviar pelo WhatsApp:', sendError);
        // Não falhar se o envio pelo WhatsApp falhar - mensagem já foi salva
      }

      console.log('✅ [AI-QUEUE] Resposta automática enviada');

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao enviar resposta automática:', error);
      throw error;
    }
  }

  /**
   * Transferir para atendimento humano
   */
  private async handoffToHuman(ticketId: string, reason: string): Promise<void> {
    try {
      await supabase
        .from('conversation_tickets')
        .update({
          status: 'pending',
          assigned_queue_id: null,
          assigned_assistant_id: null
        })
        .eq('id', ticketId);

      this.addProcessingLog(ticketId, 'handoff_to_human', 'handoff', reason);
      console.log('👤 [AI-QUEUE] Transferido para humano:', reason);

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao transferir para humano:', error);
    }
  }

  /**
   * Adicionar log de processamento
   */
  private addProcessingLog(
    ticketId: string,
    action: string,
    result: 'success' | 'error' | 'handoff',
    details: string
  ): void {
    this.processingLogs.push({
      ticketId,
      timestamp: new Date(),
      action,
      result,
      details
    });

    // Manter apenas os últimos 100 logs
    if (this.processingLogs.length > 100) {
      this.processingLogs = this.processingLogs.slice(-100);
    }
  }

  /**
   * Obter logs de processamento
   */
  getProcessingLogs(ticketId?: string) {
    if (ticketId) {
      return this.processingLogs.filter(log => log.ticketId === ticketId);
    }
    return this.processingLogs;
  }

  /**
   * Verificar se mensagem está sendo processada
   */
  isProcessing(ticketId: string): boolean {
    return this.processingQueue.get(ticketId) || false;
  }

  /**
   * Estatísticas de processamento
   */
  getProcessingStats() {
    const recent = this.processingLogs.filter(
      log => Date.now() - log.timestamp.getTime() < 24 * 60 * 60 * 1000 // Últimas 24h
    );

    return {
      totalProcessed: recent.length,
      successful: recent.filter(log => log.result === 'success').length,
      errors: recent.filter(log => log.result === 'error').length,
      handoffs: recent.filter(log => log.result === 'handoff').length,
      currentlyProcessing: this.processingQueue.size
    };
  }
}

// Instância singleton
export const aiQueueIntegrationService = new AIQueueIntegrationService();
export default aiQueueIntegrationService;