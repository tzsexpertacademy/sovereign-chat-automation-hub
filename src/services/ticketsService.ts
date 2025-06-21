
import { supabase } from "@/integrations/supabase/client";

export interface ConversationTicket {
  id: string;
  client_id: string;
  customer_id: string;
  chat_id: string;
  instance_id: string;
  title: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: number;
  assigned_queue_id?: string;
  assigned_assistant_id?: string;
  last_message_preview?: string;
  last_message_at: string;
  customer_satisfaction_score?: number;
  resolution_time_minutes?: number;
  tags: string[];
  custom_fields: Record<string, any>;
  internal_notes: any[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  queue?: {
    id: string;
    name: string;
  };
  assistant?: {
    id: string;
    name: string;
  };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  message_id: string;
  from_me: boolean;
  sender_name?: string;
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

export interface TicketEvent {
  id: string;
  ticket_id: string;
  event_type: string;
  description: string;
  metadata: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export const ticketsService = {
  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    const { data, error } = await supabase
      .from('conversation_tickets')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        queue:queues(id, name),
        assistant:assistants(id, name)
      `)
      .eq('client_id', clientId)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(ticket => ({
      ...ticket,
      status: ticket.status as 'open' | 'pending' | 'resolved' | 'closed',
      tags: Array.isArray(ticket.tags) ? ticket.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      custom_fields: typeof ticket.custom_fields === 'object' && ticket.custom_fields !== null ? ticket.custom_fields : {},
      internal_notes: Array.isArray(ticket.internal_notes) ? ticket.internal_notes : []
    }));
  },

  async getTicketById(ticketId: string): Promise<ConversationTicket | null> {
    const { data, error } = await supabase
      .from('conversation_tickets')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        queue:queues(id, name),
        assistant:assistants(id, name)
      `)
      .eq('id', ticketId)
      .single();

    if (error) throw error;
    
    if (!data) return null;
    
    return {
      ...data,
      status: data.status as 'open' | 'pending' | 'resolved' | 'closed',
      tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      custom_fields: typeof data.custom_fields === 'object' && data.custom_fields !== null ? data.custom_fields : {},
      internal_notes: Array.isArray(data.internal_notes) ? data.internal_notes : []
    };
  },

  async createOrUpdateTicket(
    clientId: string,
    chatId: string,
    instanceId: string,
    customerName: string,
    customerPhone: string,
    lastMessage: string,
    lastMessageAt: string
  ): Promise<string> {
    const { data, error } = await supabase.rpc('upsert_conversation_ticket', {
      p_client_id: clientId,
      p_chat_id: chatId,
      p_instance_id: instanceId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_last_message: lastMessage,
      p_last_message_at: lastMessageAt
    });

    if (error) throw error;
    return data;
  },

  async updateTicketStatus(ticketId: string, status: string): Promise<void> {
    const updates: any = { status, updated_at: new Date().toISOString() };
    
    if (status === 'closed' || status === 'resolved') {
      updates.closed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('conversation_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) throw error;
  },

  async updateTicketAssignment(ticketId: string, queueId?: string, assistantId?: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({
        assigned_queue_id: queueId || null,
        assigned_assistant_id: assistantId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async assumeTicketManually(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({
        assigned_queue_id: null,
        assigned_assistant_id: null,
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) throw error;

    // Adicionar evento
    await this.addTicketEvent({
      ticket_id: ticketId,
      event_type: 'manual_takeover',
      description: 'Ticket assumido manualmente pelo operador',
      metadata: { action: 'manual_takeover' }
    });
  },

  async transferTicket(ticketId: string, queueId: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({
        assigned_queue_id: queueId,
        assigned_assistant_id: null,
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) throw error;

    // Adicionar evento
    await this.addTicketEvent({
      ticket_id: ticketId,
      event_type: 'queue_transfer',
      description: `Ticket transferido para outra fila${reason ? ': ' + reason : ''}`,
      metadata: { queue_id: queueId, reason }
    });
  },

  async addInternalNote(ticketId: string, note: string, createdBy: string): Promise<void> {
    // Buscar notas existentes
    const { data: ticket } = await supabase
      .from('conversation_tickets')
      .select('internal_notes')
      .eq('id', ticketId)
      .single();

    const existingNotes = Array.isArray(ticket?.internal_notes) ? ticket.internal_notes : [];
    const newNote = {
      id: crypto.randomUUID(),
      content: note,
      created_by: createdBy,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('conversation_tickets')
      .update({
        internal_notes: [...existingNotes, newNote],
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addTicketMessage(ticketMessage: Omit<TicketMessage, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('ticket_messages')
      .insert(ticketMessage);

    if (error) throw error;
  },

  async addTicketEvent(ticketEvent: Omit<TicketEvent, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('ticket_events')
      .insert(ticketEvent);

    if (error) throw error;
  },

  async getTicketEvents(ticketId: string): Promise<TicketEvent[]> {
    const { data, error } = await supabase
      .from('ticket_events')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(event => ({
      ...event,
      metadata: typeof event.metadata === 'object' && event.metadata !== null ? event.metadata : {}
    }));
  },

  // Importar conversas do WhatsApp e criar tickets
  async importConversationsFromWhatsApp(clientId: string): Promise<{ success: number; errors: number }> {
    try {
      console.log('🔄 Iniciando importação de conversas para cliente:', clientId);
      
      // Buscar conversas do serviço WhatsApp
      const { whatsappService } = await import('@/services/whatsappMultiClient');
      
      // Verificar se o cliente está conectado
      const clientStatus = await whatsappService.getClientStatus(clientId);
      if (clientStatus.status !== 'connected') {
        throw new Error('WhatsApp não está conectado');
      }
      
      // Buscar todas as conversas
      const chats = await whatsappService.getChats(clientId);
      console.log(`📱 ${chats.length} conversas encontradas para importação`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const chat of chats) {
        try {
          // Extrair informações do contato
          const customerName = chat.name || this.extractNameFromChatId(chat.id);
          const customerPhone = this.extractPhoneFromChatId(chat.id);
          
          // Validar dados essenciais
          if (!customerPhone) {
            console.warn(`⚠️ Chat ${chat.id} não possui telefone válido`);
            errorCount++;
            continue;
          }
          
          // Obter última mensagem
          const lastMessage = chat.lastMessage?.body || 'Conversa importada do WhatsApp';
          const lastMessageAt = chat.lastMessage?.timestamp 
            ? new Date(chat.lastMessage.timestamp).toISOString()
            : new Date().toISOString();
          
          // Criar ou atualizar ticket
          const ticketId = await this.createOrUpdateTicket(
            clientId,
            chat.id,
            clientId, // usando clientId como instanceId temporariamente
            customerName,
            customerPhone,
            lastMessage,
            lastMessageAt
          );
          
          console.log(`✅ Ticket criado/atualizado: ${ticketId} para ${customerName} (${customerPhone})`);
          
          // Importar mensagens recentes (últimas 20)
          try {
            const messages = await whatsappService.getChatMessages(clientId, chat.id, 20);
            
            for (const message of messages) {
              await this.addTicketMessage({
                ticket_id: ticketId,
                message_id: message.id,
                from_me: message.fromMe,
                sender_name: message.author || customerName,
                content: message.body || '',
                message_type: message.type || 'text',
                is_internal_note: false,
                is_ai_response: false,
                processing_status: 'imported',
                timestamp: new Date(message.timestamp).toISOString()
              });
            }
            
            console.log(`📨 ${messages.length} mensagens importadas para ticket ${ticketId}`);
          } catch (messageError) {
            console.warn(`⚠️ Erro ao importar mensagens do chat ${chat.id}:`, messageError);
          }
          
          // Adicionar evento de importação
          await this.addTicketEvent({
            ticket_id: ticketId,
            event_type: 'conversation_imported',
            description: 'Conversa importada do WhatsApp',
            metadata: { 
              chat_id: chat.id,
              import_timestamp: new Date().toISOString(),
              messages_imported: true
            }
          });
          
          successCount++;
          
        } catch (chatError) {
          console.error(`❌ Erro ao processar chat ${chat.id}:`, chatError);
          errorCount++;
          continue;
        }
      }
      
      console.log(`✅ Importação concluída: ${successCount} sucessos, ${errorCount} erros`);
      
      return { success: successCount, errors: errorCount };
      
    } catch (error) {
      console.error('❌ Erro na importação de conversas:', error);
      throw error;
    }
  },

  // Métodos auxiliares para extrair informações do chat
  extractNameFromChatId(chatId: string): string {
    // Remove códigos de país e formatação do WhatsApp
    const phone = chatId.replace(/[\D]/g, '').replace(/^55/, '');
    return `Contato ${phone}`;
  },

  extractPhoneFromChatId(chatId: string): string {
    // Extrai apenas os números do chat ID
    const phone = chatId.replace(/[\D]/g, '');
    
    // Remove código do país brasileiro se presente
    if (phone.startsWith('55') && phone.length >= 12) {
      return phone.substring(2);
    }
    
    return phone;
  },

  // Função para importar conversas ativas (para ser chamada periodicamente)
  async syncActiveConversations(clientId: string): Promise<void> {
    try {
      console.log('🔄 Sincronizando conversas ativas para cliente:', clientId);
      
      const { whatsappService } = await import('@/services/whatsappMultiClient');
      
      // Buscar apenas conversas com mensagens recentes (últimas 24h)
      const chats = await whatsappService.getChats(clientId);
      const recentChats = chats.filter(chat => {
        if (!chat.lastMessage?.timestamp) return false;
        const lastMessageTime = new Date(chat.lastMessage.timestamp);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return lastMessageTime > oneDayAgo;
      });
      
      console.log(`📱 ${recentChats.length} conversas ativas encontradas`);
      
      for (const chat of recentChats) {
        try {
          const customerName = chat.name || this.extractNameFromChatId(chat.id);
          const customerPhone = this.extractPhoneFromChatId(chat.id);
          
          if (!customerPhone) continue;
          
          const lastMessage = chat.lastMessage?.body || '';
          const lastMessageAt = new Date(chat.lastMessage!.timestamp).toISOString();
          
          // Atualizar ticket existente ou criar novo
          await this.createOrUpdateTicket(
            clientId,
            chat.id,
            clientId,
            customerName,
            customerPhone,
            lastMessage,
            lastMessageAt
          );
          
        } catch (error) {
          console.error(`Erro ao sincronizar chat ${chat.id}:`, error);
        }
      }
      
      console.log('✅ Sincronização de conversas ativas concluída');
      
    } catch (error) {
      console.error('❌ Erro na sincronização de conversas:', error);
      throw error;
    }
  }
};
