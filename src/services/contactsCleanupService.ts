
/**
 * Serviço de Limpeza de Contatos
 * Remove contatos órfãos e otimiza a base de dados
 */

import { supabase } from '@/integrations/supabase/client';

export interface CleanupResult {
  orphanContactsRemoved: number;
  emptyTicketsRemoved: number;
  totalCleaned: number;
  errors: number;
  details: string[];
}

class ContactsCleanupService {
  /**
   * Limpar contatos órfãos (sem tickets/conversas reais)
   */
  async cleanupOrphanContacts(clientId: string): Promise<CleanupResult> {
    console.log('🧹 [CLEANUP] Iniciando limpeza de contatos órfãos para cliente:', clientId);

    const result: CleanupResult = {
      orphanContactsRemoved: 0,
      emptyTicketsRemoved: 0,
      totalCleaned: 0,
      errors: 0,
      details: []
    };

    try {
      // ETAPA 1: Encontrar contatos sem tickets
      const { data: orphanContacts, error: orphanError } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          phone,
          conversation_tickets (
            id,
            last_message_at
          )
        `)
        .eq('client_id', clientId);

      if (orphanError) throw orphanError;

      const contactsToRemove = (orphanContacts || []).filter(contact => 
        !contact.conversation_tickets || contact.conversation_tickets.length === 0
      );

      console.log(`🔍 [CLEANUP] Encontrados ${contactsToRemove.length} contatos órfãos`);

      // Remover contatos órfãos
      for (const contact of contactsToRemove) {
        try {
          const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', contact.id);

          if (error) throw error;

          result.orphanContactsRemoved++;
          result.details.push(`🗑️ Contato órfão removido: ${contact.name} (${contact.phone})`);
          
          console.log(`🗑️ [CLEANUP] Contato órfão removido: ${contact.name}`);

        } catch (error: any) {
          result.errors++;
          result.details.push(`❌ Erro ao remover ${contact.name}: ${error.message}`);
          console.error(`❌ [CLEANUP] Erro ao remover contato ${contact.id}:`, error);
        }
      }

      // ETAPA 2: Encontrar tickets vazios (sem mensagens)
      const { data: emptyTickets, error: ticketsError } = await supabase
        .from('conversation_tickets')
        .select(`
          id,
          title,
          chat_id,
          ticket_messages (
            id
          )
        `)
        .eq('client_id', clientId);

      if (ticketsError) throw ticketsError;

      const ticketsToRemove = (emptyTickets || []).filter(ticket => 
        !ticket.ticket_messages || ticket.ticket_messages.length === 0
      );

      console.log(`🔍 [CLEANUP] Encontrados ${ticketsToRemove.length} tickets vazios`);

      // Remover tickets vazios
      for (const ticket of ticketsToRemove) {
        try {
          const { error } = await supabase
            .from('conversation_tickets')
            .delete()
            .eq('id', ticket.id);

          if (error) throw error;

          result.emptyTicketsRemoved++;
          result.details.push(`🗑️ Ticket vazio removido: ${ticket.title}`);
          
          console.log(`🗑️ [CLEANUP] Ticket vazio removido: ${ticket.title}`);

        } catch (error: any) {
          result.errors++;
          result.details.push(`❌ Erro ao remover ticket ${ticket.title}: ${error.message}`);
          console.error(`❌ [CLEANUP] Erro ao remover ticket ${ticket.id}:`, error);
        }
      }

      result.totalCleaned = result.orphanContactsRemoved + result.emptyTicketsRemoved;

      console.log('✅ [CLEANUP] Limpeza concluída:', {
        orphanContacts: result.orphanContactsRemoved,
        emptyTickets: result.emptyTicketsRemoved,
        total: result.totalCleaned,
        errors: result.errors
      });

      return result;

    } catch (error: any) {
      console.error('❌ [CLEANUP] Erro crítico na limpeza:', error);
      result.errors++;
      result.details.push(`❌ Erro crítico: ${error.message}`);
      return result;
    }
  }

  /**
   * Otimizar base de contatos - remover duplicatas e consolidar
   */
  async optimizeContacts(clientId: string): Promise<{ 
    duplicatesRemoved: number; 
    consolidated: number; 
    details: string[] 
  }> {
    console.log('⚡ [OPTIMIZE] Iniciando otimização de contatos para cliente:', clientId);

    const result = {
      duplicatesRemoved: 0,
      consolidated: 0,
      details: [] as string[]
    };

    try {
      // Buscar todos os contatos do cliente
      const { data: contacts, error } = await supabase
        .from('customers')
        .select('id, name, phone, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por telefone
      const phoneGroups = (contacts || []).reduce((acc, contact) => {
        if (!acc[contact.phone]) acc[contact.phone] = [];
        acc[contact.phone].push(contact);
        return acc;
      }, {} as Record<string, typeof contacts>);

      // Processar duplicatas
      for (const [phone, group] of Object.entries(phoneGroups)) {
        if (group.length > 1) {
          // Manter o mais antigo, remover os demais
          const [keep, ...remove] = group.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          for (const duplicate of remove) {
            try {
              const { error: deleteError } = await supabase
                .from('customers')
                .delete()
                .eq('id', duplicate.id);

              if (deleteError) throw deleteError;

              result.duplicatesRemoved++;
              result.details.push(`🔄 Duplicata removida: ${duplicate.name} (${phone})`);
              
              console.log(`🔄 [OPTIMIZE] Duplicata removida: ${duplicate.name}`);

            } catch (error: any) {
              console.error(`❌ [OPTIMIZE] Erro ao remover duplicata:`, error);
              result.details.push(`❌ Erro ao remover duplicata de ${phone}: ${error.message}`);
            }
          }

          result.consolidated++;
          result.details.push(`✅ Telefone consolidado: ${phone} (mantido: ${keep.name})`);
        }
      }

      console.log('✅ [OPTIMIZE] Otimização concluída:', result);
      return result;

    } catch (error: any) {
      console.error('❌ [OPTIMIZE] Erro na otimização:', error);
      result.details.push(`❌ Erro crítico: ${error.message}`);
      return result;
    }
  }

  /**
   * Limpeza completa - combina todas as operações
   */
  async performFullCleanup(clientId: string): Promise<{
    cleanup: CleanupResult;
    optimization: { duplicatesRemoved: number; consolidated: number; details: string[] };
    summary: string;
  }> {
    console.log('🚀 [FULL-CLEANUP] Iniciando limpeza completa para cliente:', clientId);

    try {
      // Executar limpeza de órfãos
      const cleanup = await this.cleanupOrphanContacts(clientId);
      
      // Aguardar um pouco para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Executar otimização
      const optimization = await this.optimizeContacts(clientId);

      const summary = `Limpeza concluída: ${cleanup.totalCleaned} itens limpos, ${optimization.duplicatesRemoved} duplicatas removidas, ${optimization.consolidated} telefones consolidados.`;

      console.log('🎉 [FULL-CLEANUP] Limpeza completa finalizada:', summary);

      return {
        cleanup,
        optimization,
        summary
      };

    } catch (error: any) {
      console.error('❌ [FULL-CLEANUP] Erro na limpeza completa:', error);
      throw new Error(`Falha na limpeza completa: ${error.message}`);
    }
  }
}

export const contactsCleanupService = new ContactsCleanupService();
export default contactsCleanupService;
