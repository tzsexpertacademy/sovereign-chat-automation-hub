/**
 * SERVIÇO UNIFICADO DE MENSAGENS - VERSÃO SIMPLIFICADA
 * 
 * Este é o ÚNICO serviço que deve ser usado para TODOS os envios de mensagem,
 * tanto manual quanto da IA. Elimina duplicações e conflitos.
 */

import { supabase } from "@/integrations/supabase/client";
import yumerApiV2Service from "./yumerApiV2Service";
import { businessTokenService } from "./businessTokenService";
import { smartLogs } from "./smartLogsService";
import { messageChunksService, type ChunkedMessageOptions, type ChunkedMessageResult } from "./messageChunksService";

export interface UnifiedMessageOptions {
  instanceId: string;
  chatId: string;
  message: string;
  clientId?: string;
  source?: 'manual' | 'ai' | 'automation';
  delay?: number;
  presence?: 'composing' | 'recording' | 'available';
  humanized?: boolean;
}

export interface UnifiedMessageResult {
  success: boolean;
  messageId?: string;
  timestamp: number;
  error?: string;
  details?: any;
}

class UnifiedMessageService {
  
  /**
   * MÉTODO PRINCIPAL - ÚNICO PONTO DE ENVIO PARA TUDO
   * ESTRATÉGIA HÍBRIDA: SEMPRE REST para envio (nunca WebSocket)
   */
  async sendMessage(options: UnifiedMessageOptions): Promise<UnifiedMessageResult> {
    try {
      smartLogs.info('MESSAGE', 'Enviando mensagem', {
        instanceId: options.instanceId,
        chatId: options.chatId,
        messageLength: options.message.length,
        source: options.source || 'manual'
      });

      // 1. RESOLVER INSTANCE ID REAL
      const realInstanceId = await this.resolveRealInstanceId(options.instanceId);
      if (!realInstanceId) {
        throw new Error(`Instance ID inválido ou não encontrado: ${options.instanceId}`);
      }

      // 2. GARANTIR BUSINESS TOKEN VÁLIDO
      if (options.clientId) {
        await this.ensureValidBusinessToken(options.clientId);
      }

      // 3. CONFIGURAR OPÇÕES DE ENVIO
      const sendOptions = {
        delay: options.delay || 1200,
        presence: options.presence || 'composing',
        externalAttributes: `source=${options.source || 'manual'};humanized=${options.humanized || false};timestamp=${Date.now()}`
      };

      // 4. ENVIAR VIA YUMER API V2 - SEMPRE REST (ESTRATÉGIA HÍBRIDA)
      const result = await yumerApiV2Service.sendText(
        realInstanceId,
        options.chatId,
        options.message,
        sendOptions
      );

      smartLogs.info('MESSAGE', 'Mensagem enviada com sucesso', { messageId: result.key?.id });

      return {
        success: true,
        messageId: result.key?.id || `unified_msg_${Date.now()}`,
        timestamp: Date.now(),
        details: result
      };

    } catch (error: any) {
      smartLogs.error('MESSAGE', 'Erro ao enviar mensagem', { error: error.message });
      
      return {
        success: false,
        timestamp: Date.now(),
        error: error.message || 'Erro desconhecido no envio',
        details: error
      };
    }
  }

  /**
   * RESOLVER ID REAL DA INSTÂNCIA (UUID -> instance_id real)
   */
  private async resolveRealInstanceId(instanceId: string): Promise<string | null> {
    try {
      // Se é UUID (interno do Supabase), buscar o instance_id real
      if (instanceId.includes('-')) {
        const { data, error } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('id', instanceId)
          .single();
        
        if (error || !data) {
          smartLogs.error('MESSAGE', 'Erro ao resolver instance_id', { instanceId, error: error?.message });
          return null;
        }
        
        return data.instance_id;
      }
      
      // Se já é um instance_id real, retornar diretamente
      return instanceId;
      
    } catch (error) {
      smartLogs.error('MESSAGE', 'Erro ao resolver instance_id', { instanceId, error });
      return null;
    }
  }

  /**
   * BUSCAR ASSISTENTE AUTOMATICAMENTE (fallback para casos sem assistentId)
   */
  private async getAssistantIdFromTicket(chatId: string, clientId?: string): Promise<string | null> {
    if (!clientId) return null;

    try {
      // Buscar ticket ativo para o chat
      const { data: ticket, error } = await supabase
        .from('conversation_tickets')
        .select('assigned_assistant_id, assigned_queue_id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !ticket) {
        smartLogs.warn('MESSAGE', 'Ticket não encontrado para fallback', { chatId, clientId, error });
        return null;
      }

      // Se tem assistente direto, usar
      if (ticket.assigned_assistant_id) {
        smartLogs.info('MESSAGE', 'Assistente encontrado no ticket', { 
          assistantId: ticket.assigned_assistant_id 
        });
        return ticket.assigned_assistant_id;
      }

      // Se não tem assistente mas tem fila, buscar assistente da fila
      if (ticket.assigned_queue_id) {
        const { data: queue, error: queueError } = await supabase
          .from('queues')
          .select('assistant_id')
          .eq('id', ticket.assigned_queue_id)
          .eq('is_active', true)
          .single();

        if (!queueError && queue?.assistant_id) {
          smartLogs.info('MESSAGE', 'Assistente encontrado na fila', { 
            assistantId: queue.assistant_id,
            queueId: ticket.assigned_queue_id
          });
          return queue.assistant_id;
        }
      }

      smartLogs.warn('MESSAGE', 'Nenhum assistente encontrado para fallback', { 
        ticketId: ticket.assigned_assistant_id,
        queueId: ticket.assigned_queue_id
      });
      return null;

    } catch (error) {
      smartLogs.error('MESSAGE', 'Erro ao buscar assistente para fallback', { error });
      return null;
    }
  }

  /**
   * GARANTIR BUSINESS TOKEN VÁLIDO
   */
  private async ensureValidBusinessToken(clientId: string): Promise<void> {
    try {
      const result = await businessTokenService.ensureValidToken(clientId);
      
      if (!result.success) {
        smartLogs.error('MESSAGE', 'Business token inválido', { clientId, error: result.error });
        throw new Error(`Business token inválido: ${result.error}`);
      }
      
    } catch (error) {
      smartLogs.error('MESSAGE', 'Erro ao verificar business token', { clientId, error });
      throw error;
    }
  }

  /**
   * MÉTODO DE CONVENIÊNCIA PARA IA
   */
  async sendAIMessage(instanceId: string, chatId: string, message: string, clientId?: string): Promise<UnifiedMessageResult> {
    return this.sendMessage({
      instanceId,
      chatId,
      message,
      clientId,
      source: 'ai',
      humanized: true,
      delay: Math.floor(Math.random() * 1000 + 800),
      presence: 'composing'
    });
  }

  /**
   * MÉTODO DE CONVENIÊNCIA PARA ENVIO MANUAL
   */
  async sendManualMessage(instanceId: string, chatId: string, message: string, clientId?: string): Promise<UnifiedMessageResult> {
    return this.sendMessage({
      instanceId,
      chatId,
      message,
      clientId,
      source: 'manual',
      humanized: false,
      delay: 0
    });
  }

  /**
   * ENVIO EM BLOCOS - INTEGRAÇÃO COM messageChunksService
   * Detecta automaticamente mensagens longas e aplica configurações do assistente
   */
  async sendMessageInChunks(options: ChunkedMessageOptions): Promise<ChunkedMessageResult> {
    smartLogs.info('MESSAGE', 'Iniciando envio em blocos via unifiedMessageService', {
      chatId: options.chatId,
      messageLength: options.message.length,
      assistantId: options.assistantId
    });

    return messageChunksService.sendMessageInChunks(options);
  }

  /**
   * MÉTODO INTELIGENTE - DETECTA AUTOMATICAMENTE SE DEVE USAR BLOCOS
   * Usado quando queremos que o sistema decida automaticamente
   */
  async sendSmartMessage(
    instanceId: string,
    chatId: string, 
    message: string,
    clientId?: string,
    assistantId?: string,
    callbacks?: {
      onProgress?: (sent: number, total: number) => void;
      onTypingStart?: () => void;
      onTypingStop?: () => void;
    }
  ): Promise<ChunkedMessageResult> {
    
    smartLogs.info('MESSAGE', '🧠 SENDSMARTMESSAGE INICIADO', {
      messageLength: message.length,
      messagePreview: message.substring(0, 150) + '...',
      assistantId,
      hasAssistant: !!assistantId,
      instanceId,
      chatId,
      clientId,
      shouldUseChunks: message.length > 350 || !!assistantId
    });

    console.log('🧠 [SENDSMARTMESSAGE] DADOS COMPLETOS:', {
      'Comprimento da mensagem': message.length,
      'Preview': message.substring(0, 100) + '...',
      'Assistant ID fornecido': assistantId || 'NENHUM',
      'Cliente ID': clientId || 'NENHUM',
      'Instance ID': instanceId,
      'Chat ID': chatId,
      'Decisão inicial': message.length > 350 ? 'USAR BLOCOS' : 'ENVIO DIRETO'
    });

    // 🔧 FALLBACK: Tentar buscar assistente se não foi fornecido
    let finalAssistantId = assistantId;
    if (!finalAssistantId && clientId) {
      finalAssistantId = await this.getAssistantIdFromTicket(chatId, clientId);
      
      if (finalAssistantId) {
        smartLogs.info('MESSAGE', '🎯 ASSISTENTE ENCONTRADO VIA FALLBACK', { 
          assistantId: finalAssistantId 
        });
      }
    }

    // SEMPRE usar sistema de blocos se tiver assistantId (original ou fallback), independente do tamanho
    // O messageChunksService decidirá internamente se precisa dividir
    if (finalAssistantId) {
      smartLogs.info('MESSAGE', '🤖 USANDO SISTEMA DE BLOCOS (assistente configurado)', {
        assistantId: finalAssistantId,
        source: assistantId ? 'direto' : 'fallback',
        messageLength: message.length,
        will_call: 'messageChunksService.sendMessageInChunks'
      });
      
      const result = await this.sendMessageInChunks({
        instanceId,
        chatId,
        message,
        clientId,
        assistantId: finalAssistantId,
        source: 'ai',
        onProgress: callbacks?.onProgress,
        onTypingStart: callbacks?.onTypingStart,
        onTypingStop: callbacks?.onTypingStop
      });

      smartLogs.info('MESSAGE', '✅ RESULTADO DO SISTEMA DE BLOCOS', {
        success: result.success,
        totalChunks: result.totalChunks,
        sentChunks: result.sentChunks,
        errors: result.errors
      });

      return result;
    }

    // Para mensagens sem assistente, usar envio direto
    smartLogs.info('MESSAGE', '📝 USANDO ENVIO DIRETO (sem assistente)', {
      messageLength: message.length,
      will_call: 'sendMessage_direct'
    });
    
    const result = await this.sendMessage({
      instanceId,
      chatId,
      message,
      clientId,
      source: 'manual',
      humanized: false
    });

    return {
      success: result.success,
      totalChunks: 1,
      sentChunks: result.success ? 1 : 0,
      messageIds: result.messageId ? [result.messageId] : [],
      errors: result.error ? [result.error] : [],
      timestamp: Date.now()
    };
  }
}

export const unifiedMessageService = new UnifiedMessageService();