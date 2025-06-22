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

// Função para normalizar números de telefone brasileiros
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  console.log('📞 Normalizando telefone original:', phone);
  
  // Remove todos os caracteres não numéricos
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Remove +55 se presente
  if (cleanPhone.startsWith('55')) {
    cleanPhone = cleanPhone.substring(2);
  }
  
  // Para números com 10 dígitos (sem 9), adiciona o 9
  if (cleanPhone.length === 10 && (cleanPhone.startsWith('47') || cleanPhone.startsWith('48'))) {
    cleanPhone = cleanPhone.slice(0, 2) + '9' + cleanPhone.slice(2);
  }
  
  // Adiciona código do país (55)
  const normalizedPhone = `55${cleanPhone}`;
  
  console.log('📞 Telefone normalizado:', normalizedPhone);
  return normalizedPhone;
}

// Função para formatar nome do cliente
function formatCustomerName(phone: string, name?: string): string {
  console.log('👤 Formatando nome:', { phone, name });
  
  if (name && name.trim() && name !== phone && !name.includes('@') && name !== 'undefined') {
    return name.trim();
  }
  
  // Formatar telefone para exibição
  const normalizedPhone = normalizePhoneNumber(phone);
  if (normalizedPhone.length >= 13) {
    // Formato: +55 (XX) 9XXXX-XXXX
    const formatted = normalizedPhone.replace(/(\d{2})(\d{2})(\d{1})(\d{4})(\d{4})/, '+$1 ($2) $3$4-$5');
    console.log('👤 Nome formatado (telefone):', formatted);
    return formatted;
  }
  
  return phone || 'Contato';
}

class TicketsService {
  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    try {
      console.log('🎫 Buscando tickets para cliente:', clientId);
      
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
        console.error('❌ Erro ao buscar tickets:', error);
        throw error;
      }

      console.log('✅ Tickets encontrados:', data?.length || 0);
      
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
      console.error('❌ Erro ao buscar tickets:', error);
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
      console.error('❌ Erro ao buscar ticket:', error);
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
      console.error('❌ Erro ao buscar mensagens do ticket:', error);
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
        customerPhone: customerPhone.substring(0, 10) + '...',
        lastMessage: lastMessage.substring(0, 50) + '...'
      });

      // Normalizar dados
      const normalizedPhone = normalizePhoneNumber(customerPhone);
      const formattedName = formatCustomerName(normalizedPhone, customerName);

      console.log('📊 Dados processados:', {
        originalPhone: customerPhone,
        normalizedPhone,
        originalName: customerName,
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

      console.log('✅ Ticket criado/atualizado com ID:', data);
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
        content: messageData.content.substring(0, 50) + '...'
      });

      // Verificar se a mensagem já existe
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
      
      console.log('✅ Mensagem adicionada com sucesso');
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
        .select('instance_id, status, phone_number')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (instancesError) {
        console.error('❌ Erro ao buscar instâncias:', instancesError);
        throw instancesError;
      }

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada. Conecte uma instância primeiro.');
      }

      console.log('📱 Instâncias conectadas encontradas:', instances.map(i => ({ id: i.instance_id, phone: i.phone_number })));

      let totalImported = 0;
      let totalErrors = 0;

      // Importar conversas de cada instância
      for (const instance of instances) {
        try {
          console.log(`📥 Importando conversas da instância: ${instance.instance_id}`);
          
          // URL corrigida para o servidor WhatsApp
          const url = `https://146.59.227.248/api/instances/${instance.instance_id}/chats`;
          console.log('🌐 URL de importação:', url);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 30000, // 30 segundos de timeout
          });

          console.log(`📡 Resposta da API:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro HTTP ${response.status} para instância ${instance.instance_id}:`, errorText);
            totalErrors++;
            continue;
          }

          const chats = await response.json();
          console.log(`📊 Chats recebidos da instância ${instance.instance_id}:`, {
            total: Array.isArray(chats) ? chats.length : 'não é array',
            type: typeof chats,
            sample: Array.isArray(chats) && chats.length > 0 ? chats[0] : null
          });
          
          if (Array.isArray(chats) && chats.length > 0) {
            for (const chat of chats) {
              try {
                console.log('💬 Processando chat:', {
                  id: chat.id,
                  name: chat.name,
                  lastMessage: chat.lastMessage?.body?.substring(0, 30)
                });

                // Extrair informações do chat
                const chatId = chat.id || chat.chatId;
                if (!chatId) {
                  console.log('⚠️ Chat sem ID, pulando...');
                  continue;
                }

                // Extrair nome e telefone
                let customerName = chat.name || chat.pushName || chatId.replace('@c.us', '').replace('@g.us', '');
                let customerPhone = chatId.replace('@c.us', '').replace('@g.us', '');

                // Para grupos, usar nome do grupo
                if (chatId.includes('@g.us')) {
                  customerName = chat.name || `Grupo ${customerPhone}`;
                }

                const lastMessage = chat.lastMessage?.body || 
                                  chat.lastMessage?.caption || 
                                  chat.lastMessage?.type || 
                                  'Conversa importada do WhatsApp';

                const lastMessageAt = chat.lastMessage?.timestamp 
                  ? new Date(chat.lastMessage.timestamp * 1000).toISOString()
                  : new Date().toISOString();

                console.log('📝 Dados extraídos do chat:', {
                  chatId,
                  customerName,
                  customerPhone,
                  lastMessage: lastMessage.substring(0, 30),
                  lastMessageAt
                });

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
                console.log(`✅ Chat ${chatId} importado com sucesso`);
              } catch (chatError) {
                console.error(`❌ Erro ao processar chat:`, chatError);
                totalErrors++;
              }
            }
          } else {
            console.log(`ℹ️ Nenhum chat válido encontrado na instância ${instance.instance_id}`);
          }
        } catch (instanceError) {
          console.error(`❌ Erro ao processar instância ${instance.instance_id}:`, instanceError);
          totalErrors++;
        }
      }

      const result = {
        success: totalImported,
        errors: totalErrors,
        total_instances: instances.length
      };

      console.log('🎉 Importação concluída:', result);
      return result;
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
