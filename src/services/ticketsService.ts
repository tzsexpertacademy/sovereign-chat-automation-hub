
import { supabase } from "@/integrations/supabase/client";
import { conversationImportService } from "./conversationImportService";

export interface TicketMessage {
  id: string;
  ticket_id: string;
  message_id: string;
  content: string;
  message_type: string;
  from_me: boolean;
  sender_name?: string;
  timestamp: string;
  created_at: string;
  media_url?: string;
  processing_status?: string;
  is_ai_response?: boolean;
  is_internal_note?: boolean;
  audio_base64?: string;
  media_duration?: number;
  media_transcription?: string;
}

export interface ConversationTicket {
  id: string;
  client_id: string;
  customer_id?: string;
  chat_id: string;
  instance_id: string;
  title: string;
  status: 'open' | 'closed';
  priority: number;
  assigned_assistant_id?: string;
  assigned_queue_id?: string;
  last_message_preview?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
}

export class TicketsService {
  
  /**
   * Importar conversas usando o novo serviço
   */
  async importConversationsFromWhatsApp(clientId: string) {
    return await conversationImportService.importConversationsFromWhatsApp(clientId);
  }

  /**
   * Buscar tickets do cliente
   */
  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    return await this.getTickets(clientId);
  }

  /**
   * Adicionar mensagem ao ticket
   */
  async addTicketMessage(ticketId: string, messageData: Partial<TicketMessage>): Promise<TicketMessage | null> {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          message_id: messageData.message_id || `msg_${Date.now()}`,
          content: messageData.content || '',
          message_type: messageData.message_type || 'text',
          from_me: messageData.from_me || false,
          sender_name: messageData.sender_name,
          timestamp: messageData.timestamp || new Date().toISOString(),
          media_url: messageData.media_url,
          processing_status: messageData.processing_status || 'processed',
          is_ai_response: messageData.is_ai_response || false,
          is_internal_note: messageData.is_internal_note || false,
          audio_base64: messageData.audio_base64,
          media_duration: messageData.media_duration,
          media_transcription: messageData.media_transcription
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao adicionar mensagem:', error);
      return null;
    }
  }

  /**
   * Criar ou atualizar ticket
   */
  async createOrUpdateTicket(clientId: string, chatId: string, instanceId: string, customerData: any): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('upsert_conversation_ticket', {
        p_client_id: clientId,
        p_chat_id: chatId,
        p_instance_id: instanceId,
        p_customer_name: customerData.name || 'Cliente',
        p_customer_phone: customerData.phone || '',
        p_last_message: customerData.lastMessage || '',
        p_last_message_at: customerData.lastMessageAt || new Date().toISOString()
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao criar/atualizar ticket:', error);
      return null;
    }
  }

  /**
   * Buscar mensagens de um ticket
   */
  async getTicketMessages(ticketId: string, limit = 50): Promise<TicketMessage[]> {
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
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Assumir ticket manualmente
   */
  async assumeTicketManually(ticketId: string, assignedTo?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          status: 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao assumir ticket:', error);
      throw error;
    }
  }

  /**
   * Remover ticket da fila
   */
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
      console.error('Erro ao remover ticket da fila:', error);
      throw error;
    }
  }

  /**
   * Transferir ticket
   */
  async transferTicket(ticketId: string, targetQueueId?: string, targetAssistantId?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: targetQueueId || null,
          assigned_assistant_id: targetAssistantId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao transferir ticket:', error);
      throw error;
    }
  }

  /**
   * Atualizar tags do ticket
   */
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
      console.error('Erro ao atualizar tags:', error);
      throw error;
    }
  }

  /**
   * Validar e corrigir timestamp
   */
  validateAndFixTimestamp(timestamp: any): string {
    if (!timestamp) return new Date().toISOString();
    
    if (typeof timestamp === 'number') {
      // Se for timestamp em segundos, converter para millisegundos
      const ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      return new Date(ts).toISOString();
    }
    
    if (typeof timestamp === 'string') {
      try {
        return new Date(timestamp).toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
    
    return new Date().toISOString();
  }

  /**
   * Buscar tickets com filtros
   */
  async getTickets(clientId: string, filters: {
    status?: string;
    search?: string;
    limit?: number;
  } = {}): Promise<ConversationTicket[]> {
    try {
      let query = supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customers (
            id,
            name,
            phone,
            email
          )
        `)
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`
        );
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(ticket => ({
        ...ticket,
        status: ticket.status as 'open' | 'closed',
        tags: Array.isArray(ticket.tags) ? ticket.tags.map(tag => String(tag)) : []
      }));
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      return [];
    }
  }

  /**
   * Atualizar status do ticket
   */
  async updateTicketStatus(ticketId: string, status: 'open' | 'closed'): Promise<void> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'closed') {
        updates.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('conversation_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  }

  /**
   * Criar ou atualizar ticket a partir de mensagem
   */
  async createOrUpdateTicketFromMessage(
    clientId: string,
    chatId: string,
    instanceId: string,
    senderName?: string,
    senderPhone?: string,
    content?: string,
    timestamp?: string
  ): Promise<string | null> {
    try {
      // Usar a função do banco para criar/atualizar
      const { data, error } = await supabase
        .rpc('upsert_conversation_ticket', {
          p_client_id: clientId,
          p_chat_id: chatId,
          p_instance_id: instanceId,
          p_customer_name: senderName || 'Contato',
          p_customer_phone: senderPhone || chatId,
          p_last_message: content || '',
          p_last_message_at: timestamp || new Date().toISOString()
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao criar/atualizar ticket:', error);
      return null;
    }
  }

  /**
   * Buscar ticket por ID
   */
  async getTicketById(ticketId: string): Promise<ConversationTicket | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customers (
            id,
            name,
            phone,
            email
          )
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      return data ? { 
        ...data, 
        status: data.status as 'open' | 'closed',
        tags: Array.isArray(data.tags) ? data.tags.map(tag => String(tag)) : []
      } : null;
    } catch (error) {
      console.error('Erro ao buscar ticket:', error);
      return null;
    }
  }
}

export const ticketsService = new TicketsService();
