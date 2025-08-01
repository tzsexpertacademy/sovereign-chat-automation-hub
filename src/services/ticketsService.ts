
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
      // 🔥 CORREÇÃO CRÍTICA: Garantir salvamento de TODOS os campos de mídia
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
        // 🔥 CAMPOS DE MÍDIA OBRIGATÓRIOS
        media_url: message.media_url || null,
        media_key: message.media_key || null,
        file_enc_sha256: message.file_enc_sha256 || null,
        media_mime_type: message.media_mime_type || null,
        media_duration: message.media_duration || null,
        audio_base64: message.audio_base64 || null,
        media_transcription: message.media_transcription || null,
        ai_confidence_score: message.ai_confidence_score || null,
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
    let deletionCounts = {
      ticket_events: 0,
      queue_transfers: 0,
      ticket_messages: 0,
      funnel_lead_tags: 0,
      funnel_lead_history: 0,
      funnel_leads: 0,
      message_batches: 0,
      conversation_context: 0,
      conversation_queue_states: 0,
      whatsapp_messages: 0,
      whatsapp_chats: 0,
      customers: 0,
      conversation_tickets: 0
    };

    try {
      console.log('🗑️ [DELETE-TICKET] Iniciando exclusão TOTAL do ticket:', ticketId);
      
      // Buscar informações do ticket para exclusão total
      const { data: ticket } = await supabase
        .from('conversation_tickets')
        .select('id, title, chat_id, instance_id, client_id, customer_id')
        .eq('id', ticketId)
        .single();

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      const { chat_id, instance_id, client_id } = ticket;
      console.log(`🗑️ [DELETE-TICKET] Preparando exclusão total para chat: ${chat_id}`);

      // ====== SEQUÊNCIA DE EXCLUSÃO TOTAL ======
      
      // 1. Excluir eventos do ticket
      const { error: eventsError, count: eventsCount } = await supabase
        .from('ticket_events')
        .delete({ count: 'exact' })
        .eq('ticket_id', ticketId);
      
      deletionCounts.ticket_events = eventsCount || 0;
      if (eventsError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir eventos:', eventsError);

      // 2. Excluir transferências de fila
      const { error: transfersError, count: transfersCount } = await supabase
        .from('queue_transfers')
        .delete({ count: 'exact' })
        .eq('ticket_id', ticketId);
      
      deletionCounts.queue_transfers = transfersCount || 0;
      if (transfersError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir transferências:', transfersError);

      // 3. Excluir mensagens do ticket
      const { error: messagesError, count: messagesCount } = await supabase
        .from('ticket_messages')
        .delete({ count: 'exact' })
        .eq('ticket_id', ticketId);
      
      deletionCounts.ticket_messages = messagesCount || 0;
      if (messagesError) throw messagesError;

      // 4. Excluir dados do funil (se existirem)
      // Primeiro buscar lead relacionado ao chat
      const { data: funnelLead } = await supabase
        .from('funnel_leads')
        .select('id')
        .eq('client_id', client_id)
        .eq('chat_id', chat_id)
        .eq('instance_id', instance_id)
        .single();

      if (funnelLead) {
        // 4a. Excluir tags do lead
        const { error: tagsError, count: tagsCount } = await supabase
          .from('funnel_lead_tags')
          .delete({ count: 'exact' })
          .eq('lead_id', funnelLead.id);
        
        deletionCounts.funnel_lead_tags = tagsCount || 0;
        if (tagsError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir tags do funil:', tagsError);

        // 4b. Excluir histórico do lead
        const { error: historyError, count: historyCount } = await supabase
          .from('funnel_lead_history')
          .delete({ count: 'exact' })
          .eq('lead_id', funnelLead.id);
        
        deletionCounts.funnel_lead_history = historyCount || 0;
        if (historyError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir histórico do funil:', historyError);

        // 4c. Excluir o lead
        const { error: leadError, count: leadCount } = await supabase
          .from('funnel_leads')
          .delete({ count: 'exact' })
          .eq('id', funnelLead.id);
        
        deletionCounts.funnel_leads = leadCount || 0;
        if (leadError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir lead do funil:', leadError);
      }

      // 5. Excluir batches de mensagens
      const { error: batchesError, count: batchesCount } = await supabase
        .from('message_batches')
        .delete({ count: 'exact' })
        .eq('client_id', client_id)
        .eq('chat_id', chat_id)
        .eq('instance_id', instance_id);
      
      deletionCounts.message_batches = batchesCount || 0;
      if (batchesError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir batches:', batchesError);

      // 6. Excluir contexto da conversa (ambos formatos de chat_id)
      const chatIdBase = chat_id.replace('@s.whatsapp.net', '').replace('@s.whats', '').replace('@c.us', '');
      const chatIdPatterns = [
        chat_id,
        `${chatIdBase}@s.whatsapp.net`,
        `${chatIdBase}@s.whats`,
        `${chatIdBase}@c.us`
      ];

      let contextCount = 0;
      for (const pattern of chatIdPatterns) {
        const { error: contextError, count: contextCountPattern } = await supabase
          .from('conversation_context')
          .delete({ count: 'exact' })
          .eq('client_id', client_id)
          .eq('chat_id', pattern)
          .eq('instance_id', instance_id);
        
        contextCount += (contextCountPattern || 0);
        if (contextError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir contexto:', contextError);
      }
      
      deletionCounts.conversation_context = contextCount;

      // 7. Excluir estados da fila de conversa
      const { error: statesError, count: statesCount } = await supabase
        .from('conversation_queue_states')
        .delete({ count: 'exact' })
        .eq('chat_id', chat_id);
      
      deletionCounts.conversation_queue_states = statesCount || 0;
      if (statesError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir estados:', statesError);

      // 8. Excluir TODAS as mensagens do WhatsApp (HISTÓRICO COMPLETO)
      const { error: whatsappMsgError, count: whatsappMsgCount } = await supabase
        .from('whatsapp_messages')
        .delete({ count: 'exact' })
        .eq('chat_id', chat_id)
        .eq('instance_id', instance_id);
      
      deletionCounts.whatsapp_messages = whatsappMsgCount || 0;
      if (whatsappMsgError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir mensagens WhatsApp:', whatsappMsgError);

      // 9. Excluir registro do chat do WhatsApp
      const { error: chatError, count: chatCount } = await supabase
        .from('whatsapp_chats')
        .delete({ count: 'exact' })
        .eq('chat_id', chat_id)
        .eq('instance_id', instance_id);
      
      deletionCounts.whatsapp_chats = chatCount || 0;
      if (chatError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir chat WhatsApp:', chatError);

      // 10. Excluir customer se não está sendo usado por outros tickets
      const { data: otherTickets } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('customer_id', ticket.customer_id || '')
        .neq('id', ticketId);

      if (!otherTickets || otherTickets.length === 0) {
        const { error: customerError, count: customerCount } = await supabase
          .from('customers')
          .delete({ count: 'exact' })
          .eq('id', ticket.customer_id || '');
        
        deletionCounts.customers = customerCount || 0;
        if (customerError) console.warn('⚠️ [DELETE-TICKET] Erro ao excluir customer:', customerError);
      } else {
        console.log('ℹ️ [DELETE-TICKET] Customer mantido (usado por outros tickets)');
      }

      // 11. Excluir o ticket principal (por último)
      const { error: ticketError, count: ticketCount } = await supabase
        .from('conversation_tickets')
        .delete({ count: 'exact' })
        .eq('id', ticketId);

      deletionCounts.conversation_tickets = ticketCount || 0;
      if (ticketError) throw ticketError;

      // Log final com estatísticas completas
      console.log('✅ [DELETE-TICKET] EXCLUSÃO TOTAL CONCLUÍDA:', {
        ticketId,
        chat_id,
        deletedCounts: deletionCounts,
        totalRecordsDeleted: Object.values(deletionCounts).reduce((sum, count) => sum + count, 0)
      });

    } catch (error) {
      console.error('❌ [DELETE-TICKET] Erro na exclusão total:', error);
      console.log('📊 [DELETE-TICKET] Registros excluídos antes do erro:', deletionCounts);
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
