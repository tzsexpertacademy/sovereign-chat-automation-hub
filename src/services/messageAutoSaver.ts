/**
 * SERVIÇO AUTOMÁTICO DE SALVAMENTO DE MENSAGENS
 * Remove a necessidade de salvamento manual duplo
 */

import { ticketsService, type TicketMessage } from './ticketsService';
import { smartLogs } from './smartLogsService';

interface AutoSaveOptions {
  ticketId: string;
  messageId: string;
  content: string;
  fromMe: boolean;
  senderName: string;
  messageType?: string;
  timestamp?: string;
  isAiResponse?: boolean;
  audioDuration?: number;
}

class MessageAutoSaver {
  
  /**
   * SALVAMENTO AUTOMÁTICO COM ANTI-DUPLICAÇÃO
   * Usado pelo unifiedMessageService para salvar automaticamente
   */
  async saveMessage(options: AutoSaveOptions): Promise<TicketMessage | null> {
    try {
      console.log('💾 [AUTO-SAVE] Salvando mensagem automaticamente:', {
        messageId: options.messageId,
        ticketId: options.ticketId,
        fromMe: options.fromMe
      });

      const savedMessage = await ticketsService.addTicketMessage({
        ticket_id: options.ticketId,
        message_id: options.messageId,
        from_me: options.fromMe,
        sender_name: options.senderName,
        content: options.content,
        message_type: options.messageType || 'text',
        timestamp: options.timestamp || new Date().toISOString(),
        is_internal_note: false,
        is_ai_response: options.isAiResponse || false,
        processing_status: 'processed',
        media_duration: options.audioDuration
      });

      console.log('✅ [AUTO-SAVE] Mensagem salva:', {
        messageId: savedMessage.message_id,
        dbId: savedMessage.id
      });

      return savedMessage;

    } catch (error: any) {
      // Se for erro de duplicata, não é um erro real
      if (error.message?.includes('já existe') || error.message?.includes('duplicate')) {
        console.log('🔒 [AUTO-SAVE] Mensagem já existe - ignorando:', options.messageId);
        return null;
      }

      console.error('❌ [AUTO-SAVE] Erro ao salvar mensagem:', {
        messageId: options.messageId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * SALVAMENTO INTELIGENTE - verifica se é necessário salvar
   */
  async smartSave(options: AutoSaveOptions): Promise<TicketMessage | null> {
    // Para mensagens de IA ou importantes, sempre tentar salvar
    if (options.isAiResponse || options.fromMe) {
      return this.saveMessage(options);
    }

    // Para outras mensagens, verificar se já existe
    try {
      return await this.saveMessage(options);
    } catch (error) {
      // Falha silenciosa para mensagens não críticas
      console.warn('⚠️ [AUTO-SAVE] Falha silenciosa:', options.messageId);
      return null;
    }
  }
}

export const messageAutoSaver = new MessageAutoSaver();