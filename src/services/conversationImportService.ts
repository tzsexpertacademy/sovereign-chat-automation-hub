
import { supabase } from "@/integrations/supabase/client";
import { whatsappInstanceManager } from "./whatsappInstanceManager";
import { contactNameService } from "./contactNameService";

interface ImportProgress {
  current: number;
  total: number;
  status: string;
  errors: string[];
}

interface ImportResult {
  success: number;
  errors: number;
  duplicates: number;
  details: string[];
}

/**
 * Serviço de Importação de Conversas
 * Usa LOCAL FIRST approach - instâncias locais + API externa para dados
 */
export class ConversationImportService {
  
  /**
   * Importar conversas do WhatsApp para um cliente
   */
  async importConversationsFromWhatsApp(
    clientId: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    console.log('🚀 [IMPORT] Iniciando importação para cliente:', clientId);
    
    const result: ImportResult = {
      success: 0,
      errors: 0,
      duplicates: 0,
      details: []
    };

    try {
      // 1. Verificar se cliente tem instâncias válidas (LOCAL)
      const hasValidInstances = await whatsappInstanceManager.hasValidInstancesForImport(clientId);
      
      if (!hasValidInstances) {
        throw new Error('Nenhuma instância WhatsApp ativa encontrada para este cliente. Conecte uma instância primeiro.');
      }

      // 2. Buscar instâncias ativas (LOCAL)
      const instances = await whatsappInstanceManager.getActiveClientInstances(clientId);
      
      onProgress?.({
        current: 0,
        total: instances.length,
        status: `Encontradas ${instances.length} instâncias ativas`,
        errors: []
      });

      // 3. Processar cada instância
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        
        onProgress?.({
          current: i,
          total: instances.length,
          status: `Processando instância: ${instance.custom_name || instance.instance_id}`,
          errors: result.details
        });

        try {
          const instanceResult = await this.importFromInstance(clientId, instance);
          
          result.success += instanceResult.success;
          result.errors += instanceResult.errors;
          result.duplicates += instanceResult.duplicates;
          result.details.push(...instanceResult.details);
          
        } catch (error: any) {
          console.error(`❌ [IMPORT] Erro na instância ${instance.instance_id}:`, error);
          result.errors++;
          result.details.push(`Erro na instância ${instance.custom_name}: ${error.message}`);
        }
      }

      onProgress?.({
        current: instances.length,
        total: instances.length,
        status: 'Importação concluída',
        errors: result.details.filter(d => d.includes('Erro'))
      });

      console.log('✅ [IMPORT] Importação concluída:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [IMPORT] Erro crítico na importação:', error);
      throw new Error(`Falha na importação: ${error.message}`);
    }
  }

  /**
   * Importar conversas de uma instância específica
   */
  private async importFromInstance(
    clientId: string, 
    instance: any
  ): Promise<ImportResult> {
    console.log('📡 [IMPORT] Processando instância:', instance.instance_id);

    const result: ImportResult = {
      success: 0,
      errors: 0,
      duplicates: 0,
      details: []
    };

    try {
      // 1. Buscar chats da instância (API externa)
      const chats = await whatsappInstanceManager.getInstanceChats(instance.instance_id, 100);
      
      if (chats.length === 0) {
        result.details.push(`Instância ${instance.custom_name}: Nenhum chat encontrado`);
        return result;
      }

      console.log(`📊 [IMPORT] Processando ${chats.length} chats da instância ${instance.instance_id}`);

      // 2. Processar cada chat
      for (const chat of chats) {
        try {
          const chatResult = await this.importChat(clientId, instance.instance_id, chat);
          
          if (chatResult.success) {
            result.success++;
          } else if (chatResult.duplicate) {
            result.duplicates++;
          } else {
            result.errors++;
          }
          
          if (chatResult.detail) {
            result.details.push(chatResult.detail);
          }
          
        } catch (error: any) {
          console.error('❌ [IMPORT] Erro ao processar chat:', error);
          result.errors++;
          result.details.push(`Erro no chat ${chat.id}: ${error.message}`);
        }
      }

      return result;

    } catch (error: any) {
      console.error('❌ [IMPORT] Erro ao processar instância:', error);
      throw error;
    }
  }

  /**
   * Importar um chat específico
   */
  private async importChat(
    clientId: string,
    instanceId: string,
    chat: any
  ): Promise<{ success: boolean; duplicate: boolean; detail?: string }> {
    
    try {
      // 1. Extrair informações do chat
      const chatId = chat.id || chat.chatId;
      const chatName = chat.name || 'Chat sem nome';
      const phone = this.extractPhoneFromChatId(chatId);
      
      if (!phone) {
        return { 
          success: false, 
          duplicate: false, 
          detail: `Chat ${chatId}: Telefone inválido` 
        };
      }

      // 2. Verificar se já existe
      const { data: existingTicket } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (existingTicket) {
        return { 
          success: false, 
          duplicate: true, 
          detail: `Chat ${chatName}: Já importado` 
        };
      }

      // 3. Buscar mensagens para extrair nome real
      const messages = await whatsappInstanceManager.getInstanceMessages(instanceId, chatId, 10);
      
      // 4. Extrair nome real do contato
      const pushName = messages.find(m => !m.keyFromMe && m.pushName)?.pushName;
      const firstMessage = messages.find(m => !m.keyFromMe && m.content)?.content;
      
      const nameData = contactNameService.extractRealContactName(pushName, phone, firstMessage);
      const customerName = nameData.name;

      // 5. Criar ou encontrar customer
      let customerId: string;
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('client_id', clientId)
        .eq('phone', phone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Atualizar nome se melhor
        if (nameData.confidence === 'high' || nameData.confidence === 'medium') {
          await supabase
            .from('customers')
            .update({ 
              name: customerName,
              whatsapp_chat_id: chatId,
              updated_at: new Date().toISOString()
            })
            .eq('id', customerId);
        }
      } else {
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            client_id: clientId,
            name: customerName,
            phone: phone,
            whatsapp_chat_id: chatId
          })
          .select('id')
          .single();

        if (error) throw error;
        customerId = newCustomer.id;
      }

      // 6. Criar ticket de conversa
      const lastMessage = messages[0];
      const lastMessageTime = lastMessage ? new Date(lastMessage.messageTimestamp * 1000) : new Date();

      const { error: ticketError } = await supabase
        .from('conversation_tickets')
        .insert({
          client_id: clientId,
          customer_id: customerId,
          chat_id: chatId,
          instance_id: instanceId,
          title: `Conversa com ${customerName}`,
          last_message_preview: lastMessage?.content?.substring(0, 100) || 'Sem mensagens',
          last_message_at: lastMessageTime.toISOString(),
          status: 'open'
        });

      if (ticketError) throw ticketError;

      return { 
        success: true, 
        duplicate: false, 
        detail: `✅ ${customerName} (${phone})` 
      };

    } catch (error: any) {
      console.error('❌ [IMPORT] Erro ao importar chat:', error);
      return { 
        success: false, 
        duplicate: false, 
        detail: `Erro: ${error.message}` 
      };
    }
  }

  /**
   * Extrair número de telefone do chat ID
   */
  private extractPhoneFromChatId(chatId: string): string | null {
    if (!chatId) return null;
    
    // Remover sufixos do WhatsApp
    let phone = chatId.split('@')[0];
    
    // Remover caracteres não numéricos
    phone = phone.replace(/\D/g, '');
    
    // Validar comprimento mínimo
    if (phone.length < 10) return null;
    
    return phone;
  }

  /**
   * Obter estatísticas de importação
   */
  async getImportStats(clientId: string): Promise<{
    totalTickets: number;
    totalCustomers: number;
    lastImport?: string;
  }> {
    try {
      const [ticketsResult, customersResult] = await Promise.all([
        supabase
          .from('conversation_tickets')
          .select('id, created_at')
          .eq('client_id', clientId),
        supabase
          .from('customers')
          .select('id')
          .eq('client_id', clientId)
      ]);

      const tickets = ticketsResult.data || [];
      const customers = customersResult.data || [];
      
      const lastImport = tickets.length > 0 
        ? new Date(Math.max(...tickets.map(t => new Date(t.created_at).getTime()))).toISOString()
        : undefined;

      return {
        totalTickets: tickets.length,
        totalCustomers: customers.length,
        lastImport
      };

    } catch (error) {
      console.error('❌ [IMPORT] Erro ao buscar estatísticas:', error);
      return {
        totalTickets: 0,
        totalCustomers: 0
      };
    }
  }
}

export const conversationImportService = new ConversationImportService();
