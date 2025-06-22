import { supabase } from "@/integrations/supabase/client";
import { customersService } from "./customersService";

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
    return data || [];
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
    return data;
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
      // Verificar se já existe um ticket para este chat_id
      const { data: existingTicket, error: selectError } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Erro ao verificar ticket existente:', selectError);
        throw selectError;
      }

      if (existingTicket) {
        // Atualizar ticket existente
        const { error: updateError } = await supabase
          .from('conversation_tickets')
          .update({
            instance_id: instanceId,
            title: title,
            last_message_preview: lastMessage,
            last_message_at: lastMessageTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id);

        if (updateError) {
          console.error('Erro ao atualizar ticket:', updateError);
          throw updateError;
        }

        console.log(`Ticket atualizado: ${existingTicket.id}`);
        return existingTicket.id;
      } else {
        // Criar novo ticket
        const { data: newTicket, error: insertError } = await supabase
          .from('conversation_tickets')
          .insert({
            client_id: clientId,
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

        console.log(`Ticket criado: ${newTicket.id}`);
        return newTicket.id;
      }
    } catch (error) {
      console.error('Erro ao criar ou atualizar ticket:', error);
      throw error;
    }
  },

  async getTicketMessages(ticketId: string, limit: number = 50): Promise<TicketMessage[]> {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async addTicketMessage(message: Omit<TicketMessage, 'id'>): Promise<TicketMessage> {
    const { data, error } = await supabase
      .from('ticket_messages')
      .insert(message)
      .select('*')
      .single();

    if (error) throw error;
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

  normalizePhoneNumber(phoneNumber: string): string {
    let cleanedNumber = phoneNumber.replace(/\D/g, '');

    if (cleanedNumber.length < 10) {
      return cleanedNumber;
    }

    if (cleanedNumber.startsWith('55')) {
      cleanedNumber = cleanedNumber.slice(2);
    }

    return cleanedNumber;
  },

  formatPhoneForDisplay(phoneNumber: string): string {
    const cleanedNumber = this.normalizePhoneNumber(phoneNumber);

    if (cleanedNumber.length === 10) {
      return cleanedNumber.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleanedNumber.length === 11) {
      return cleanedNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    return phoneNumber;
  },

  validateAndFixTimestamp(timestamp: any): string {
    if (!timestamp) {
      return new Date().toISOString();
    }

    let date: Date;

    if (typeof timestamp === 'number') {
      if (timestamp.toString().length === 10) {
        date = new Date(timestamp * 1000);
      } else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return new Date().toISOString();
    }

    if (isNaN(date.getTime()) || date.getFullYear() > 2030) {
      return new Date().toISOString();
    }

    return date.toISOString();
  },

  async importConversationsFromWhatsApp(clientId: string): Promise<{ success: number; errors: number }> {
    try {
      console.log('🔄 Iniciando importação de conversas para cliente:', clientId);
      
      // Buscar instâncias ativas do cliente
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, phone_number')
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

      // Testar múltiplas URLs do servidor WhatsApp
      const possibleUrls = [
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'https://whatsapp-server.yourdomain.com',
        'http://192.168.1.100:3001'
      ];

      for (const instance of instances) {
        console.log(`📱 Processando instância: ${instance.instance_id}`);
        
        let chatsData = null;
        let serverUrl = null;

        // Tentar cada URL até encontrar uma que funcione
        for (const url of possibleUrls) {
          try {
            console.log(`🌐 Testando URL: ${url}/chats/${instance.instance_id}`);
            
            const response = await fetch(`${url}/chats/${instance.instance_id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(10000) // 10 segundos timeout
            });

            if (response.ok) {
              const data = await response.json();
              if (data && (Array.isArray(data) || (data.chats && Array.isArray(data.chats)))) {
                chatsData = Array.isArray(data) ? data : data.chats;
                serverUrl = url;
                console.log(`✅ Conectado com sucesso em: ${url}`);
                break;
              }
            }
          } catch (error) {
            console.log(`❌ Falha em ${url}:`, error);
            continue;
          }
        }

        if (!chatsData || !serverUrl) {
          console.error(`❌ Não foi possível conectar em nenhuma URL para instância ${instance.instance_id}`);
          totalErrors++;
          continue;
        }

        console.log(`📊 ${chatsData.length} conversas encontradas para ${instance.instance_id}`);

        // Processar cada conversa
        for (const chat of chatsData) {
          try {
            const chatId = chat.id?.user || chat.id?._serialized || chat.chatId || chat.id;
            
            if (!chatId) {
              console.log('⚠️ Chat sem ID válido, pulando...');
              totalErrors++;
              continue;
            }

            // Extrair nome do contato com múltiplas estratégias
            let contactName = 'Contato sem nome';
            
            // Estratégia 1: Nome direto do chat
            if (chat.name && chat.name.trim() && !chat.name.includes('@')) {
              contactName = chat.name.trim();
            }
            // Estratégia 2: pushName da última mensagem
            else if (chat.lastMessage?.author || chat.lastMessage?.pushName) {
              const authorName = chat.lastMessage.author || chat.lastMessage.pushName;
              if (authorName && !authorName.includes('@') && !authorName.match(/^\d+$/)) {
                contactName = authorName.trim();
              }
            }
            // Estratégia 3: Nome do contato da agenda
            else if (chat.contact?.name || chat.contact?.pushname) {
              const phoneName = chat.contact.name || chat.contact.pushname;
              if (phoneName && !phoneName.includes('@') && !phoneName.match(/^\d+$/)) {
                contactName = phoneName.trim();
              }
            }
            // Estratégia 4: Buscar perfil completo via API para obter nome da imagem
            else {
              try {
                const profileResponse = await fetch(`${serverUrl}/contact/${instance.instance_id}/${chatId}`, {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' },
                  signal: AbortSignal.timeout(5000)
                });
                
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  console.log(`👤 Dados do perfil para ${chatId}:`, profileData);
                  
                  // Tentar extrair nome do perfil
                  const profileName = profileData.name || 
                                    profileData.pushname || 
                                    profileData.notify || 
                                    profileData.verifiedName ||
                                    profileData.businessProfile?.name;
                  
                  if (profileName && !profileName.includes('@') && !profileName.match(/^\d+$/)) {
                    contactName = profileName.trim();
                    console.log(`✅ Nome obtido do perfil: ${contactName}`);
                  }
                }
              } catch (profileError) {
                console.log(`⚠️ Não foi possível obter perfil para ${chatId}:`, profileError);
              }
            }

            // Extrair e normalizar número de telefone
            const phoneNumber = this.normalizePhoneNumber(chatId);
            
            // Formatar nome final
            const finalName = this.formatCustomerName(contactName, phoneNumber);

            // Preparar última mensagem
            const lastMessage = chat.lastMessage?.body || 
                              chat.lastMessage?.content || 
                              chat.lastMessage?.text ||
                              (chat.lastMessage?.type !== 'text' ? `[${chat.lastMessage?.type || 'Mídia'}]` : '') ||
                              'Sem mensagens';

            const lastMessageTime = this.validateAndFixTimestamp(
              chat.lastMessage?.timestamp || 
              chat.lastMessage?.t || 
              chat.timestamp || 
              Date.now()
            );

            console.log(`💾 Salvando conversa: ${finalName} (${phoneNumber})`);

            // Criar ou atualizar ticket
            const ticketId = await this.createOrUpdateTicket(
              clientId,
              chatId,
              instance.instance_id,
              finalName,
              phoneNumber,
              lastMessage,
              lastMessageTime
            );

            // Buscar ou criar cliente
            let customer = await customersService.findByPhone(clientId, phoneNumber);
            if (!customer) {
              customer = await customersService.createCustomer({
                client_id: clientId,
                name: finalName,
                phone: phoneNumber,
                whatsapp_chat_id: chatId
              });
              console.log(`👤 Cliente criado: ${customer.name}`);
            } else if (customer.name !== finalName && !customer.name.startsWith('Contato ')) {
              // Atualizar nome se encontramos um nome melhor
              await customersService.updateCustomer(customer.id, {
                name: finalName,
                whatsapp_chat_id: chatId
              });
              console.log(`👤 Cliente atualizado: ${finalName}`);
            }

            totalSuccess++;

          } catch (chatError) {
            console.error('❌ Erro ao processar chat:', chat, chatError);
            totalErrors++;
          }
        }
      }

      console.log(`✅ Importação concluída: ${totalSuccess} sucessos, ${totalErrors} erros`);
      return { success: totalSuccess, errors: totalErrors };

    } catch (error) {
      console.error('❌ Erro na importação:', error);
      throw error;
    }
  },

  // Função para formatar nome do cliente
  formatCustomerName(rawName: string, phoneNumber: string): string {
    if (!rawName || rawName.trim() === '') {
      return this.formatPhoneForDisplay(phoneNumber);
    }

    const cleanName = rawName.trim();
    
    // Se é apenas um número, usar formato de telefone
    if (/^\d+$/.test(cleanName)) {
      return this.formatPhoneForDisplay(phoneNumber);
    }
    
    // Se contém @ (email), usar telefone
    if (cleanName.includes('@')) {
      return this.formatPhoneForDisplay(phoneNumber);
    }
    
    // Se é muito curto (menos de 2 caracteres), usar telefone
    if (cleanName.length < 2) {
      return this.formatPhoneForDisplay(phoneNumber);
    }
    
    // Se parece com um ID de usuário, usar telefone
    if (cleanName.startsWith('user_') || cleanName.startsWith('contact_')) {
      return this.formatPhoneForDisplay(phoneNumber);
    }
    
    // Nome válido - capitalizar primeira letra de cada palavra
    return cleanName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  // Função para formatar número de telefone para exibição
  formatPhoneNumber(phoneNumber: string): string {
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phoneNumber;
  },
};
