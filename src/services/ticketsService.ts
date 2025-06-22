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
        tags: Array.isArray(ticket.tags) ? ticket.tags.filter(tag => typeof tag === 'string') : [],
        custom_fields: typeof ticket.custom_fields === 'object' && ticket.custom_fields !== null ? ticket.custom_fields : {},
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
        tags: Array.isArray(data.tags) ? data.tags.filter(tag => typeof tag === 'string') : [],
        custom_fields: typeof data.custom_fields === 'object' && data.custom_fields !== null ? data.custom_fields : {},
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

      return (data || []).reverse(); // Retornar em ordem cronológica
    } catch (error) {
      console.error('Erro ao buscar mensagens do ticket:', error);
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
    try {
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
    } catch (error) {
      console.error('Erro ao criar/atualizar ticket:', error);
      throw error;
    }
  }

  async addTicketMessage(messageData: CreateTicketMessageData): Promise<void> {
    try {
      // Verificar se a mensagem já existe para evitar duplicatas
      const { data: existingMessage } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('message_id', messageData.message_id)
        .eq('ticket_id', messageData.ticket_id)
        .single();

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
      console.log('🔄 Iniciando importação de conversas para cliente:', clientId);
      
      // Buscar instâncias ativas do cliente
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (instancesError) throw instancesError;

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada. Conecte uma instância primeiro.');
      }

      console.log('📱 Instâncias conectadas encontradas:', instances.length);

      let totalImported = 0;
      let totalErrors = 0;

      // Importar conversas de cada instância
      for (const instance of instances) {
        try {
          console.log(`📥 Importando conversas da instância: ${instance.instance_id}`);
          
          const response = await fetch(`/api/whatsapp/${instance.instance_id}/conversations`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-ID': clientId
            },
          });

          if (!response.ok) {
            console.error(`❌ Erro HTTP ${response.status} para instância ${instance.instance_id}`);
            totalErrors++;
            continue;
          }

          const result = await response.json();
          
          if (result.success) {
            totalImported += result.imported || 0;
            console.log(`✅ Instância ${instance.instance_id}: ${result.imported} conversas importadas`);
          } else {
            console.error(`❌ Erro na instância ${instance.instance_id}:`, result.error);
            totalErrors++;
          }
        } catch (error) {
          console.error(`❌ Erro ao processar instância ${instance.instance_id}:`, error);
          totalErrors++;
        }
      }

      return {
        success: totalImported,
        errors: totalErrors,
        total_instances: instances.length
      };
    } catch (error) {
      console.error('❌ Erro na importação:', error);
      throw error;
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
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
      
      console.log('✅ Ticket assumido manualmente:', ticketId);
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
          assigned_assistant_id: null,
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
          metadata: { queue_id: queueId, reason: reason || 'Sem motivo especificado' }
        });
      
      console.log('✅ Ticket transferido:', ticketId);
    } catch (error) {
      console.error('Erro ao transferir ticket:', error);
      throw error;
    }
  }

  async addTicketTag(ticketId: string, tag: string): Promise<void> {
    try {
      const ticket = await this.getTicketById(ticketId);
      const currentTags = ticket.tags || [];
      
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
      const currentTags = ticket.tags || [];
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
