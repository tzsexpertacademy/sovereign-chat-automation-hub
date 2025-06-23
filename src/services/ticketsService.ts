import { supabase } from "@/integrations/supabase/client";

export interface ConversationTicket {
  id: string;
  created_at: string;
  updated_at: string;
  chat_id: string;
  title: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  first_message: string;
  last_message_preview: string;
  last_message_at: string;
  customer_id: string;
  assigned_queue_id: string | null;
  assigned_queue_name: string | null;
  assigned_assistant_id: string | null;
  customer?: {
    id: string;
    created_at: string;
    name: string;
    phone: string;
    email?: string;
  };
  assigned_queue?: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface TicketMessage {
  id: string;
  created_at: string;
  ticket_id: string;
  message_id: string;
  content: string;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document';
  from_me: boolean;
  timestamp: string;
  sender_name?: string;
  is_ai_response?: boolean;
}

export const ticketsService = {
  async getTickets(clientId: string): Promise<ConversationTicket[]> {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customers(*),
          assigned_queue:queues(*)
        `)
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }
  },

  async getTicketMessages(ticketId: string, limit: number = 50): Promise<TicketMessage[]> {
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
      console.error('Error fetching ticket messages:', error);
      throw error;
    }
  },

  async updateTicket(ticketId: string, updates: Partial<ConversationTicket>): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }
  },

  async importConversationsFromWhatsApp(clientId: string): Promise<{ success: number; errors: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('import-whatsapp-chats', {
        body: { clientId }
      });

      if (error) {
        console.error('Erro ao chamar a função:', error);
        throw new Error(error.message);
      }

      console.log('Resultado da função:', data);
      return data;
    } catch (error: any) {
      console.error('Erro ao importar conversas:', error);
      throw new Error(error.message);
    }
  },

  async getTicketById(ticketId: string) {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer:customers(*),
          assigned_queue:queues(*)
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar ticket:', error);
      throw error;
    }
  },

  async addMessageToTicket(ticketId: string, messageData: {
    message_id: string;
    content: string;
    message_type: string;
    from_me: boolean;
    is_ai_response?: boolean;
    timestamp: string;
    sender_name?: string;
  }) {
    try {
      console.log('💾 Adicionando mensagem ao ticket:', ticketId);
      
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          ...messageData
        });

      if (error) throw error;
      
      // Atualizar última mensagem do ticket
      await supabase
        .from('conversation_tickets')
        .update({
          last_message_preview: messageData.content.substring(0, 100),
          last_message_at: messageData.timestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      console.log('✅ Mensagem adicionada ao ticket');
    } catch (error) {
      console.error('❌ Erro ao adicionar mensagem:', error);
      throw error;
    }
  }
};
