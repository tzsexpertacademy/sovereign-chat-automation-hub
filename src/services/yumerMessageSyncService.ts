
import { supabase } from "@/integrations/supabase/client";

export interface YumerUnprocessedMessage {
  id: string;
  message_id: string;
  chat_id: string;
  instance_id: string;
  sender: string;
  body: string;
  message_type: string;
  from_me: boolean;
  timestamp: string;
  is_processed: boolean;
}

export const yumerMessageSyncService = {
  // Converter mensagens não processadas para sistema de tickets
  async convertUnprocessedMessages(clientId: string): Promise<{ converted: number; errors: number }> {
    console.log('🔄 [YUMER-SYNC] Iniciando conversão de mensagens não processadas');
    
    try {
      // Buscar instâncias do cliente
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, id, client_id')
        .eq('client_id', clientId);

      if (instancesError || !instances || instances.length === 0) {
        console.log('⚠️ [YUMER-SYNC] Nenhuma instância encontrada para o cliente');
        return { converted: 0, errors: 0 };
      }

      const instanceIds = instances.map(i => i.instance_id);
      console.log(`📱 [YUMER-SYNC] Instâncias encontradas: ${instanceIds.join(', ')}`);

      // Buscar mensagens não processadas
      const { data: unprocessedMessages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('instance_id', instanceIds)
        .eq('is_processed', false)
        .order('timestamp', { ascending: true });

      if (messagesError) {
        console.error('❌ [YUMER-SYNC] Erro ao buscar mensagens:', messagesError);
        throw messagesError;
      }

      if (!unprocessedMessages || unprocessedMessages.length === 0) {
        console.log('✅ [YUMER-SYNC] Nenhuma mensagem não processada encontrada');
        return { converted: 0, errors: 0 };
      }

      console.log(`📨 [YUMER-SYNC] ${unprocessedMessages.length} mensagens não processadas encontradas`);

      let convertedCount = 0;
      let errorCount = 0;

      // Converter cada mensagem
      for (const message of unprocessedMessages) {
        try {
          await this.convertSingleMessage(message as YumerUnprocessedMessage, clientId);
          
          // REMOVIDO: Não marcar como processada aqui - deixar para o batch system
          // await supabase
          //   .from('whatsapp_messages')
          //   .update({ is_processed: true })
          //   .eq('id', message.id);
          
          convertedCount++;
          console.log(`✅ [YUMER-SYNC] Mensagem convertida (SEM marcar como processada): ${message.message_id}`);
        } catch (error) {
          console.error(`❌ [YUMER-SYNC] Erro ao converter mensagem ${message.message_id}:`, error);
          errorCount++;
        }
      }

      console.log(`🎉 [YUMER-SYNC] Conversão concluída: ${convertedCount} convertidas, ${errorCount} erros`);
      return { converted: convertedCount, errors: errorCount };

    } catch (error) {
      console.error('❌ [YUMER-SYNC] Erro crítico na conversão:', error);
      throw error;
    }
  },

  // Converter uma mensagem individual
  async convertSingleMessage(message: YumerUnprocessedMessage, clientId: string) {
    console.log(`🔧 [CONVERT] Convertendo mensagem: ${message.message_id}`);

    // Extrair dados da mensagem
    const messageData = {
      messageId: message.message_id,
      chatId: message.chat_id,
      fromMe: message.from_me,
      content: message.body,
      messageType: message.message_type,
      timestamp: message.timestamp,
      contactName: this.extractContactName(message.sender, message.chat_id),
      phoneNumber: this.extractPhoneNumber(message.chat_id),
      author: message.sender
    };

    console.log('📊 [CONVERT] Dados extraídos:', messageData);

    // Criar/atualizar customer
    const customerId = await this.createOrUpdateCustomer(clientId, messageData);
    
    // Criar/atualizar ticket
    const ticketId = await this.createOrUpdateTicket(clientId, message.instance_id, messageData, customerId);
    
    // Salvar mensagem no ticket
    await this.saveTicketMessage(ticketId, messageData);

    console.log(`✅ [CONVERT] Mensagem convertida com sucesso`);
  },

  // Extrair nome do contato
  extractContactName(sender: string, chatId: string): string {
    if (sender && sender.trim() && !sender.includes('@') && !sender.match(/^\d+$/)) {
      return this.formatCustomerName(sender.trim());
    }
    
    return this.formatPhoneForDisplay(this.extractPhoneNumber(chatId));
  },

  // Extrair número de telefone
  extractPhoneNumber(chatId: string): string {
    if (!chatId) return '';
    
    let phone = chatId.split('@')[0];
    phone = phone.replace(/\D/g, '');
    
    return phone;
  },

  // Formatar nome do cliente
  formatCustomerName(rawName: string): string {
    if (!rawName || rawName.trim() === '') {
      return 'Contato sem nome';
    }

    const cleanName = rawName.trim();
    
    if (/^\d+$/.test(cleanName) || cleanName.includes('@') || cleanName.length < 2) {
      return 'Contato sem nome';
    }
    
    return cleanName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  // Formatar telefone para exibição
  formatPhoneForDisplay(phoneNumber: string): string {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    if (cleanedNumber.length === 10) {
      return cleanedNumber.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleanedNumber.length === 11) {
      return cleanedNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    return phoneNumber;
  },

  // Criar/atualizar customer
  async createOrUpdateCustomer(clientId: string, messageData: any): Promise<string> {
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('client_id', clientId)
      .eq('phone', messageData.phoneNumber)
      .single();

    if (existingCustomer) {
      // Atualizar nome se temos um nome melhor
      if (messageData.contactName && 
          messageData.contactName !== 'Contato sem nome' &&
          (existingCustomer.name === 'Contato sem nome' || 
           existingCustomer.name.startsWith('Contato ') ||
           existingCustomer.name === messageData.phoneNumber)) {
        
        await supabase
          .from('customers')
          .update({
            name: messageData.contactName,
            whatsapp_chat_id: messageData.chatId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCustomer.id);
      }
      
      return existingCustomer.id;
    } else {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          client_id: clientId,
          name: messageData.contactName,
          phone: messageData.phoneNumber,
          whatsapp_chat_id: messageData.chatId
        })
        .select('id')
        .single();

      if (error) throw error;
      return newCustomer.id;
    }
  },

  // Criar/atualizar ticket
  async createOrUpdateTicket(clientId: string, instanceId: string, messageData: any, customerId: string): Promise<string> {
    const { data: existingTicket } = await supabase
      .from('conversation_tickets')
      .select('id')
      .eq('client_id', clientId)
      .eq('chat_id', messageData.chatId)
      .single();

    const title = `Conversa com ${messageData.contactName}`;

    if (existingTicket) {
      await supabase
        .from('conversation_tickets')
        .update({
          customer_id: customerId,
          title: title,
          last_message_preview: messageData.content,
          last_message_at: messageData.timestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTicket.id);
      
      return existingTicket.id;
    } else {
      const { data: newTicket, error } = await supabase
        .from('conversation_tickets')
        .insert({
          client_id: clientId,
          customer_id: customerId,
          chat_id: messageData.chatId,
          instance_id: instanceId,
          title: title,
          status: 'open',
          priority: 1,
          last_message_preview: messageData.content,
          last_message_at: messageData.timestamp
        })
        .select('id')
        .single();

      if (error) throw error;
      return newTicket.id;
    }
  },

  // Salvar mensagem no ticket
  async saveTicketMessage(ticketId: string, messageData: any) {
    const { error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        message_id: messageData.messageId,
        from_me: messageData.fromMe,
        sender_name: messageData.fromMe ? 'Atendente' : messageData.contactName,
        content: messageData.content,
        message_type: messageData.messageType,
        timestamp: messageData.timestamp,
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received'
      });

    if (error) throw error;
  }
};
