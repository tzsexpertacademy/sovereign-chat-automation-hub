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

// Função utilitária para normalizar números de telefone
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Se o número começar com 55 (Brasil), mantém como está
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 13) {
    return cleanPhone;
  }
  
  // Se tiver 11 dígitos e começar com código de área, adiciona 55
  if (cleanPhone.length === 11 && cleanPhone.startsWith('4')) {
    return `55${cleanPhone}`;
  }
  
  // Se tiver 10 dígitos, adiciona 55 + 9 no meio
  if (cleanPhone.length === 10 && cleanPhone.startsWith('47')) {
    return `55${cleanPhone.slice(0, 2)}9${cleanPhone.slice(2)}`;
  }
  
  return cleanPhone;
}

// Função para formatar nome do cliente
function formatCustomerName(phone: string, name?: string): string {
  if (name && name !== phone && !name.includes('@') && name !== 'undefined') {
    return name;
  }
  
  const normalizedPhone = normalizePhoneNumber(phone);
  if (normalizedPhone.length >= 11) {
    // Formato brasileiro: +55 (XX) 9XXXX-XXXX
    const formatted = normalizedPhone.replace(/(\d{2})(\d{2})(\d{1})(\d{4})(\d{4})/, '+$1 ($2) $3$4-$5');
    return formatted;
  }
  
  return phone || 'Contato';
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
      console.log('🎫 Criando/atualizando ticket:', {
        clientId,
        chatId,
        instanceId,
        customerName,
        customerPhone,
        lastMessage: lastMessage.substring(0, 50)
      });

      // Normalizar número de telefone
      const normalizedPhone = normalizePhoneNumber(customerPhone);
      const formattedName = formatCustomerName(normalizedPhone, customerName);

      console.log('📞 Dados normalizados:', {
        originalPhone: customerPhone,
        normalizedPhone,
        formattedName
      });

      const { data, error } = await supabase.rpc('upsert_conversation_ticket', {
        p_client_id: clientId,
        p_chat_id: chatId,
        p_instance_id: instanceId,
        p_customer_name: formattedName,
        p_customer_phone: normalizedPhone,
        p_last_message: lastMessage,
        p_last_message_at: lastMessageAt
      });

      if (error) {
        console.error('❌ Erro na função upsert_conversation_ticket:', error);
        throw error;
      }

      console.log('✅ Ticket criado/atualizado com sucesso:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao criar/atualizar ticket:', error);
      throw error;
    }
  }

  async addTicketMessage(messageData: CreateTicketMessageData): Promise<void> {
    try {
      console.log('💬 Adicionando mensagem ao ticket:', {
        ticketId: messageData.ticket_id,
        messageId: messageData.message_id,
        fromMe: messageData.from_me,
        content: messageData.content.substring(0, 50)
      });

      // Verificar se a mensagem já existe para evitar duplicatas
      const { data: existingMessage } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('message_id', messageData.message_id)
        .eq('ticket_id', messageData.ticket_id)
        .single();

      if (existingMessage) {
        console.log('⚠️ Mensagem já existe, ignorando duplicata:', messageData.message_id);
        return;
      }

      const { error } = await supabase
        .from('ticket_messages')
        .insert(messageData);

      if (error) {
        console.error('❌ Erro ao inserir mensagem:', error);
        throw error;
      }
      
      console.log('✅ Mensagem adicionada ao ticket:', messageData.message_id);
    } catch (error) {
      console.error('❌ Erro ao adicionar mensagem ao ticket:', error);
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
          
          // Usar servidor WhatsApp correto
          const response = await fetch(`https://146.59.227.248/api/instances/${instance.instance_id}/chats`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.error(`❌ Erro HTTP ${response.status} para instância ${instance.instance_id}`);
            const errorText = await response.text();
            console.error('Resposta do servidor:', errorText);
            totalErrors++;
            continue;
          }

          const chats = await response.json();
          console.log(`📊 Chats encontrados:`, chats.length);
          
          if (Array.isArray(chats) && chats.length > 0) {
            for (const chat of chats) {
              try {
                // Extrair informações do chat
                const chatId = chat.id || chat.chatId;
                const customerName = chat.name || chat.pushName || chatId.replace('@c.us', '').replace('@g.us', '');
                const customerPhone = chatId.replace('@c.us', '').replace('@g.us', '');
                const lastMessage = chat.lastMessage?.body || chat.lastMessage?.caption || 'Conversa importada do WhatsApp';
                const lastMessageAt = chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : new Date().toISOString();

                await this.createOrUpdateTicket(
                  clientId,
                  chatId,
                  instance.instance_id,
                  customerName,
                  customerPhone,
                  lastMessage,
                  lastMessageAt
                );

                totalImported++;
              } catch (chatError) {
                console.error(`❌ Erro ao processar chat:`, chatError);
                totalErrors++;
              }
            }
          } else {
            console.log(`ℹ️ Nenhum chat encontrado na instância ${instance.instance_id}`);
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
