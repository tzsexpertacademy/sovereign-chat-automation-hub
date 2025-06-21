
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
    return data || [];
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
    return data;
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

  async addInternalNote(ticketId: string, note: string, createdBy: string): Promise<void> {
    // Buscar notas existentes
    const { data: ticket } = await supabase
      .from('conversation_tickets')
      .select('internal_notes')
      .eq('id', ticketId)
      .single();

    const existingNotes = ticket?.internal_notes || [];
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
    return data || [];
  }
};
