
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ConversationTicket = Tables<"conversation_tickets"> & {
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  assigned_queue_name?: string;
};

export type TicketMessage = Tables<"ticket_messages">;

export interface MessageData {
  message_id: string;
  content: string;
  from_me: boolean;
  timestamp: string;
  message_type?: string;
  media_url?: string | null;
  sender_name?: string;
  is_ai_response?: boolean;
}

export class TicketsService {
  async addMessageToTicket(ticketId: string, messageData: MessageData): Promise<TicketMessage> {
    console.log('💾 Adicionando mensagem ao ticket:', { ticketId, messageData });
    
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticketId,
          message_id: messageData.message_id,
          content: messageData.content,
          from_me: messageData.from_me,
          timestamp: messageData.timestamp,
          message_type: messageData.message_type || 'text',
          media_url: messageData.media_url,
          sender_name: messageData.sender_name,
          is_ai_response: messageData.is_ai_response || false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao adicionar mensagem:', error);
        throw error;
      }

      console.log('✅ Mensagem adicionada com sucesso:', data.id);

      // Atualizar última mensagem do ticket
      await supabase
        .from("conversation_tickets")
        .update({
          last_message_preview: messageData.content.substring(0, 100),
          last_message_at: messageData.timestamp,
          updated_at: new Date().toISOString()
        })
        .eq("id", ticketId);

      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar mensagem no banco:', error);
      throw error;
    }
  }

  async assumeTicketManually(ticketId: string): Promise<void> {
    console.log('👤 Assumindo ticket manualmente:', ticketId);
    
    const { error } = await supabase
      .from("conversation_tickets")
      .update({
        status: 'pending',
        assigned_queue_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", ticketId);

    if (error) {
      console.error('❌ Erro ao assumir ticket:', error);
      throw error;
    }

    console.log('✅ Ticket assumido manualmente');
  }

  async removeTicketFromQueue(ticketId: string): Promise<void> {
    console.log('🚫 Removendo ticket da fila:', ticketId);
    
    const { error } = await supabase
      .from("conversation_tickets")
      .update({
        assigned_queue_id: null,
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq("id", ticketId);

    if (error) {
      console.error('❌ Erro ao remover ticket da fila:', error);
      throw error;
    }

    console.log('✅ Ticket removido da fila');
  }

  async transferTicket(ticketId: string, queueId: string): Promise<void> {
    console.log('🔄 Transferindo ticket para fila:', { ticketId, queueId });
    
    const { error } = await supabase
      .from("conversation_tickets")
      .update({
        assigned_queue_id: queueId,
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq("id", ticketId);

    if (error) {
      console.error('❌ Erro ao transferir ticket:', error);
      throw error;
    }

    console.log('✅ Ticket transferido para fila');
  }

  async updateTicketTags(ticketId: string, tags: string[]): Promise<void> {
    console.log('🏷️ Atualizando tags do ticket:', { ticketId, tags });
    
    const { error } = await supabase
      .from("conversation_tickets")
      .update({
        tags: tags,
        updated_at: new Date().toISOString()
      })
      .eq("id", ticketId);

    if (error) {
      console.error('❌ Erro ao atualizar tags:', error);
      throw error;
    }

    console.log('✅ Tags atualizadas');
  }

  async getClientTickets(clientId: string): Promise<ConversationTicket[]> {
    console.log('🎫 Carregando tickets para cliente:', clientId);
    
    const { data, error } = await supabase
      .from("conversation_tickets")
      .select(`
        *,
        customer:customers(id, name, phone, email)
      `)
      .eq("client_id", clientId)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error('❌ Erro ao carregar tickets:', error);
      throw error;
    }

    console.log(`✅ ${data?.length || 0} tickets carregados`);
    return data || [];
  }

  async getTicketById(ticketId: string): Promise<ConversationTicket> {
    console.log('🔍 Buscando ticket por ID:', ticketId);
    
    const { data, error } = await supabase
      .from("conversation_tickets")
      .select(`
        *,
        customer:customers(id, name, phone, email)
      `)
      .eq("id", ticketId)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar ticket:', error);
      throw error;
    }

    console.log('✅ Ticket encontrado:', data.id);
    return data;
  }

  async getTicketMessages(ticketId: string, limit: number = 50): Promise<TicketMessage[]> {
    console.log('📨 Carregando mensagens do ticket:', { ticketId, limit });
    
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("timestamp", { ascending: true })
      .limit(limit);

    if (error) {
      console.error('❌ Erro ao carregar mensagens:', error);
      throw error;
    }

    console.log(`✅ ${data?.length || 0} mensagens carregadas`);
    return data || [];
  }

  async importConversationsFromWhatsApp(clientId: string) {
    console.log('🔄 Iniciando importação de conversas para cliente:', clientId);
    
    try {
      // Buscar instâncias do cliente
      const instances = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("client_id", clientId);

      if (instances.error) {
        throw instances.error;
      }

      let totalSuccess = 0;
      let totalErrors = 0;

      // URLs para tentar conexão (ordem de prioridade)
      const baseUrls = [
        'https://146.59.227.248',
        'http://localhost:3001', 
        'http://127.0.0.1:3001',
        'https://whatsapp-server.yourdomain.com',
        'http://192.168.1.100:3001'
      ];

      for (const instance of instances.data) {
        console.log('📱 Processando instância:', instance.instance_id);
        
        let connected = false;
        
        for (const baseUrl of baseUrls) {
          const url = `${baseUrl}/chats/${instance.instance_id}`;
          console.log('🌐 Testando URL:', url);
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(3000)
            });

            if (response.ok) {
              const chats = await response.json();
              console.log('✅ Conexão bem-sucedida:', url);
              console.log('💬 Chats encontrados:', chats.length);
              
              // Processar chats...
              connected = true;
              totalSuccess++;
              break;
            }
          } catch (error) {
            console.log(`❌ Falha em ${baseUrl}:`, error);
          }
        }

        if (!connected) {
          console.error('❌ Não foi possível conectar em nenhuma URL para instância', instance.instance_id);
          totalErrors++;
        }
      }

      console.log('✅ Importação concluída:', totalSuccess, 'sucessos,', totalErrors, 'erros');
      return { success: totalSuccess, errors: totalErrors };
    } catch (error) {
      console.error('❌ Erro na importação:', error);
      throw error;
    }
  }

  formatCustomerName(rawName: string, phoneNumber: string): string {
    if (!rawName || rawName.trim() === '' || rawName === phoneNumber) {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        return cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
      return phoneNumber;
    }
    
    return rawName.trim();
  }
}

export const ticketsService = new TicketsService();
