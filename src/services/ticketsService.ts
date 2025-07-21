
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

  // NOVO: Limpar tickets antigos
  async clearOldTickets(clientId: string, olderThanDays: number = 30): Promise<{ deletedTickets: number; deletedMessages: number }> {
    try {
      console.log(`🧹 [CLEANUP] Limpando tickets com mais de ${olderThanDays} dias para cliente: ${clientId}`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffISOString = cutoffDate.toISOString();
      
      // Buscar tickets antigos para ter os IDs
      const { data: oldTickets, error: fetchError } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .lt('created_at', cutoffISOString);

      if (fetchError) {
        console.error('❌ [CLEANUP] Erro ao buscar tickets antigos:', fetchError);
        throw fetchError;
      }

      const ticketIds = (oldTickets || []).map(ticket => ticket.id);
      
      if (ticketIds.length === 0) {
        console.log('✅ [CLEANUP] Nenhum ticket antigo encontrado');
        return { deletedTickets: 0, deletedMessages: 0 };
      }

      // Deletar mensagens dos tickets antigos primeiro
      const { error: messagesError, count: deletedMessages } = await supabase
        .from('ticket_messages')
        .delete({ count: 'exact' })
        .in('ticket_id', ticketIds);

      if (messagesError) {
        console.error('❌ [CLEANUP] Erro ao deletar mensagens:', messagesError);
        throw messagesError;
      }

      // Deletar tickets antigos
      const { error: ticketsError, count: deletedTickets } = await supabase
        .from('conversation_tickets')
        .delete({ count: 'exact' })
        .in('id', ticketIds);

      if (ticketsError) {
        console.error('❌ [CLEANUP] Erro ao deletar tickets:', ticketsError);
        throw ticketsError;
      }

      console.log(`✅ [CLEANUP] Removidos: ${deletedTickets} tickets e ${deletedMessages} mensagens`);
      
      return { 
        deletedTickets: deletedTickets || 0, 
        deletedMessages: deletedMessages || 0 
      };

    } catch (error) {
      console.error('❌ [CLEANUP] Erro na limpeza:', error);
      throw error;
    }
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

  // CORRIGIDO E MELHORADO: Importação inteligente com opções de limpeza
  async importConversationsFromWhatsApp(
    clientId: string, 
    options: {
      clearOldData?: boolean;
      importMessages?: boolean;
      onProgress?: (progress: { current: number; total: number; message: string }) => void;
    } = {}
  ): Promise<{ success: number; errors: number; details: string[] }> {
    const { clearOldData = false, importMessages = true, onProgress } = options;
    const details: string[] = [];
    
    try {
      console.log('🚀 [IMPORT] Iniciando importação inteligente CodeChat v1.3.0');
      details.push('🚀 Iniciando importação inteligente...');
      
      onProgress?.({ current: 0, total: 100, message: 'Verificando instâncias...' });

      // FASE 1: Limpeza opcional de dados antigos
      if (clearOldData) {
        onProgress?.({ current: 5, total: 100, message: 'Limpando dados antigos...' });
        
        try {
          const cleanupResult = await this.clearOldTickets(clientId, 7); // Limpar tickets com mais de 7 dias
          details.push(`🧹 Dados antigos removidos: ${cleanupResult.deletedTickets} tickets, ${cleanupResult.deletedMessages} mensagens`);
          console.log('🧹 [IMPORT] Limpeza de dados antigos concluída:', cleanupResult);
        } catch (cleanupError) {
          console.warn('⚠️ [IMPORT] Erro na limpeza (continuando):', cleanupError);
          details.push('⚠️ Erro na limpeza de dados antigos (continuando...)');
        }
      }

      // FASE 2: Buscar instâncias ativas
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, phone_number, yumer_instance_name, auth_token')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (instancesError) {
        console.error('❌ [IMPORT] Erro ao buscar instâncias:', instancesError);
        throw new Error('Falha ao buscar instâncias WhatsApp');
      }

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada');
      }

      details.push(`📱 ${instances.length} instância(s) conectada(s) encontrada(s)`);
      console.log(`📱 [IMPORT] ${instances.length} instâncias encontradas`);

      let totalSuccess = 0;
      let totalErrors = 0;

      // FASE 3: Processar cada instância
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        const instanceProgress = 20 + (i / instances.length) * 60; // 20% a 80%
        
        onProgress?.({ 
          current: instanceProgress, 
          total: 100, 
          message: `Processando instância ${i + 1}/${instances.length}...` 
        });

        console.log(`📱 [IMPORT] Processando instância: ${instance.instance_id}`);
        details.push(`📱 Processando: ${instance.instance_id}`);
        
        try {
          // Configurar autenticação se disponível
          if (instance.auth_token && instance.yumer_instance_name) {
            codeChatApiService.setInstanceToken(instance.yumer_instance_name, instance.auth_token);
          }
          
          const instanceName = instance.yumer_instance_name || instance.instance_id;
          
          // FASE 4: Buscar chats com estratégia inteligente
          const chats = await codeChatApiService.findChats(instanceName, {
            limit: 50, // Processar apenas 50 conversas mais relevantes
            useMessages: true, // Usar estratégia alternativa se necessário
            onProgress: (current, total) => {
              const chatProgress = instanceProgress + (current / total) * (60 / instances.length);
              onProgress?.({ 
                current: chatProgress, 
                total: 100, 
                message: `Analisando chat ${current}/${total} na instância ${i + 1}...` 
              });
            }
          });

          console.log(`📊 [IMPORT] ${chats.length} chats válidos encontrados para ${instanceName}`);
          details.push(`📊 ${chats.length} conversas válidas encontradas`);

          if (chats.length === 0) {
            details.push(`⚠️ Nenhuma conversa válida na instância ${instanceName}`);
            continue;
          }

          // FASE 5: Processar cada chat válido
          for (let j = 0; j < chats.length; j++) {
            const chat = chats[j];
            
            const chatProgress = instanceProgress + ((j + 1) / chats.length) * (60 / instances.length);
            onProgress?.({ 
              current: chatProgress, 
              total: 100, 
              message: `Importando conversa ${j + 1}/${chats.length}: ${chat.name}` 
            });

            try {
              console.log(`💾 [IMPORT] Processando conversa: ${chat.name} (${chat.id})`);

              // Usar o phoneNumber já extraído e validado pelo findChats
              const phoneNumber = chat.id; // findChats já retorna o número como ID
              const contactName = chat.name;
              const lastMessage = chat.lastMessage || 'Conversa importada do WhatsApp';
              const lastMessageTime = this.validateAndFixTimestamp(chat.lastMessageTime || Date.now());

              // Criar ou atualizar ticket
              const ticketId = await this.createOrUpdateTicket(
                clientId,
                phoneNumber, // Usar como chat_id também
                instance.instance_id,
                contactName,
                phoneNumber,
                lastMessage,
                lastMessageTime
              );

              // Importar mensagens se solicitado
              if (importMessages) {
                try {
                  await this.importChatMessages(instanceName, phoneNumber, ticketId, 10);
                  console.log(`📨 [IMPORT] Mensagens importadas para: ${contactName}`);
                } catch (messageError) {
                  console.warn(`⚠️ [IMPORT] Falha ao importar mensagens para ${phoneNumber}:`, messageError);
                  details.push(`⚠️ Erro ao importar mensagens de ${contactName}`);
                }
              }

              totalSuccess++;
              console.log(`✅ [IMPORT] Conversa importada: ${contactName}`);

            } catch (chatError) {
              console.error(`❌ [IMPORT] Erro ao processar conversa ${chat.id}:`, chatError);
              details.push(`❌ Erro ao processar: ${chat.name}`);
              totalErrors++;
            }
          }

        } catch (instanceError) {
          console.error(`❌ [IMPORT] Erro ao processar instância ${instance.instance_id}:`, instanceError);
          details.push(`❌ Erro na instância: ${instance.instance_id}`);
          totalErrors++;
        }
      }

      onProgress?.({ current: 100, total: 100, message: 'Importação concluída!' });

      const summary = `✅ Importação concluída: ${totalSuccess} sucessos, ${totalErrors} erros`;
      console.log(`🎉 [IMPORT] ${summary}`);
      details.push(summary);

      return { 
        success: totalSuccess, 
        errors: totalErrors,
        details 
      };

    } catch (error) {
      console.error('❌ [IMPORT] Erro crítico na importação:', error);
      details.push(`❌ Erro crítico: ${error}`);
      throw error;
    }
  },

  // CORRIGIDO: Importar mensagens específicas de um chat com validação robusta
  async importChatMessages(instanceName: string, chatId: string, ticketId: string, limit: number = 15): Promise<void> {
    try {
      console.log(`📨 [IMPORT] Importando mensagens para chat ${chatId} (limite: ${limit})`);
      
      // Construir remoteJid correto para busca
      const remoteJidFormats = [
        `${chatId}@s.whatsapp.net`,
        `${chatId}@c.us`,
        chatId
      ];
      
      let messages: any[] = [];
      
      // Tentar diferentes formatos de remoteJid
      for (const remoteJid of remoteJidFormats) {
        try {
          const foundMessages = await codeChatApiService.findMessages(instanceName, remoteJid, limit);
          if (foundMessages.length > 0) {
            messages = foundMessages;
            console.log(`📨 [IMPORT] ${messages.length} mensagens encontradas com remoteJid: ${remoteJid}`);
            break;
          }
        } catch (error) {
          console.log(`⚠️ [IMPORT] Tentativa com ${remoteJid} falhou:`, error);
        }
      }

      if (messages.length === 0) {
        console.log(`📨 [IMPORT] Nenhuma mensagem encontrada para chat ${chatId}`);
        return;
      }

      console.log(`📨 [IMPORT] Processando ${messages.length} mensagens para importação`);

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        try {
          // Verificar se mensagem já existe
          const { data: existingMessage } = await supabase
            .from('ticket_messages')
            .select('id')
            .eq('message_id', message.keyId)
            .eq('ticket_id', ticketId)
            .single();

          if (existingMessage) {
            console.log(`⏭️ [IMPORT] Mensagem ${message.keyId} já existe, pulando...`);
            continue;
          }

          // Converter timestamp com validação
          const timestamp = this.validateAndFixTimestamp(message.messageTimestamp * 1000);

          // Extrair conteúdo da mensagem com fallback seguro
          let content = '';
          try {
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
          } catch (contentError) {
            console.error(`❌ [IMPORT] Erro ao extrair conteúdo da mensagem ${message.keyId}:`, contentError);
            content = `[Erro ao processar conteúdo]`;
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

          console.log(`✅ [IMPORT] Mensagem ${i + 1}/${messages.length} importada: ${message.keyId}`);
        } catch (messageError) {
          console.error(`❌ [IMPORT] Erro ao importar mensagem ${message.keyId}:`, messageError);
        }
      }
      
      console.log(`✅ [IMPORT] Importação de mensagens concluída para chat ${chatId}`);
    } catch (error) {
      console.error(`❌ [IMPORT] Erro ao importar mensagens do chat ${chatId}:`, error);
      throw error;
    }
  }
};
