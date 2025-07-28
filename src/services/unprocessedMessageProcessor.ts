/**
 * Serviço para processamento de mensagens não processadas
 * PARTE 1: Processar mensagens pendentes
 */

import { supabase } from '@/integrations/supabase/client';
import { aiQueueIntegrationService } from './aiQueueIntegrationService';

export interface UnprocessedMessage {
  id: string;
  message_id: string;
  chat_id: string;
  instance_id: string;
  body: string;
  from_me: boolean;
  created_at: string;
}

export interface ProcessingStatus {
  totalPending: number;
  processing: number;
  processed: number;
  errors: number;
  lastProcessed?: string;
}

class UnprocessedMessageProcessor {
  private static instance: UnprocessedMessageProcessor;
  private isProcessing = false;
  private processingStatus: ProcessingStatus = {
    totalPending: 0,
    processing: 0,
    processed: 0,
    errors: 0
  };

  private constructor() {}

  static getInstance(): UnprocessedMessageProcessor {
    if (!UnprocessedMessageProcessor.instance) {
      UnprocessedMessageProcessor.instance = new UnprocessedMessageProcessor();
    }
    return UnprocessedMessageProcessor.instance;
  }

  /**
   * Processar mensagens não processadas para um cliente
   */
  async processUnprocessedMessages(clientId: string): Promise<ProcessingStatus> {
    if (this.isProcessing) {
      console.log('⚠️ [UNPROCESSED] Processamento já em andamento');
      return this.processingStatus;
    }

    this.isProcessing = true;
    this.resetStatus();

    try {
      console.log('🚀 [UNPROCESSED] Iniciando processamento de mensagens pendentes...');

      // 1. Buscar mensagens não processadas do cliente
      const unprocessedMessages = await this.getUnprocessedMessages(clientId);
      
      this.processingStatus.totalPending = unprocessedMessages.length;
      console.log(`📊 [UNPROCESSED] ${unprocessedMessages.length} mensagens pendentes encontradas`);

      if (unprocessedMessages.length === 0) {
        console.log('✅ [UNPROCESSED] Não há mensagens pendentes');
        return this.processingStatus;
      }

      // 2. Processar cada mensagem
      for (const message of unprocessedMessages) {
        await this.processSingleMessage(message, clientId);
        
        // Delay entre processamentos para evitar spam
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ [UNPROCESSED] Processamento concluído:', {
        total: this.processingStatus.totalPending,
        processed: this.processingStatus.processed,
        errors: this.processingStatus.errors
      });

      return this.processingStatus;

    } catch (error) {
      console.error('❌ [UNPROCESSED] Erro no processamento:', error);
      this.processingStatus.errors++;
      return this.processingStatus;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Buscar mensagens não processadas do cliente
   */
  private async getUnprocessedMessages(clientId: string): Promise<UnprocessedMessage[]> {
    try {
      // Buscar instâncias do cliente para filtrar mensagens
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId);

      if (!instances || instances.length === 0) {
        return [];
      }

      const instanceIds = instances.map(i => i.instance_id);

      // Buscar mensagens não processadas
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('is_processed', false)
        .eq('from_me', false) // Apenas mensagens recebidas
        .in('instance_id', instanceIds)
        .order('created_at', { ascending: true }) // Processar em ordem cronológica
        .limit(50); // Limitar para evitar sobrecarga

      if (error) {
        throw error;
      }

      return messages || [];

    } catch (error) {
      console.error('❌ [UNPROCESSED] Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Processar uma única mensagem
   */
  private async processSingleMessage(message: UnprocessedMessage, clientId: string): Promise<void> {
    this.processingStatus.processing++;

    try {
      console.log(`🔄 [UNPROCESSED] Processando mensagem: ${message.message_id}`);

      // 1. Buscar/criar ticket para esta conversa
      const ticketId = await this.getOrCreateTicket(message, clientId);

      if (!ticketId) {
        throw new Error('Não foi possível criar ticket');
      }

      // 2. Salvar mensagem no ticket
      await this.saveMessageToTicket(ticketId, message);

      // 3. Processar com IA se configurado
      await this.processWithAI(ticketId, message, clientId);

      // 4. Marcar como processada
      await supabase
        .from('whatsapp_messages')
        .update({ is_processed: true })
        .eq('id', message.id);

      this.processingStatus.processed++;
      this.processingStatus.lastProcessed = new Date().toISOString();
      
      console.log(`✅ [UNPROCESSED] Mensagem processada: ${message.message_id}`);

    } catch (error) {
      console.error(`❌ [UNPROCESSED] Erro ao processar mensagem ${message.message_id}:`, error);
      this.processingStatus.errors++;
    } finally {
      this.processingStatus.processing--;
    }
  }

  /**
   * Buscar ou criar ticket para a conversa
   */
  private async getOrCreateTicket(message: UnprocessedMessage, clientId: string): Promise<string | null> {
    try {
      // Extrair número de telefone do chat_id
      const phoneNumber = this.extractPhoneFromChatId(message.chat_id);
      
      // Buscar ticket existente
      const { data: existingTicket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', message.chat_id)
        .eq('instance_id', message.instance_id)
        .maybeSingle();

      if (existingTicket) {
        return existingTicket.id;
      }

      // Criar novo ticket
      const customer = await this.getOrCreateCustomer(clientId, phoneNumber, message.chat_id);
      
      if (!customer) {
        throw new Error('Não foi possível criar cliente');
      }

      const { data: ticket, error } = await supabase
        .from('conversation_tickets')
        .insert({
          client_id: clientId,
          customer_id: customer.id,
          chat_id: message.chat_id,
          instance_id: message.instance_id,
          title: `Conversa com ${customer.name}`,
          status: 'open',
          last_message_preview: message.body.substring(0, 100),
          last_message_at: message.created_at
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return ticket.id;

    } catch (error) {
      console.error('❌ [UNPROCESSED] Erro ao criar ticket:', error);
      return null;
    }
  }

  /**
   * Buscar ou criar cliente
   */
  private async getOrCreateCustomer(clientId: string, phoneNumber: string, chatId: string) {
    try {
      // Buscar cliente existente
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', clientId)
        .eq('phone', phoneNumber)
        .maybeSingle();

      if (existingCustomer) {
        return existingCustomer;
      }

      // Criar novo cliente
      const customerName = this.formatCustomerName(phoneNumber);
      
      const { data: customer, error } = await supabase
        .from('customers')
        .insert({
          client_id: clientId,
          name: customerName,
          phone: phoneNumber,
          whatsapp_chat_id: chatId
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return customer;

    } catch (error) {
      console.error('❌ [UNPROCESSED] Erro ao criar cliente:', error);
      return null;
    }
  }

  /**
   * Salvar mensagem no ticket
   */
  private async saveMessageToTicket(ticketId: string, message: UnprocessedMessage): Promise<void> {
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          message_id: message.message_id,
          content: message.body,
          from_me: message.from_me,
          timestamp: message.created_at,
          message_type: 'text',
          sender_name: message.from_me ? 'Eu' : 'Cliente'
        });

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ [UNPROCESSED] Erro ao salvar mensagem no ticket:', error);
      throw error;
    }
  }

  /**
   * Processar mensagem com IA
   */
  private async processWithAI(ticketId: string, message: UnprocessedMessage, clientId: string): Promise<void> {
    try {
      // Verificar se há fila/assistente configurado para a instância
      const { data: connection } = await supabase
        .from('instance_queue_connections')
        .select(`
          *,
          queues:queue_id (
            id,
            is_active,
            assistants:assistant_id (id, name)
          ),
          whatsapp_instances:instance_id (instance_id)
        `)
        .eq('whatsapp_instances.instance_id', message.instance_id)
        .eq('is_active', true)
        .eq('queues.is_active', true)
        .maybeSingle();

      if (!connection || !connection.queues?.assistants) {
        console.log('ℹ️ [UNPROCESSED] Sem assistente IA configurado para a instância');
        return;
      }

      // Processar com IA usando o serviço existente
      console.log('🤖 [UNPROCESSED] Processando com IA...');
      
      const result = await aiQueueIntegrationService.processIncomingMessage(
        ticketId,
        message.body,
        clientId,
        message.instance_id
      );

      console.log('✅ [UNPROCESSED] IA processou:', {
        success: result.success,
        hasResponse: !!result.response,
        shouldHandoff: result.shouldHandoffToHuman
      });

    } catch (error) {
      console.error('❌ [UNPROCESSED] Erro no processamento IA:', error);
      // Não falhar o processamento geral se a IA falhar
    }
  }

  /**
   * Utilitários
   */
  private extractPhoneFromChatId(chatId: string): string {
    return chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
  }

  private formatCustomerName(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return `Cliente ${cleaned.slice(-4)}`;
  }

  private resetStatus(): void {
    this.processingStatus = {
      totalPending: 0,
      processing: 0,
      processed: 0,
      errors: 0
    };
  }

  /**
   * Getters
   */
  getStatus(): ProcessingStatus {
    return { ...this.processingStatus };
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }
}

// Singleton
export const unprocessedMessageProcessor = UnprocessedMessageProcessor.getInstance();
export default unprocessedMessageProcessor;