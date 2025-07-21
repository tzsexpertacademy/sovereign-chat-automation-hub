
import { supabase } from "@/integrations/supabase/client";
import { customersService } from "./customersService";
import { codeChatApiService } from "./codechatApiService";

export interface ConversationTicket {
  id: string;
  client_id: string;
  chat_id: string;
  instance_id: string;
  title: string;
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_preview: string;
  customer_id?: string;
  assigned_queue_id?: string;
  assigned_assistant_id?: string;
  tags?: string[];
  customer?: {
    id: string;
    client_id: string;
    name: string;
    phone: string;
  };
  assigned_queue_name?: string;
}

export interface TicketMessage {
  id: string;
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
}

export const ticketsService = {
  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    const { data, error } = await supabase
      .from('conversation_tickets')
      .select(`
        *,
        customer: customers (*)
      `)
      .eq('client_id', clientId)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    
    // Converter tags do tipo Json para string[]
    const normalizedData = (data || []).map(ticket => ({
      ...ticket,
      tags: Array.isArray(ticket.tags) ? ticket.tags : 
            (ticket.tags ? [ticket.tags] : [])
    }));
    
    return normalizedData as ConversationTicket[];
  },

  async getTicketById(ticketId: string): Promise<ConversationTicket | null> {
    const { data, error } = await supabase
      .from('conversation_tickets')
      .select(`
        *,
        customer: customers (*)
      `)
      .eq('id', ticketId)
      .single();

    if (error) throw error;
    
    // Normalizar tags
    const normalizedTicket = {
      ...data,
      tags: Array.isArray(data.tags) ? data.tags : 
            (data.tags ? [data.tags] : [])
    };
    
    return normalizedTicket as ConversationTicket;
  },

  async createOrUpdateTicket(
    clientId: string,
    chatId: string,
    instanceId: string,
    title: string,
    phoneNumber: string,
    lastMessage: string,
    lastMessageTime: string
  ): Promise<string> {
    try {
      console.log('🎫 Criando/atualizando ticket:', {
        clientId,
        chatId,
        title,
        phoneNumber
      });

      // Verificar se já existe um ticket para este chat_id
      const { data: existingTicket, error: selectError } = await supabase
        .from('conversation_tickets')
        .select('id, customer_id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Erro ao verificar ticket existente:', selectError);
        throw selectError;
      }

      // Buscar ou criar cliente
      let customer = await customersService.findByPhone(clientId, phoneNumber);
      if (!customer) {
        customer = await customersService.createCustomer({
          client_id: clientId,
          name: title,
          phone: phoneNumber,
          whatsapp_chat_id: chatId
        });
        console.log('👤 Cliente criado:', customer.name);
      } else {
        // Atualizar nome se encontramos um nome melhor
        if (customer.name !== title && !customer.name.startsWith('Contato ') && title !== customer.phone) {
          await customersService.updateCustomer(customer.id, {
            name: title,
            whatsapp_chat_id: chatId
          });
          console.log('👤 Cliente atualizado:', title);
        }
      }

      if (existingTicket) {
        // Atualizar ticket existente
        const { error: updateError } = await supabase
          .from('conversation_tickets')
          .update({
            instance_id: instanceId,
            title: title,
            customer_id: customer.id,
            last_message_preview: lastMessage,
            last_message_at: lastMessageTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id);

        if (updateError) {
          console.error('Erro ao atualizar ticket:', updateError);
          throw updateError;
        }

        console.log(`✅ Ticket atualizado: ${existingTicket.id}`);
        return existingTicket.id;
      } else {
        // Criar novo ticket
        const { data: newTicket, error: insertError } = await supabase
          .from('conversation_tickets')
          .insert({
            client_id: clientId,
            customer_id: customer.id,
            chat_id: chatId,
            instance_id: instanceId,
            title: title,
            status: 'open',
            priority: 1,
            last_message_preview: lastMessage,
            last_message_at: lastMessageTime
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Erro ao criar ticket:', insertError);
          throw insertError;
        }

        console.log(`✅ Ticket criado: ${newTicket.id}`);
        return newTicket.id;
      }
    } catch (error) {
      console.error('❌ Erro ao criar ou atualizar ticket:', error);
      throw error;
    }
  },

  async getTicketMessages(ticketId: string, limit: number = 50): Promise<TicketMessage[]> {
    console.log('📨 Carregando mensagens do ticket:', ticketId);
    
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('❌ Erro ao carregar mensagens:', error);
      throw error;
    }
    
    console.log(`📨 ${data?.length || 0} mensagens carregadas para ticket ${ticketId}`);
    return data || [];
  },

  async addTicketMessage(message: Omit<TicketMessage, 'id'>): Promise<TicketMessage> {
    console.log('💾 Salvando mensagem no ticket:', {
      ticketId: message.ticket_id,
      messageId: message.message_id,
      fromMe: message.from_me,
      content: message.content.substring(0, 50)
    });

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert(message)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Erro ao salvar mensagem:', error);
      throw error;
    }
    
    console.log('✅ Mensagem salva com sucesso');
    return data;
  },

  async updateTicketStatus(ticketId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async assignTicketToQueue(ticketId: string, queueId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({ assigned_queue_id: queueId, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async removeTicketFromQueue(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({ assigned_queue_id: null, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async updateTicketTags(ticketId: string, tags: string[]): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({ tags: tags, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async assumeTicketManually(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({ 
        status: 'pending',
        assigned_queue_id: null,
        assigned_assistant_id: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  async transferTicket(ticketId: string, queueId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_tickets')
      .update({ 
        assigned_queue_id: queueId,
        status: 'open',
        updated_at: new Date().toISOString() 
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  normalizePhoneNumber(phoneNumber: string): string {
    return codeChatApiService.normalizePhoneNumber(phoneNumber);
  },

  formatPhoneForDisplay(phoneNumber: string): string {
    return codeChatApiService.formatPhoneForDisplay(phoneNumber);
  },

  validateAndFixTimestamp(timestamp: any): string {
    console.log('🕐 Validando timestamp:', timestamp);
    
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    let date: Date;
    
    if (typeof timestamp === 'number') {
      // Se for um número, verificar se está em segundos ou milissegundos
      if (timestamp.toString().length === 10) {
        // Segundos - converter para milissegundos
        date = new Date(timestamp * 1000);
      } else if (timestamp.toString().length === 13) {
        // Milissegundos
        date = new Date(timestamp);
      } else {
        // Timestamp inválido, usar data atual
        console.log('⚠️ Timestamp numérico inválido:', timestamp);
        date = new Date();
      }
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      console.log('⚠️ Tipo de timestamp desconhecido:', typeof timestamp);
      date = new Date();
    }
    
    // Verificar se a data é válida e não está no futuro distante
    if (isNaN(date.getTime()) || date.getFullYear() > 2030) {
      console.log('⚠️ Data inválida ou muito futura, usando data atual');
      date = new Date();
    }
    
    // Verificar se a data não é muito antiga (antes de 2020)
    if (date.getFullYear() < 2020) {
      console.log('⚠️ Data muito antiga, usando data atual');
      date = new Date();
    }
    
    const validTimestamp = date.toISOString();
    console.log('✅ Timestamp validado:', validTimestamp);
    return validTimestamp;
  },

  // NOVO: Importação usando CodeChat API v1.3.0
  async importConversationsFromWhatsApp(clientId: string): Promise<{ success: number; errors: number }> {
    try {
      console.log('🔄 Iniciando importação de conversas CodeChat v1.3.0 para cliente:', clientId);
      
      // Buscar instâncias ativas do cliente
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, phone_number, yumer_instance_name, auth_token')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (instancesError) {
        console.error('❌ Erro ao buscar instâncias:', instancesError);
        throw new Error('Falha ao buscar instâncias WhatsApp');
      }

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada');
      }

      let totalSuccess = 0;
      let totalErrors = 0;

      for (const instance of instances) {
        console.log(`📱 Processando instância: ${instance.instance_id}`);
        
        try {
          // Configurar autenticação se disponível
          if (instance.auth_token && instance.yumer_instance_name) {
            codeChatApiService.setInstanceToken(instance.yumer_instance_name, instance.auth_token);
          }
          
          // Usar o yumer_instance_name ou fallback para instance_id
          const instanceName = instance.yumer_instance_name || instance.instance_id;
          
          // Buscar chats usando CodeChat API v1.3.0
          const chats = await codeChatApiService.findChats(instanceName);
          console.log(`📊 ${chats.length} conversas encontradas para ${instanceName}`);

          // Processar cada conversa
          for (const chat of chats) {
            try {
              const chatId = chat.id;
              
              if (!chatId) {
                console.log('⚠️ Chat sem ID válido, pulando...');
                totalErrors++;
                continue;
              }

              // Extrair nome do contato
              const contactName = codeChatApiService.extractContactName(chat, chatId);
              
              // Extrair e normalizar número de telefone
              const phoneNumber = this.normalizePhoneNumber(chatId);
              
              // Preparar última mensagem
              const lastMessage = chat.lastMessage || 'Conversa importada do WhatsApp';
              const lastMessageTime = this.validateAndFixTimestamp(chat.lastMessageTime || Date.now());

              console.log(`💾 Salvando conversa: ${contactName} (${phoneNumber})`);

              // Criar ou atualizar ticket
              const ticketId = await this.createOrUpdateTicket(
                clientId,
                chatId,
                instance.instance_id,
                contactName,
                phoneNumber,
                lastMessage,
                lastMessageTime
              );

              // Opcionalmente, importar histórico de mensagens
              try {
                await this.importChatMessages(instanceName, chatId, ticketId);
              } catch (messageError) {
                console.warn(`⚠️ Falha ao importar mensagens para chat ${chatId}:`, messageError);
              }

              totalSuccess++;

            } catch (chatError) {
              console.error('❌ Erro ao processar chat:', chat, chatError);
              totalErrors++;
            }
          }
        } catch (instanceError) {
          console.error(`❌ Erro ao processar instância ${instance.instance_id}:`, instanceError);
          totalErrors++;
        }
      }

      console.log(`✅ Importação concluída: ${totalSuccess} sucessos, ${totalErrors} erros`);
      return { success: totalSuccess, errors: totalErrors };

    } catch (error) {
      console.error('❌ Erro na importação:', error);
      throw error;
    }
  },

  // NOVO: Importar mensagens específicas de um chat
  async importChatMessages(instanceName: string, chatId: string, ticketId: string, limit: number = 20): Promise<void> {
    try {
      console.log(`📨 Importando mensagens para chat ${chatId} (limite: ${limit})`);
      
      const messages = await codeChatApiService.findMessages(instanceName, chatId, limit);
      console.log(`📨 ${messages.length} mensagens encontradas para importação`);

      for (const message of messages) {
        try {
          // Verificar se mensagem já existe
          const { data: existingMessage } = await supabase
            .from('ticket_messages')
            .select('id')
            .eq('message_id', message.keyId)
            .eq('ticket_id', ticketId)
            .single();

          if (existingMessage) {
            console.log(`⏭️ Mensagem ${message.keyId} já existe, pulando...`);
            continue;
          }

          // Converter timestamp
          const timestamp = this.validateAndFixTimestamp(message.messageTimestamp * 1000);

          // Extrair conteúdo da mensagem
          let content = '';
          if (typeof message.content === 'string') {
            content = message.content;
          } else if (message.content && typeof message.content === 'object') {
            content = message.content.text || 
                     message.content.body || 
                     message.content.caption || 
                     `[${message.messageType}]`;
          } else {
            content = `[${message.messageType}]`;
          }

          // Criar mensagem no ticket
          await this.addTicketMessage({
            ticket_id: ticketId,
            message_id: message.keyId,
            from_me: message.keyFromMe,
            sender_name: message.pushName || (message.keyFromMe ? 'Você' : 'Cliente'),
            content: content,
            message_type: message.messageType,
            timestamp: timestamp,
            is_internal_note: false,
            is_ai_response: false,
            processing_status: 'processed'
          });

          console.log(`✅ Mensagem ${message.keyId} importada com sucesso`);
        } catch (messageError) {
          console.error(`❌ Erro ao importar mensagem ${message.keyId}:`, messageError);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao importar mensagens do chat ${chatId}:`, error);
      throw error;
    }
  }
};
