import { supabase } from '@/integrations/supabase/client';
import { contactNameService } from '@/services/contactNameService';
import { supabaseSanitizer } from '@/services/supabaseSanitizer';

export interface ConversationTicket {
  id: string;
  created_at: string;
  client_id: string;
  customer_id: string;
  chat_id: string;
  instance_id: string;
  title: string;
  status: 'open' | 'closed' | 'pending' | 'resolved';
  priority: number;
  assigned_queue_id?: string;
  assigned_queue_name?: string;
  assigned_assistant_id?: string;
  tags?: string[];
  last_message_preview?: string;
  last_message_at?: string;
  customer?: {
    id: string;
    created_at: string;
    client_id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
    last_seen?: string;
    avatar_url?: string;
  };
}

export interface TicketMessage {
  id?: string;
  ticket_id: string;
  message_id: string;
  from_me: boolean;
  sender_name: string;
  content: string;
  message_type: string;
  timestamp: string;
  is_internal_note: boolean;
  is_ai_response: boolean;
  ai_confidence_score?: number;
  processing_status: string;
  media_url?: string;
  audio_base64?: string;
  media_duration?: number;
  media_transcription?: string;
}

class TicketsService {
  /**
   * Buscar todos os tickets de um cliente
   */
  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    try {
      const { data: tickets, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer: customers (*)
        `)
        .eq('client_id', clientId)
        .order('last_message_at', { ascending: false })

      if (error) {
        throw error;
      }

      return (tickets || []) as ConversationTicket[];
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      throw error;
    }
  }

  /**
   * Buscar um ticket pelo ID
   */
  async getTicketById(ticketId: string): Promise<ConversationTicket> {
    try {
      const { data: ticket, error } = await supabase
        .from('conversation_tickets')
        .select(`
          *,
          customer: customers (*)
        `)
        .eq('id', ticketId)
        .single();

      if (error) {
        throw error;
      }

      return ticket as ConversationTicket;
    } catch (error) {
      console.error('Erro ao buscar ticket:', error);
      throw error;
    }
  }

  /**
   * Encontrar ticket pelo chat ID
   */
  async findTicketByChat(clientId: string, chatId: string): Promise<ConversationTicket | null> {
    try {
      const { data: ticket, error } = await supabase
        .from('conversation_tickets')
        .select('*')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .single();

      if (error) {
        console.warn('Ticket não encontrado:', chatId, error.message);
        return null;
      }

      return ticket as ConversationTicket;
    } catch (error) {
      console.error('Erro ao buscar ticket por chat ID:', error);
      return null;
    }
  }

  /**
   * Criar/atualizar ticket com extração melhorada de nomes
   */
  async createOrUpdateTicket(data: {
    clientId: string;
    chatId: string;
    title: string;
    phoneNumber: string;
    contactName?: string;
    instanceId?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    pushName?: string;
    firstMessage?: string;
  }): Promise<string> {
    console.log('🎫 [TICKETS] Criando/atualizando ticket:', {
      clientId: data.clientId,
      chatId: data.chatId,
      phoneNumber: data.phoneNumber,
      contactName: data.contactName,
      pushName: data.pushName
    });

    try {
      // Extrair nome real usando o novo serviço
      const nameData = contactNameService.extractRealContactName(
        data.pushName,
        data.phoneNumber,
        data.firstMessage
      );

      console.log('📝 [TICKETS] Nome extraído:', nameData);

      // Buscar ticket existente com sanitização
      const existingTicket = await supabaseSanitizer.findTicketSafely(data.clientId, data.chatId);

      let customerId: string;

      if (existingTicket) {
        console.log('🔄 [TICKETS] Atualizando ticket existente:', existingTicket.id);
        
        // Atualizar customer se temos um nome melhor
        if (nameData.confidence === 'high' || nameData.confidence === 'medium') {
          await supabaseSanitizer.updateContactSafely(data.clientId, data.phoneNumber, {
            name: nameData.name,
            whatsapp_chat_id: data.chatId,
            updated_at: new Date().toISOString()
          });
        }

        // Atualizar ticket
        const { error: updateError } = await supabase
          .from('conversation_tickets')
          .update({
            title: `Conversa com ${nameData.name}`,
            last_message_preview: data.lastMessage,
            last_message_at: data.lastMessageAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id);

        if (updateError) {
          throw updateError;
        }

        return existingTicket.id;
      }

      // Criar novo customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert({
          client_id: data.clientId,
          name: nameData.name,
          phone: data.phoneNumber,
          whatsapp_chat_id: data.chatId
        }, {
          onConflict: 'client_id,phone'
        })
        .select('id')
        .single();

      if (customerError) {
        throw customerError;
      }

      customerId = customer.id;

      // Criar novo ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('conversation_tickets')
        .insert({
          client_id: data.clientId,
          customer_id: customerId,
          chat_id: data.chatId,
          instance_id: data.instanceId || 'unknown',
          title: `Conversa com ${nameData.name}`,
          status: 'open',
          priority: 1,
          last_message_preview: data.lastMessage,
          last_message_at: data.lastMessageAt
        })
        .select('id')
        .single();

      if (ticketError) {
        throw ticketError;
      }

      console.log('✅ [TICKETS] Ticket criado:', ticket.id);
      return ticket.id;

    } catch (error) {
      console.error('❌ [TICKETS] Erro ao criar/atualizar ticket:', error);
      throw error;
    }
  }

  /**
   * Adicionar mensagem ao ticket com verificação otimizada
   */
  async addTicketMessage(messageData: TicketMessage): Promise<void> {
    console.log('💾 [TICKETS] Adicionando mensagem ao ticket:', {
      ticketId: messageData.ticket_id,
      messageId: messageData.message_id,
      fromMe: messageData.from_me
    });

    try {
      // Verificar se mensagem já existe com sanitização
      const exists = await supabaseSanitizer.checkMessageExists(
        messageData.message_id,
        messageData.ticket_id
      );

      if (exists) {
        console.log('⚠️ [TICKETS] Mensagem já existe, pulando:', messageData.message_id);
        return;
      }

      // Inserir mensagem com retry
      const success = await supabaseSanitizer.insertMessageSafely({
        ticket_id: messageData.ticket_id,
        message_id: messageData.message_id,
        from_me: messageData.from_me || false,
        sender_name: messageData.sender_name || (messageData.from_me ? 'Atendente' : 'Cliente'),
        content: messageData.content,
        message_type: messageData.message_type || 'text',
        timestamp: messageData.timestamp,
        is_internal_note: messageData.is_internal_note || false,
        is_ai_response: messageData.is_ai_response || false,
        processing_status: messageData.processing_status || 'processed',
        media_url: messageData.media_url,
        audio_base64: messageData.audio_base64,
        media_duration: messageData.media_duration,
        media_transcription: messageData.media_transcription
      });

      if (success) {
        console.log('✅ [TICKETS] Mensagem adicionada com sucesso');
      } else {
        console.error('❌ [TICKETS] Falha ao adicionar mensagem após tentativas');
      }

    } catch (error) {
      console.error('❌ [TICKETS] Erro ao adicionar mensagem:', error);
      throw error;
    }
  }

  /**
   * Deletar todos os dados de um cliente (tickets e mensagens)
   */
  async deleteAllClientData(clientId: string): Promise<void> {
    console.warn('🗑️ [RESET] Deletando todos os dados do cliente:', clientId);

    try {
      // 1. Buscar todos os tickets do cliente
      const { data: tickets, error: ticketsError } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId);

      if (ticketsError) {
        throw new Error(`Erro ao buscar tickets: ${ticketsError.message}`);
      }

      const ticketIds = tickets.map(ticket => ticket.id);
      console.log(`🗑️ [RESET] ${ticketIds.length} tickets encontrados`);

      // 2. Deletar todas as mensagens dos tickets
      if (ticketIds.length > 0) {
        const { error: messagesError } = await supabase
          .from('ticket_messages')
          .delete()
          .in('ticket_id', ticketIds);

        if (messagesError) {
          throw new Error(`Erro ao deletar mensagens: ${messagesError.message}`);
        }

        console.log('🗑️ [RESET] Todas as mensagens dos tickets foram deletadas');
      }

      // 3. Deletar todos os tickets do cliente
      const { error: deleteTicketsError } = await supabase
        .from('conversation_tickets')
        .delete()
        .eq('client_id', clientId);

      if (deleteTicketsError) {
        throw new Error(`Erro ao deletar tickets: ${deleteTicketsError.message}`);
      }

      console.log('🗑️ [RESET] Todos os tickets foram deletados');

      // 4. Resetar informações do cliente
      const { error: resetClientError } = await supabase
        .from('customers')
        .update({
          name: 'Cliente Removido',
          email: null,
          phone: null,
          company: null,
          avatar_url: null,
          last_seen: null
        })
        .eq('client_id', clientId);

      if (resetClientError) {
        throw new Error(`Erro ao resetar cliente: ${resetClientError.message}`);
      }

      console.log('🗑️ [RESET] Informações do cliente resetadas');

    } catch (error) {
      console.error('❌ [RESET] Erro ao deletar dados do cliente:', error);
      throw error;
    }
  }

  /**
   * Importar conversas do WhatsApp (método legado)
   */
  async importConversationsFromWhatsApp(clientId: string): Promise<{ success: number; errors: number }> {
    console.warn('⚠️ [LEGACY] Método importConversationsFromWhatsApp está sendo usado');
    return { success: 0, errors: 0 };
  }

  /**
   * Buscar mensagens de um ticket
   */
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return (messages || []) as TicketMessage[];
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      throw error;
    }
  }

  /**
   * Assumir ticket manualmente
   */
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
      console.error('Erro ao remover da fila:', error);
      throw error;
    }
  }

  /**
   * Transferir ticket para outra fila
   */
  async transferTicket(ticketId: string, queueId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({ 
          assigned_queue_id: queueId,
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
  validateAndFixTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}

export const ticketsService = new TicketsService();
export default ticketsService;
