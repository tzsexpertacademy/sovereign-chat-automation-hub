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
      console.log('🎫 [SERVICE] Buscando tickets para cliente:', clientId);
      
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

      if (error) {
        console.error('❌ [SERVICE] Erro ao buscar tickets:', error);
        throw error;
      }

      console.log('✅ [SERVICE] Tickets encontrados:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('📊 [SERVICE] Primeiro ticket:', {
          id: data[0].id,
          title: data[0].title,
          chat_id: data[0].chat_id,
          last_message_at: data[0].last_message_at,
          status: data[0].status
        });
      }

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
      console.error('❌ [SERVICE] Erro crítico ao buscar tickets:', error);
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
      console.log('🎫 [SERVICE] ===== CRIANDO/ATUALIZANDO TICKET (VERSÃO ROBUSTA) =====');
      console.log('🎫 [SERVICE] Parâmetros recebidos:', {
        clientId,
        chatId,
        instanceId,
        customerName,
        customerPhone,
        lastMessage: lastMessage.substring(0, 50) + '...',
        lastMessageAt
      });

      // PASSO 1: Criar/atualizar customer (SEMPRE)
      console.log('👤 [SERVICE] PASSO 1: Processando customer...');
      
      let customerId: string;
      
      // Tentar encontrar customer existente
      const { data: existingCustomer, error: customerSearchError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('phone', customerPhone)
        .maybeSingle();

      if (customerSearchError) {
        console.warn('⚠️ [SERVICE] Erro na busca de customer (continuando):', customerSearchError);
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log('👤 [SERVICE] Customer existente encontrado:', customerId);
        
        // Atualizar customer se necessário
        const { error: updateCustomerError } = await supabase
          .from('customers')
          .update({ 
            name: customerName,
            whatsapp_chat_id: chatId,
            updated_at: new Date().toISOString()
          })
          .eq('id', customerId);
          
        if (updateCustomerError) {
          console.warn('⚠️ [SERVICE] Erro ao atualizar customer (continuando):', updateCustomerError);
        } else {
          console.log('✅ [SERVICE] Customer atualizado');
        }
      } else {
        // Criar novo customer
        console.log('👤 [SERVICE] Criando novo customer...');
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

        if (customerError) {
          console.error('❌ [SERVICE] Erro ao criar customer:', customerError);
          throw customerError;
        }
        customerId = newCustomer.id;
        console.log('👤 [SERVICE] Novo customer criado:', customerId);
      }

      // PASSO 2: Buscar ticket existente (apenas NÃO arquivados)
      console.log('🔍 [SERVICE] PASSO 2: Buscando ticket existente...');
      
      const { data: existingTicket, error: searchError } = await supabase
        .from('conversation_tickets')
        .select('id, status, is_archived')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .eq('is_archived', false)
        .maybeSingle();

      if (searchError) {
        console.warn('⚠️ [SERVICE] Erro na busca de ticket (continuando):', searchError);
      }

      console.log('🔍 [SERVICE] Resultado da busca de ticket:', existingTicket);

      const ticketTitle = `Conversa com ${customerName}`;

      if (existingTicket) {
        // PASSO 3A: Atualizar ticket existente
        console.log('📝 [SERVICE] PASSO 3A: Atualizando ticket existente:', existingTicket.id);
        
        const { error: updateError } = await supabase
          .from('conversation_tickets')
          .update({
            customer_id: customerId,
            title: ticketTitle,
            last_message_preview: lastMessage,
            last_message_at: lastMessageAt,
            status: 'open',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id);

        if (updateError) {
          console.error('❌ [SERVICE] Erro ao atualizar ticket:', updateError);
          throw updateError;
        }
        
        console.log('✅ [SERVICE] Ticket existente atualizado com sucesso:', existingTicket.id);
        return existingTicket.id;
      } else {
        // PASSO 3B: Criar novo ticket
        console.log('🆕 [SERVICE] PASSO 3B: Criando novo ticket...');
        
        const newTicketData = {
          client_id: clientId,
          customer_id: customerId,
          chat_id: chatId,
          instance_id: instanceId,
          title: ticketTitle,
          last_message_preview: lastMessage,
          last_message_at: lastMessageAt,
          status: 'open' as const,
          priority: 1,
          is_archived: false,
          tags: [],
          custom_fields: {},
          internal_notes: []
        };
        
        console.log('🆕 [SERVICE] Dados do novo ticket:', newTicketData);

        const { data: newTicket, error: createError } = await supabase
          .from('conversation_tickets')
          .insert(newTicketData)
          .select('id')
          .single();

        if (createError) {
          console.error('❌ [SERVICE] Erro ao criar ticket:', createError);
          console.error('❌ [SERVICE] Dados que falharam:', newTicketData);
          throw createError;
        }

        console.log('✅ [SERVICE] Novo ticket criado com sucesso:', newTicket.id);
        return newTicket.id;
      }
    } catch (error) {
      console.error('❌ [SERVICE] ERRO CRÍTICO ao garantir ticket:', error);
      console.error('❌ [SERVICE] Stack trace:', error instanceof Error ? error.stack : 'N/A');
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

  async addTicketMessage(messageData: CreateTicketMessageData): Promise<void> {
    try {
      console.log('💬 [SERVICE] ===== ADICIONANDO MENSAGEM =====');
      console.log('💬 [SERVICE] Dados da mensagem:', {
        ticketId: messageData.ticket_id,
        messageId: messageData.message_id,
        fromMe: messageData.from_me,
        content: messageData.content.substring(0, 50) + '...',
        messageType: messageData.message_type
      });

      // Verificar se mensagem já existe
      const { data: existingMessage } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('message_id', messageData.message_id)
        .eq('ticket_id', messageData.ticket_id)
        .maybeSingle();

      if (existingMessage) {
        console.log('⚠️ [SERVICE] Mensagem já existe, ignorando duplicata:', messageData.message_id);
        return;
      }

      const { error } = await supabase
        .from('ticket_messages')
        .insert(messageData);

      if (error) {
        console.error('❌ [SERVICE] Erro ao inserir mensagem:', error);
        console.error('❌ [SERVICE] Dados que falharam:', messageData);
        throw error;
      }
      
      console.log('✅ [SERVICE] Mensagem adicionada com sucesso:', messageData.message_id);
    } catch (error) {
      console.error('❌ [SERVICE] ERRO CRÍTICO ao adicionar mensagem:', error);
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
