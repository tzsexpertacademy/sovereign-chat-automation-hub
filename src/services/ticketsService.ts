
import { supabase } from '@/integrations/supabase/client';
import yumerApiV2Service from './yumerApiV2Service';

export interface TicketMessage {
  id: string;
  ticket_id: string;
  message_id: string;
  from_me: boolean;
  sender_name: string;
  content: string;
  message_type: string;
  timestamp: string;
  is_internal_note: boolean;
  is_ai_response: boolean;
  processing_status: string;
  created_at: string;
  media_url?: string;
  audio_base64?: string;
  media_duration?: number;
  media_transcription?: string;
  ai_confidence_score?: number;
}

export interface ConversationTicket {
  id: string;
  client_id: string;
  customer_id: string;
  chat_id: string;
  instance_id: string;
  title: string;
  status: string;
  priority: number;
  last_message_preview: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  assigned_assistant_id?: string;
  assigned_queue_id?: string;
}

class TicketsService {
  // === CORE FUNCTIONS (EXISTING) ===
  async getTicketMessages(ticketId: string, limit = 100): Promise<TicketMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens do ticket:', error);
      throw error;
    }
  }

  async getTicketsByClient(clientId: string): Promise<ConversationTicket[]> {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          )
        `)
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar tickets:', error);
      throw error;
    }
  }

  async addTicketMessage(message: Partial<TicketMessage>): Promise<TicketMessage> {
    try {
      // Garantir que campos obrigatórios estejam presentes
      const messageData = {
        content: message.content || '',
        ticket_id: message.ticket_id || '',
        message_id: message.message_id || '',
        timestamp: message.timestamp || new Date().toISOString(),
        from_me: message.from_me || false,
        sender_name: message.sender_name || '',
        message_type: message.message_type || 'text',
        is_internal_note: message.is_internal_note || false,
        is_ai_response: message.is_ai_response || false,
        processing_status: message.processing_status || 'processed',
        ...message
      };

      const { data, error } = await supabase
        .from('ticket_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao adicionar mensagem ao ticket:', error);
      throw error;
    }
  }

  // === MÉTODOS PARA COMPATIBILIDADE ===
  async getTicketById(ticketId: string): Promise<ConversationTicket | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          )
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar ticket:', error);
      return null;
    }
  }

  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    return this.getTicketsByClient(clientId);
  }

  async assumeTicketManually(ticketId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          status: 'pending',
          assigned_queue_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erro ao assumir ticket:', error);
      throw error;
    }
  }

  async removeTicketFromQueue(ticketId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          assigned_queue_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erro ao remover ticket da fila:', error);
      throw error;
    }
  }

  async transferTicket(ticketId: string, queueId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          assigned_queue_id: queueId,
          status: 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erro ao transferir ticket:', error);
      throw error;
    }
  }

  // Método para atualizar mensagem existente
  async updateTicketMessage(messageId: string, updates: Partial<TicketMessage>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ticket_messages')
        .update(updates)
        .eq('message_id', messageId);

      if (error) {
        console.error('❌ [TICKETS-SERVICE] Erro ao atualizar mensagem:', error);
        return false;
      }

      console.log('✅ [TICKETS-SERVICE] Mensagem atualizada:', messageId, updates);
      return true;
    } catch (error) {
      console.error('❌ [TICKETS-SERVICE] Erro ao atualizar mensagem:', error);
      return false;
    }
  }

  async updateTicketTags(ticketId: string, tags: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          tags: tags,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erro ao atualizar tags do ticket:', error);
      throw error;
    }
  }

  async deleteTicketCompletely(ticketId: string): Promise<void> {
    try {
      console.log('🗑️ [DELETE-TICKET] Iniciando exclusão completa do ticket:', ticketId);
      
      // Verificar se o ticket existe
      const { data: ticket } = await supabase
        .from('conversation_tickets')
        .select('id, title')
        .eq('id', ticketId)
        .single();

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      // Executar exclusões em sequência para manter integridade
      console.log('🗑️ [DELETE-TICKET] Executando exclusão completa');
      
      // 1. Excluir eventos do ticket
      const { error: eventsError } = await supabase
        .from('ticket_events')
        .delete()
        .eq('ticket_id', ticketId);
      
      if (eventsError && !eventsError.message.includes('0 rows')) {
        console.warn('⚠️ [DELETE-TICKET] Erro ao excluir eventos:', eventsError);
      }

      // 2. Excluir transferências de fila
      const { error: transfersError } = await supabase
        .from('queue_transfers')
        .delete()
        .eq('ticket_id', ticketId);
      
      if (transfersError && !transfersError.message.includes('0 rows')) {
        console.warn('⚠️ [DELETE-TICKET] Erro ao excluir transferências:', transfersError);
      }

      // 3. Excluir mensagens do ticket
      const { error: messagesError } = await supabase
        .from('ticket_messages')
        .delete()
        .eq('ticket_id', ticketId);
      
      if (messagesError) {
        console.error('❌ [DELETE-TICKET] Erro ao excluir mensagens:', messagesError);
        throw messagesError;
      }

      // 4. Excluir o ticket principal
      const { error: ticketError } = await supabase
        .from('conversation_tickets')
        .delete()
        .eq('id', ticketId);

      if (ticketError) {
        console.error('❌ [DELETE-TICKET] Erro ao excluir ticket:', ticketError);
        throw ticketError;
      }

      console.log('✅ [DELETE-TICKET] Ticket excluído completamente:', ticketId);
    } catch (error) {
      console.error('❌ [DELETE-TICKET] Erro ao excluir ticket:', error);
      throw error;
    }
  }

  async validateAndFixTimestamp(timestamp: any): Promise<string> {
    if (!timestamp) return new Date().toISOString();
    
    try {
      if (typeof timestamp === 'number') {
        return new Date(timestamp * 1000).toISOString();
      }
      
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      
      return new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  // === IMPORTAÇÃO DE CONVERSAS ===
  async importConversationsFromWhatsApp(clientId: string, options?: any): Promise<{ success: number; errors: number }> {
    console.log('📥 [IMPORT] Iniciando importação de conversas para cliente:', clientId);
    
    try {
      // 1. Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, id')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada');
      }

      let totalSuccess = 0;
      let totalErrors = 0;

      // 2. Importar conversas de cada instância
      for (const instance of instances) {
        console.log(`📱 [IMPORT] Processando instância: ${instance.instance_id}`);
        
        try {
          const { success, errors } = await this.importChatsFromInstance(
            clientId, 
            instance.instance_id
          );
          
          totalSuccess += success;
          totalErrors += errors;
          
          console.log(`✅ [IMPORT] Instância ${instance.instance_id}: ${success} sucessos, ${errors} erros`);
        } catch (error) {
          console.error(`❌ [IMPORT] Erro na instância ${instance.instance_id}:`, error);
          totalErrors++;
        }
      }

      console.log(`🎉 [IMPORT] Importação concluída: ${totalSuccess} sucessos, ${totalErrors} erros`);
      return { success: totalSuccess, errors: totalErrors };
      
    } catch (error) {
      console.error('❌ [IMPORT] Erro na importação:', error);
      throw error;
    }
  }

  private async importChatsFromInstance(clientId: string, instanceId: string): Promise<{ success: number; errors: number }> {
    try {
      // Buscar chats da API Yumer V2
      const chats = await yumerApiV2Service.extractChatsFromMessages(instanceId);
      console.log(`📊 [IMPORT] Progresso: chats encontrados`);

      console.log(`📊 [IMPORT] ${chats.length} chats encontrados na instância ${instanceId}`);

      let success = 0;
      let errors = 0;

      // Processar cada chat
      for (const chat of chats) {
        try {
          await this.createTicketFromChat(clientId, chat, instanceId);
          success++;
        } catch (error) {
          console.error(`❌ [IMPORT] Erro ao processar chat ${chat.remoteJid}:`, error);
          errors++;
        }
      }

      return { success, errors };
    } catch (error) {
      console.error(`❌ [IMPORT] Erro ao importar chats da instância ${instanceId}:`, error);
      throw error;
    }
  }

  // === CRIAÇÃO DE TICKETS A PARTIR DE CHATS ===
  async createTicketFromChat(clientId: string, chat: any, instanceId?: string): Promise<ConversationTicket> {
    console.log('🎫 [CREATE-TICKET] Criando ticket a partir de chat:', chat.remoteJid || chat.id);
    
    try {
      // 1. Extrair informações do chat
      const chatId = chat.remoteJid || chat.id;
      const phoneNumber = this.extractPhoneNumber(chatId);
      const contactName = this.formatContactName(chat.name, phoneNumber);
      
      // 2. Criar/atualizar customer
      const customerId = await this.createOrUpdateCustomer(clientId, {
        phoneNumber,
        contactName,
        chatId: chatId
      });

      // 3. Verificar se ticket já existe
      const { data: existingTicket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .single();

      if (existingTicket) {
        console.log('🎫 [CREATE-TICKET] Ticket já existe:', existingTicket.id);
        
        // Retornar ticket existente
        const { data: ticket } = await supabase
          .from('conversation_tickets')
          .select(`
            *,
            customer:customer_id (
              id,
              name,
              phone,
              email
            )
          `)
          .eq('id', existingTicket.id)
          .single();
        
        return ticket;
      }

      // 4. Criar novo ticket
      const title = `Conversa com ${contactName}`;
      
      const { data: newTicket, error } = await supabase
        .from('conversation_tickets')
        .insert({
          client_id: clientId,
          customer_id: customerId,
          chat_id: chatId,
          instance_id: instanceId || '',
          title: title,
          status: 'open',
          priority: 1,
          last_message_preview: chat.lastMessage || 'Conversa importada',
          last_message_at: chat.lastMessageTime ? new Date(chat.lastMessageTime).toISOString() : new Date().toISOString()
        })
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          )
        `)
        .single();

      if (error) throw error;

      console.log('✅ [CREATE-TICKET] Ticket criado:', newTicket.id);
      return newTicket;
      
    } catch (error) {
      console.error('❌ [CREATE-TICKET] Erro ao criar ticket:', error);
      throw error;
    }
  }

  // === CRIAÇÃO MANUAL DE TICKETS ===
  async createManualTicket(clientId: string, customerId: string): Promise<ConversationTicket> {
    console.log('🎫 [MANUAL-TICKET] Criando ticket manual para customer:', customerId);
    
    try {
      // 1. Buscar dados do customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      // 2. Verificar se já existe ticket para este customer
      const { data: existingTicket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('customer_id', customerId)
        .single();

      if (existingTicket) {
        // Retornar ticket existente
        const { data: ticket } = await supabase
          .from('conversation_tickets')
          .select(`
            *,
            customer:customer_id (
              id,
              name,
              phone,
              email
            )
          `)
          .eq('id', existingTicket.id)
          .single();
        
        return ticket;
      }

      // 3. Gerar chat_id único baseado no telefone
      const phoneNumber = customer.phone.replace(/\D/g, '');
      const chatId = `manual_${phoneNumber}@c.us`;
      
      // 4. Criar novo ticket manual
      const title = `Conversa com ${customer.name}`;
      
      const { data: newTicket, error } = await supabase
        .from('conversation_tickets')
        .insert({
          client_id: clientId,
          customer_id: customerId,
          chat_id: chatId,
          instance_id: 'manual',
          title: title,
          status: 'open',
          priority: 1,
          last_message_preview: 'Conversa criada manualmente',
          last_message_at: new Date().toISOString(),
          tags: ['manual']
        })
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            phone,
            email
          )
        `)
        .single();

      if (error) throw error;

      // 5. Atualizar customer com chat_id
      await supabase
        .from('customers')
        .update({ whatsapp_chat_id: chatId })
        .eq('id', customerId);

      console.log('✅ [MANUAL-TICKET] Ticket manual criado:', newTicket.id);
      return newTicket;
      
    } catch (error) {
      console.error('❌ [MANUAL-TICKET] Erro ao criar ticket manual:', error);
      throw error;
    }
  }

  // === FUNÇÕES DE SUPORTE PARA WEBHOOK ===
  async createOrUpdateCustomer(clientId: string, messageData: any): Promise<string> {
    console.log('👤 [CUSTOMER] Criando/atualizando customer');
    
    const phoneNumber = messageData.phoneNumber || this.extractPhoneNumber(messageData.chatId);
    const contactName = messageData.contactName || this.formatContactName(messageData.pushName, phoneNumber);
    
    try {
      // Verificar se customer já existe
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('phone', phoneNumber)
        .single();

      if (existingCustomer) {
        // Atualizar nome se temos um nome melhor
        if (contactName && 
            contactName !== 'Contato sem nome' &&
            !contactName.includes('(') &&
            (existingCustomer.name === 'Contato sem nome' || 
             existingCustomer.name.includes('(') ||
             existingCustomer.name === phoneNumber)) {
          
          await supabase
            .from('customers')
            .update({
              name: contactName,
              whatsapp_chat_id: messageData.chatId,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCustomer.id);
          
          console.log('👤 [CUSTOMER] Nome atualizado:', contactName);
        }
        
        return existingCustomer.id;
      } else {
        // Criar novo customer
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            client_id: clientId,
            name: contactName,
            phone: phoneNumber,
            whatsapp_chat_id: messageData.chatId
          })
          .select('id')
          .single();

        if (error) throw error;

        console.log('👤 [CUSTOMER] Novo customer criado:', contactName);
        return newCustomer.id;
      }
    } catch (error) {
      console.error('❌ [CUSTOMER] Erro:', error);
      throw error;
    }
  }

  async createOrUpdateTicket(clientId: string, instanceId: string, messageData: any, customerId: string): Promise<string> {
    console.log('🎫 [TICKET] Criando/atualizando ticket');
    
    try {
      // Verificar se ticket já existe
      const { data: existingTicket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', messageData.chatId)
        .single();

      const title = `Conversa com ${messageData.contactName}`;

      if (existingTicket) {
        // Atualizar ticket existente
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
        
        console.log('🎫 [TICKET] Ticket atualizado:', existingTicket.id);
        return existingTicket.id;
      } else {
        // Criar novo ticket
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

        console.log('🎫 [TICKET] Novo ticket criado:', newTicket.id);
        return newTicket.id;
      }
    } catch (error) {
      console.error('❌ [TICKET] Erro:', error);
      throw error;
    }
  }

  // === FUNÇÕES AUXILIARES ===
  private extractPhoneNumber(chatId: string): string {
    if (!chatId) return '';
    
    let phone = chatId.split('@')[0];
    phone = phone.replace(/\D/g, '');
    
    // Remover DDI 55 se presente
    if (phone.startsWith('55') && phone.length >= 12) {
      phone = phone.slice(2);
    }
    
    return phone;
  }

  private formatContactName(name: string | undefined, phoneNumber: string): string {
    // Usar nome se válido
    if (name && name.trim() && !name.match(/^\d+$/) && !name.includes('@')) {
      return name.trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // Fallback para número formatado
    return this.formatPhoneForDisplay(phoneNumber);
  }

  private formatPhoneForDisplay(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    return phoneNumber;
  }
}

export const ticketsService = new TicketsService();
export default ticketsService;
