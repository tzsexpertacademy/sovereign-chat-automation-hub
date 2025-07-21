
import { supabase } from "@/integrations/supabase/client";
import { contactNameService } from "./contactNameService";

export interface ModernContact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: string;
  hasConversation: boolean;
  isActive: boolean;
  confidence: 'high' | 'medium' | 'low';
  source: 'pushName' | 'messageContent' | 'phoneFormatted';
  ticketId?: string;
  ticketStatus?: string;
}

export interface ContactsStats {
  total: number;
  withConversations: number;
  active: number;
  needsNameUpdate: number;
}

/**
 * Serviço Moderno de Contatos
 * Interface limpa e eficiente para gerenciar contatos
 */
export class ModernContactsService {

  /**
   * Buscar contatos com informações otimizadas
   */
  async getContacts(clientId: string, options: {
    search?: string;
    filter?: 'all' | 'with_conversation' | 'without_conversation' | 'active';
    limit?: number;
    offset?: number;
  } = {}): Promise<ModernContact[]> {
    console.log('🔍 [MODERN-CONTACTS] Buscando contatos:', { clientId, options });

    try {
      let query = supabase
        .from('customers')
        .select(`
          id,
          name,
          phone,
          whatsapp_chat_id,
          created_at,
          updated_at,
          conversation_tickets (
            id,
            status,
            last_message_preview,
            last_message_at
          )
        `)
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      // Aplicar busca
      if (options.search) {
        query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
      }

      // Aplicar limite
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Processar e filtrar contatos
      const contacts: ModernContact[] = (data || []).map(customer => {
        const ticket = customer.conversation_tickets?.[0];
        
        // Analisar qualidade do nome
        const nameData = contactNameService.extractRealContactName(
          customer.name,
          customer.phone
        );

        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          lastMessage: ticket?.last_message_preview,
          lastMessageTime: ticket?.last_message_at,
          hasConversation: !!ticket,
          isActive: !!ticket && ticket.status === 'open',
          confidence: nameData.confidence,
          source: nameData.source,
          ticketId: ticket?.id,
          ticketStatus: ticket?.status
        };
      });

      // Aplicar filtros específicos
      let filteredContacts = contacts;

      switch (options.filter) {
        case 'with_conversation':
          filteredContacts = contacts.filter(c => c.hasConversation);
          break;
        case 'without_conversation':
          filteredContacts = contacts.filter(c => !c.hasConversation);
          break;
        case 'active':
          filteredContacts = contacts.filter(c => c.isActive);
          break;
        default:
          // 'all' - sem filtro adicional
          break;
      }

      console.log('✅ [MODERN-CONTACTS] Contatos encontrados:', {
        total: filteredContacts.length,
        withConversations: filteredContacts.filter(c => c.hasConversation).length,
        needsUpdate: filteredContacts.filter(c => c.confidence === 'low').length
      });

      return filteredContacts;

    } catch (error) {
      console.error('❌ [MODERN-CONTACTS] Erro ao buscar contatos:', error);
      return [];
    }
  }

  /**
   * Obter estatísticas de contatos
   */
  async getContactsStats(clientId: string): Promise<ContactsStats> {
    try {
      const contacts = await this.getContacts(clientId, { limit: 1000 });

      return {
        total: contacts.length,
        withConversations: contacts.filter(c => c.hasConversation).length,
        active: contacts.filter(c => c.isActive).length,
        needsNameUpdate: contacts.filter(c => c.confidence === 'low').length
      };

    } catch (error) {
      console.error('❌ [MODERN-CONTACTS] Erro ao calcular estatísticas:', error);
      return {
        total: 0,
        withConversations: 0,
        active: 0,
        needsNameUpdate: 0
      };
    }
  }

  /**
   * Corrigir nomes de contatos usando IA
   */
  async fixContactNames(clientId: string): Promise<{
    updated: number;
    errors: number;
    details: string[];
  }> {
    console.log('🔧 [MODERN-CONTACTS] Iniciando correção de nomes para cliente:', clientId);

    const result = {
      updated: 0,
      errors: 0,
      details: [] as string[]
    };

    try {
      // Buscar contatos que precisam de correção
      const contacts = await this.getContacts(clientId, { limit: 1000 });
      const needsUpdate = contacts.filter(c => c.confidence === 'low');

      if (needsUpdate.length === 0) {
        result.details.push('Todos os contatos já possuem nomes válidos');
        return result;
      }

      console.log(`🎯 [MODERN-CONTACTS] ${needsUpdate.length} contatos precisam de correção`);

      // Processar cada contato
      for (const contact of needsUpdate) {
        try {
          // Buscar mensagens do ticket para análise
          if (contact.ticketId) {
            const { data: messages } = await supabase
              .from('ticket_messages')
              .select('content, from_me, sender_name')
              .eq('ticket_id', contact.ticketId)
              .eq('from_me', false)
              .not('content', 'is', null)
              .order('timestamp', { ascending: true })
              .limit(5);

            if (messages && messages.length > 0) {
              // Tentar extrair nome da primeira mensagem ou sender_name
              const senderName = messages.find(m => m.sender_name)?.sender_name;
              const firstMessage = messages[0]?.content;

              const nameData = contactNameService.extractRealContactName(
                senderName,
                contact.phone,
                firstMessage
              );

              // Só atualizar se encontrou um nome melhor
              if (nameData.confidence === 'high' || nameData.confidence === 'medium') {
                const { error } = await supabase
                  .from('customers')
                  .update({
                    name: nameData.name,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', contact.id);

                if (error) throw error;

                result.updated++;
                result.details.push(`✅ ${contact.phone} → ${nameData.name}`);
                console.log(`✅ [MODERN-CONTACTS] Nome atualizado: ${contact.phone} → ${nameData.name}`);
              }
            }
          }

          // Pequeno delay para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`❌ [MODERN-CONTACTS] Erro ao processar ${contact.phone}:`, error);
          result.errors++;
          result.details.push(`❌ ${contact.phone}: ${error.message}`);
        }
      }

      console.log('✅ [MODERN-CONTACTS] Correção concluída:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [MODERN-CONTACTS] Erro crítico na correção:', error);
      throw new Error(`Falha na correção de nomes: ${error.message}`);
    }
  }

  /**
   * Buscar contato por telefone
   */
  async findContactByPhone(clientId: string, phone: string): Promise<ModernContact | null> {
    try {
      const contacts = await this.getContacts(clientId, { 
        search: phone,
        limit: 1
      });

      return contacts.find(c => c.phone === phone) || null;

    } catch (error) {
      console.error('❌ [MODERN-CONTACTS] Erro ao buscar contato por telefone:', error);
      return null;
    }
  }

  /**
   * Remover duplicatas de contatos
   */
  async removeDuplicates(clientId: string): Promise<{
    removed: number;
    kept: number;
    details: string[];
  }> {
    console.log('🧹 [MODERN-CONTACTS] Removendo duplicatas para cliente:', clientId);

    const result = {
      removed: 0,
      kept: 0,
      details: [] as string[]
    };

    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, phone, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por telefone
      const phoneGroups = customers.reduce((acc, customer) => {
        const phone = customer.phone;
        if (!acc[phone]) acc[phone] = [];
        acc[phone].push(customer);
        return acc;
      }, {} as Record<string, typeof customers>);

      // Processar duplicatas
      for (const [phone, group] of Object.entries(phoneGroups)) {
        if (group.length > 1) {
          // Manter o mais antigo, remover os demais
          const [keep, ...remove] = group;
          
          for (const duplicate of remove) {
            const { error } = await supabase
              .from('customers')
              .delete()
              .eq('id', duplicate.id);

            if (error) {
              console.error(`❌ [MODERN-CONTACTS] Erro ao remover duplicata:`, error);
              result.details.push(`❌ Erro ao remover ${duplicate.name} (${phone})`);
            } else {
              result.removed++;
              result.details.push(`🗑️ Removido: ${duplicate.name} (${phone})`);
            }
          }

          result.kept++;
          result.details.push(`✅ Mantido: ${keep.name} (${phone})`);
        } else {
          result.kept++;
        }
      }

      console.log('✅ [MODERN-CONTACTS] Limpeza de duplicatas concluída:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [MODERN-CONTACTS] Erro na remoção de duplicatas:', error);
      throw new Error(`Falha na remoção de duplicatas: ${error.message}`);
    }
  }
}

export const modernContactsService = new ModernContactsService();
