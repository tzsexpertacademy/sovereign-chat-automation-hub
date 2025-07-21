/**
 * Serviço de Integração IA + Filas
 * FASE 4: Conectar recebimento de mensagens com processamento automático
 */

import { supabase } from '@/integrations/supabase/client';

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
  private processingLogs: Array<{
    ticketId: string;
    timestamp: Date;
    action: string;
    result: 'success' | 'error' | 'handoff';
    details: string;
  }> = [];

  /**
   * Processar mensagem recebida automaticamente
   */
  async processIncomingMessage(
    ticketId: string,
    messageContent: string,
    clientId: string,
    instanceId: string
  ): Promise<MessageProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('🤖 [AI-QUEUE] Iniciando processamento automático:', {
        ticketId,
        clientId,
        messageLength: messageContent.length
      });

      // Verificar se já está processando
      if (this.processingQueue.get(ticketId)) {
        return {
          success: false,
          error: 'Mensagem já está sendo processada',
          processingTime: Date.now() - startTime
        };
      }

      this.processingQueue.set(ticketId, true);

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

      console.log('⚙️ [AI-QUEUE] Configuração da fila:', queueConfig);

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

      // 3. Processar com IA
      const aiResponse = await this.processWithAI(
        messageContent,
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
      this.addProcessingLog(ticketId, 'ai_processing', 'success', 
        `Processado com sucesso em ${Date.now() - startTime}ms`);

      return aiResponse;

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro no processamento:', error);
      
      this.addProcessingLog(ticketId, 'ai_processing', 'error', 
        error instanceof Error ? error.message : 'Erro desconhecido');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no processamento',
        processingTime: Date.now() - startTime
      };
    } finally {
      this.processingQueue.delete(ticketId);
    }
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
        processingDelay: assistant?.advanced_settings?.response_delay_seconds || 3
      };

    } catch (error) {
      console.error('❌ [AI-QUEUE] Erro ao buscar configuração da fila:', error);
      return null;
    }
  }

  /**
   * Processar mensagem com IA
   */
  private async processWithAI(
    messageContent: string,
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

      // Chamar edge function de processamento de IA
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          message: messageContent,
          assistant: {
            prompt: assistant.prompt,
            model: assistant.model || aiConfig.default_model,
            settings: assistant.advanced_settings
          },
          apiKey: aiConfig.openai_api_key,
          ticketId,
          clientId
        }
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