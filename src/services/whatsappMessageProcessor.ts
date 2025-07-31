import { supabase } from '@/integrations/supabase/client';

interface WhatsAppMessage {
  id: string;
  message_id: string;
  chat_id: string;
  instance_id: string;
  body: string;
  timestamp: string;
  from_me: boolean;
  is_processed: boolean;
  phone_number?: string;
  contact_name?: string;
}

export const whatsappMessageProcessor = {
  // 🔄 PROCESSAR mensagens não processadas manualmente
  async processUnprocessedMessages(clientId: string): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    console.log('🔄 [WA-PROCESSOR] Iniciando processamento de mensagens não processadas...');

    try {
      // Buscar mensagens não processadas
      const { data: unprocessedMessages, error: fetchError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('is_processed', false)
        .order('timestamp', { ascending: true })
        .limit(50); // Processar até 50 por vez

      if (fetchError) {
        console.error('❌ [WA-PROCESSOR] Erro ao buscar mensagens:', fetchError);
        return { processed: 0, errors: 1 };
      }

      if (!unprocessedMessages || unprocessedMessages.length === 0) {
        console.log('✅ [WA-PROCESSOR] Nenhuma mensagem não processada encontrada');
        return { processed: 0, errors: 0 };
      }

      console.log(`📦 [WA-PROCESSOR] Encontradas ${unprocessedMessages.length} mensagens para processar`);

      // Processar cada mensagem
      for (const message of unprocessedMessages) {
        try {
          await this.processSingleMessage(message as WhatsAppMessage, clientId);
          processed++;
        } catch (error) {
          console.error('❌ [WA-PROCESSOR] Erro ao processar mensagem:', message.message_id, error);
          errors++;
        }
      }

      console.log(`✅ [WA-PROCESSOR] Processamento concluído: ${processed} processadas, ${errors} erros`);
      return { processed, errors };

    } catch (error) {
      console.error('❌ [WA-PROCESSOR] Erro geral no processamento:', error);
      return { processed, errors: 1 };
    }
  },

  // 📨 PROCESSAR uma mensagem individual (otimizado para batches)
  async processSingleMessage(message: WhatsAppMessage, clientId: string): Promise<void> {
    console.log('📨 [WA-PROCESSOR] Processando mensagem:', {
      messageId: message.message_id,
      chatId: message.chat_id,
      body: message.body?.substring(0, 30)
    });

    try {
      // Se já foi processada, pular
      if (message.is_processed) {
        console.log('✅ [WA-PROCESSOR] Mensagem já processada:', message.message_id);
        return;
      }

      // Verificar se já existe em ticket_messages para evitar duplicação
      const { data: existingMessage } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('message_id', message.message_id)
        .single();

      if (existingMessage) {
        console.log('🔄 [WA-PROCESSOR] Mensagem já existe em ticket_messages, marcando como processada:', message.message_id);
        await this.markAsProcessed(message.id);
        return;
      }

      // 1. Buscar ou criar customer
      const customerId = await this.getOrCreateCustomer(message, clientId);
      
      // 2. Buscar ou criar ticket
      const ticketId = await this.getOrCreateTicket(message, clientId, customerId);
      
      // 3. Salvar mensagem no ticket
      await this.saveMessageToTicket(message, ticketId);
      
      // 4. Marcar como processada
      await this.markAsProcessed(message.id);
      
      console.log('✅ [WA-PROCESSOR] Mensagem processada com sucesso:', message.message_id);

    } catch (error) {
      console.error('❌ [WA-PROCESSOR] Erro ao processar mensagem individual:', error);
      throw error;
    }
  },

  // 👤 BUSCAR ou criar customer
  async getOrCreateCustomer(message: WhatsAppMessage, clientId: string): Promise<string> {
    const phoneNumber = this.extractPhoneNumber(message.chat_id);
    const customerName = message.contact_name || this.formatPhoneForDisplay(phoneNumber);

    // Verificar se customer já existe
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('client_id', clientId)
      .eq('phone', phoneNumber)
      .single();

    if (existingCustomer) {
      return existingCustomer.id;
    }

    // Criar novo customer
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        client_id: clientId,
        name: customerName,
        phone: phoneNumber,
        whatsapp_chat_id: message.chat_id
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Erro ao criar customer: ${error.message}`);
    }

    return newCustomer.id;
  },

  // 🎫 BUSCAR ou criar ticket
  async getOrCreateTicket(message: WhatsAppMessage, clientId: string, customerId: string): Promise<string> {
    // Buscar ticket existente para este chat
    const { data: existingTicket } = await supabase
      .from('conversation_tickets')
      .select('id')
      .eq('client_id', clientId)
      .eq('customer_id', customerId)
      .eq('chat_id', message.chat_id)
      .eq('instance_id', message.instance_id)
      .single();

    if (existingTicket) {
      return existingTicket.id;
    }

    // Criar novo ticket
    const { data: newTicket, error } = await supabase
      .from('conversation_tickets')
      .insert({
        client_id: clientId,
        customer_id: customerId,
        chat_id: message.chat_id,
        instance_id: message.instance_id,
        title: `Conversa com ${message.contact_name || this.extractPhoneNumber(message.chat_id)}`,
        last_message_preview: message.body?.substring(0, 100) || '',
        last_message_at: message.timestamp,
        status: 'open'
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Erro ao criar ticket: ${error.message}`);
    }

    return newTicket.id;
  },

  // 💾 SALVAR mensagem no ticket (com tratamento de duplicatas)
  async saveMessageToTicket(message: WhatsAppMessage, ticketId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          message_id: message.message_id,
          content: message.body || '',
          message_type: 'text',
          from_me: message.from_me,
          timestamp: message.timestamp,
          sender_name: message.contact_name,
          processing_status: 'processed'
        });

      if (error) {
        // Se erro de constraint (mensagem duplicada), apenas log sem throw
        if (error.code === '23505') {
          console.log('📝 [WA-PROCESSOR] Mensagem já existe (constraint):', message.message_id);
          return;
        }
        throw new Error(`Erro ao salvar mensagem no ticket: ${error.message}`);
      }
    } catch (error: any) {
      if (error.code === '23505') {
        console.log('📝 [WA-PROCESSOR] Mensagem já existe (constraint catch):', message.message_id);
        return;
      }
      throw error;
    }
  },

  // ✅ MARCAR como processada (otimizado para batches)
  async markAsProcessed(messageId: string): Promise<void> {
    try {
      // Verificar se já está processada antes de fazer update
      const { data: currentStatus } = await supabase
        .from('whatsapp_messages')
        .select('is_processed')
        .eq('id', messageId)
        .single();

      if (currentStatus?.is_processed) {
        console.log('📝 [WA-PROCESSOR] Mensagem já marcada como processada:', messageId);
        return;
      }

      const { error } = await supabase
        .from('whatsapp_messages')
        .update({
          is_processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        throw new Error(`Erro ao marcar mensagem como processada: ${error.message}`);
      }
    } catch (error: any) {
      console.error('❌ [WA-PROCESSOR] Erro inesperado ao marcar processada:', error);
      throw error;
    }
  },

  // 📦 PROCESSAR múltiplas mensagens em bloco (otimizado)
  async processBatch(messages: WhatsAppMessage[], clientId: string): Promise<{ processed: number; errors: number; skipped: number }> {
    let processed = 0;
    let errors = 0;
    let skipped = 0;

    console.log(`🔄 [WA-PROCESSOR-BATCH] Iniciando processamento de ${messages.length} mensagens em bloco`);

    // Verificar quais mensagens já existem em ticket_messages
    const messageIds = messages.map(m => m.message_id);
    const { data: existingMessages } = await supabase
      .from('ticket_messages')
      .select('message_id')
      .in('message_id', messageIds);

    const existingMessageIds = new Set(existingMessages?.map(m => m.message_id) || []);

    for (const message of messages) {
      try {
        if (message.is_processed) {
          skipped++;
          continue;
        }

        if (existingMessageIds.has(message.message_id)) {
          console.log('🔄 [WA-PROCESSOR-BATCH] Mensagem já existe, marcando como processada:', message.message_id);
          await this.markAsProcessed(message.id);
          skipped++;
          continue;
        }

        await this.processSingleMessage(message, clientId);
        processed++;
      } catch (error) {
        console.error('❌ [WA-PROCESSOR-BATCH] Erro ao processar mensagem:', message.message_id, error);
        errors++;
      }
    }

    console.log(`✅ [WA-PROCESSOR-BATCH] Batch concluído: ${processed} processadas, ${skipped} puladas, ${errors} erros`);
    return { processed, errors, skipped };
  },

  // 🔧 UTILITÁRIOS
  extractPhoneNumber(chatId: string): string {
    return chatId.replace(/@.*$/, '');
  },

  formatPhoneForDisplay(phoneNumber: string): string {
    if (phoneNumber.length === 13 && phoneNumber.startsWith('55')) {
      const area = phoneNumber.substring(2, 4);
      const firstPart = phoneNumber.substring(4, 9);
      const secondPart = phoneNumber.substring(9);
      return `+55 (${area}) ${firstPart}-${secondPart}`;
    }
    return phoneNumber;
  }
};