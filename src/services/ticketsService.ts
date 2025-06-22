import { supabase } from '@/integrations/supabase/client';

export interface ConversationTicket {
  id: string;
  client_id: string;
  customer_id?: string;
  chat_id: string;
  instance_id: string;
  title: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: number;
  last_message_preview?: string;
  last_message_at: string;
  assigned_queue_id?: string;
  assigned_assistant_id?: string;
  assigned_queue_name?: string;
  assigned_assistant_name?: string;
  tags: string[];
  custom_fields: Record<string, any>;
  internal_notes: any[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  resolution_time_minutes?: number;
  customer_satisfaction_score?: number;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  message_id: string;
  from_me: boolean;
  sender_name: string;
  content: string;
  message_type: string;
  media_url?: string;
  is_internal_note: boolean;
  is_ai_response: boolean;
  ai_confidence_score?: number;
  processing_status: string;
  timestamp: string;
  created_at: string;
}

export interface CreateTicketMessageData {
  ticket_id: string;
  message_id: string;
  from_me: boolean;
  sender_name: string;
  content: string;
  message_type: string;
  media_url?: string | null;
  is_internal_note: boolean;
  is_ai_response: boolean;
  ai_confidence_score?: number;
  processing_status: string;
  timestamp: string;
}

class TicketsService {
  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customers(*),
          assigned_queue:queues(name),
          assigned_assistant:assistants(name)
        `)
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(ticket => ({
        ...ticket,
        status: ticket.status as 'open' | 'pending' | 'resolved' | 'closed',
        tags: Array.isArray(ticket.tags) ? ticket.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        custom_fields: typeof ticket.custom_fields === 'object' && ticket.custom_fields !== null ? ticket.custom_fields as Record<string, any> : {},
        internal_notes: Array.isArray(ticket.internal_notes) ? ticket.internal_notes : [],
        assigned_queue_name: ticket.assigned_queue?.name,
        assigned_assistant_name: ticket.assigned_assistant?.name
      }));
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      throw error;
    }
  }

  async getTicketById(ticketId: string): Promise<ConversationTicket> {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customers(*),
          assigned_queue:queues(name),
          assigned_assistant:assistants(name)
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;

      return {
        ...data,
        status: data.status as 'open' | 'pending' | 'resolved' | 'closed',
        tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        custom_fields: typeof data.custom_fields === 'object' && data.custom_fields !== null ? data.custom_fields as Record<string, any> : {},
        internal_notes: Array.isArray(data.internal_notes) ? data.internal_notes : [],
        assigned_queue_name: data.assigned_queue?.name,
        assigned_assistant_name: data.assigned_assistant?.name
      };
    } catch (error) {
      console.error('Erro ao buscar ticket:', error);
      throw error;
    }
  }

  async getTicketMessages(ticketId: string, limit: number = 50): Promise<TicketMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).reverse();
    } catch (error) {
      console.error('Erro ao buscar mensagens do ticket:', error);
      throw error;
    }
  }

  async ensureTicketExists(
    clientId: string,
    chatId: string,
    instanceId: string,
    customerName: string,
    customerPhone: string,
    lastMessage: string,
    lastMessageAt: string
  ): Promise<string> {
    try {
      console.log('🎫 GARANTINDO ticket existe para:', {
        clientId,
        chatId,
        customerPhone,
        customerName
      });

      // Primeiro, encontrar ou criar o customer
      let customerId: string;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('phone', customerPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log('👤 Customer existente encontrado:', customerId);
        
        // Atualizar nome se mudou
        if (existingCustomer.name !== customerName) {
          await supabase
            .from('customers')
            .update({ 
              name: customerName,
              whatsapp_chat_id: chatId
            })
            .eq('id', customerId);
        }
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            client_id: clientId,
            name: customerName,
            phone: customerPhone,
            whatsapp_chat_id: chatId
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
        console.log('👤 Novo customer criado:', customerId);
      }

      // Verificar se já existe ticket ATIVO para este chat
      const { data: existingTicket, error: searchError } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .eq('is_archived', false)
        .maybeSingle();

      if (searchError) {
        console.error('❌ Erro ao buscar ticket existente:', searchError);
      }

      if (existingTicket) {
        // Atualizar ticket existente
        const { error: updateError } = await supabase
          .from('conversation_tickets')
          .update({
            customer_id: customerId,
            title: `Conversa com ${customerName}`,
            last_message_preview: lastMessage,
            last_message_at: lastMessageAt,
            status: 'open',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id);

        if (updateError) {
          console.error('❌ Erro ao atualizar ticket:', updateError);
        } else {
          console.log('📝 Ticket existente atualizado:', existingTicket.id);
        }
        
        return existingTicket.id;
      } else {
        // Criar novo ticket (mesmo se foi excluído antes)
        const { data: newTicket, error: createError } = await supabase
          .from('conversation_tickets')
          .insert({
            client_id: clientId,
            customer_id: customerId,
            chat_id: chatId,
            instance_id: instanceId,
            title: `Conversa com ${customerName}`,
            last_message_preview: lastMessage,
            last_message_at: lastMessageAt,
            status: 'open',
            is_archived: false
          })
          .select('id')
          .single();

        if (createError) {
          console.error('❌ Erro ao criar novo ticket:', createError);
          throw createError;
        }

        console.log('🎫 Novo ticket criado/recriado:', newTicket.id);
        return newTicket.id;
      }
    } catch (error) {
      console.error('❌ Erro crítico ao garantir ticket:', error);
      throw error;
    }
  }

  async createOrUpdateTicket(
    clientId: string,
    chatId: string,
    instanceId: string,
    customerName: string,
    customerPhone: string,
    lastMessage: string,
    lastMessageAt: string
  ): Promise<string> {
    return this.ensureTicketExists(
      clientId,
      chatId,
      instanceId,
      customerName,
      customerPhone,
      lastMessage,
      lastMessageAt
    );
  }

  private async createTicketDirectly(
    clientId: string,
    chatId: string,
    instanceId: string,
    customerName: string,
    customerPhone: string,
    lastMessage: string,
    lastMessageAt: string
  ): Promise<string> {
    try {
      // Primeiro, encontrar ou criar o customer
      let customerId: string;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('client_id', clientId)
        .eq('phone', customerPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log('👤 Customer existente encontrado:', customerId);
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            client_id: clientId,
            name: customerName,
            phone: customerPhone,
            whatsapp_chat_id: chatId
          })
          .select('id')
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
        console.log('👤 Novo customer criado:', customerId);
      }

      // Verificar se já existe um ticket ATIVO (não arquivado) para este chat
      const { data: existingTicket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .eq('is_archived', false)
        .maybeSingle();

      if (existingTicket) {
        // Atualizar ticket existente
        const { error: updateError } = await supabase
          .from('conversation_tickets')
          .update({
            last_message_preview: lastMessage,
            last_message_at: lastMessageAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id);

        if (updateError) throw updateError;
        console.log('📝 Ticket existente atualizado:', existingTicket.id);
        return existingTicket.id;
      } else {
        // Criar novo ticket (incluindo quando foi excluído)
        const { data: newTicket, error: ticketError } = await supabase
          .from('conversation_tickets')
          .insert({
            client_id: clientId,
            customer_id: customerId,
            chat_id: chatId,
            instance_id: instanceId,
            title: `Conversa com ${customerName}`,
            last_message_preview: lastMessage,
            last_message_at: lastMessageAt,
            status: 'open',
            is_archived: false
          })
          .select('id')
          .single();

        if (ticketError) throw ticketError;
        console.log('🎫 Novo ticket criado/recriado:', newTicket.id);
        return newTicket.id;
      }
    } catch (error) {
      console.error('❌ Erro ao criar ticket:', error);
      throw error;
    }
  }

  async addTicketMessage(messageData: CreateTicketMessageData): Promise<void> {
    try {
      const { data: existingMessage } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('message_id', messageData.message_id)
        .eq('ticket_id', messageData.ticket_id)
        .maybeSingle();

      if (existingMessage) {
        console.log('Mensagem já existe, ignorando duplicata:', messageData.message_id);
        return;
      }

      const { error } = await supabase
        .from('ticket_messages')
        .insert(messageData);

      if (error) throw error;
      
      console.log('✅ Mensagem adicionada ao ticket:', messageData.message_id);
    } catch (error) {
      console.error('Erro ao adicionar mensagem ao ticket:', error);
      throw error;
    }
  }

  async importConversationsFromWhatsApp(clientId: string) {
    try {
      console.log('📥 Iniciando importação de conversas...');
      
      // Buscar mensagens diretamente para criar tickets
      const { data: messages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('instance_id', clientId)
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (messagesError) {
        console.error('❌ Erro ao buscar mensagens:', messagesError);
        throw new Error('Erro ao buscar mensagens do WhatsApp');
      }

      console.log(`📊 Encontradas ${messages?.length || 0} mensagens`);

      if (!messages || messages.length === 0) {
        return {
          success: 0,
          errors: 0,
          message: 'Nenhuma mensagem encontrada para importar'
        };
      }

      // Agrupar mensagens por chat_id
      const messagesByChat = messages.reduce((acc, message) => {
        if (!acc[message.chat_id]) {
          acc[message.chat_id] = [];
        }
        acc[message.chat_id].push(message);
        return acc;
      }, {} as Record<string, any[]>);

      let successCount = 0;
      let errorCount = 0;

      // Processar cada chat
      for (const [chatId, chatMessages] of Object.entries(messagesByChat)) {
        try {
          // Pegar a mensagem mais recente
          const lastMessage = chatMessages[0];
          
          const customerName = lastMessage.sender || 
                             chatId.replace(/\D/g, '').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') || 
                             'Contato';
          const customerPhone = chatId.replace(/\D/g, '');

          if (!lastMessage.timestamp) {
            console.log(`⚠️ Chat ${chatId} sem timestamp, pulando...`);
            continue;
          }

          // Criar/atualizar ticket
          const ticketId = await this.createOrUpdateTicket(
            clientId,
            chatId,
            lastMessage.instance_id,
            customerName,
            customerPhone,
            lastMessage.body || '[Conversa importada]',
            lastMessage.timestamp
          );

          successCount++;
          console.log(`✅ Chat ${chatId} importado como ticket ${ticketId}`);

        } catch (chatError) {
          console.error(`❌ Erro ao processar chat ${chatId}:`, chatError);
          errorCount++;
        }
      }

      console.log(`📊 Importação concluída: ${successCount} sucessos, ${errorCount} erros`);

      return {
        success: successCount,
        errors: errorCount,
        message: `Importação concluída: ${successCount} conversas importadas`
      };

    } catch (error) {
      console.error('❌ Erro na importação:', error);
      throw new Error('Falha ao importar conversas: ' + (error as Error).message);
    }
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'closed' && { closed_at: new Date().toISOString() })
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar status do ticket:', error);
      throw error;
    }
  }

  async assumeTicketManually(ticketId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          status: 'pending',
          assigned_assistant_id: null,
          assigned_queue_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao assumir ticket manualmente:', error);
      throw error;
    }
  }

  async transferTicket(ticketId: string, queueId: string, reason?: string): Promise<void> {
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

      await supabase
        .from('ticket_events')
        .insert({
          ticket_id: ticketId,
          event_type: 'transfer',
          description: `Ticket transferido para fila ${queueId}`,
          metadata: { queue_id: queueId, reason },
          created_by: 'system'
        });
    } catch (error) {
      console.error('Erro ao transferir ticket:', error);
      throw error;
    }
  }

  async deleteTicket(ticketId: string): Promise<void> {
    try {
      await supabase
        .from('ticket_messages')
        .delete()
        .eq('ticket_id', ticketId);

      await supabase
        .from('ticket_events')
        .delete()
        .eq('ticket_id', ticketId);

      const { error } = await supabase
        .from('conversation_tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;
      
      console.log('🗑️ Ticket excluído completamente:', ticketId);
    } catch (error) {
      console.error('Erro ao excluir ticket:', error);
      throw error;
    }
  }

  async addTicketTag(ticketId: string, tag: string): Promise<void> {
    try {
      const ticket = await this.getTicketById(ticketId);
      const currentTags = Array.isArray(ticket.tags) ? ticket.tags : [];
      
      if (!currentTags.includes(tag)) {
        const updatedTags = [...currentTags, tag];
        
        const { error } = await supabase
          .from('conversation_tickets')
          .update({ 
            tags: updatedTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao adicionar tag ao ticket:', error);
      throw error;
    }
  }

  async removeTicketTag(ticketId: string, tag: string): Promise<void> {
    try {
      const ticket = await this.getTicketById(ticketId);
      const currentTags = Array.isArray(ticket.tags) ? ticket.tags : [];
      const updatedTags = currentTags.filter(t => t !== tag);
      
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          tags: updatedTags,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover tag do ticket:', error);
      throw error;
    }
  }
}

export const ticketsService = new TicketsService();
