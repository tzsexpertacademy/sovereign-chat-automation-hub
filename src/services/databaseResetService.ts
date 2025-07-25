/**
 * Serviço para reset completo dos dados do cliente
 */

import { supabase } from '@/integrations/supabase/client';

export interface ResetProgress {
  current: number;
  total: number;
  message: string;
  status: 'idle' | 'resetting' | 'completed' | 'error';
  tablesCleared?: string[];
}

export class DatabaseResetService {
  private progressCallback?: (progress: ResetProgress) => void;

  setProgressCallback(callback: (progress: ResetProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * Reset completo dos dados do cliente
   */
  async resetClientData(clientId: string): Promise<{ success: boolean; error?: string }> {
    console.log('🗑️ [RESET] Iniciando reset completo para cliente:', clientId);
    
    try {
      this.updateProgress({
        current: 0,
        total: 100,
        status: 'resetting',
        message: 'Iniciando limpeza dos dados...',
        tablesCleared: []
      });

      const tablesToReset = [
        'ticket_messages',
        'conversation_tickets',
        'customers',
        'whatsapp_messages',
        'whatsapp_chats',
        'ticket_events'
      ];

      let completedTables = 0;
      const clearedTables: string[] = [];

      // Deletar dados tabela por tabela
      for (const table of tablesToReset) {
        try {
          this.updateProgress({
            current: Math.round((completedTables / tablesToReset.length) * 100),
            total: 100,
            status: 'resetting',
            message: `Limpando tabela: ${table}...`,
            tablesCleared: [...clearedTables]
          });

          await this.clearTable(table, clientId);
          clearedTables.push(table);
          completedTables++;

          console.log(`✅ [RESET] Tabela ${table} limpa com sucesso`);
        } catch (error) {
          console.warn(`⚠️ [RESET] Erro ao limpar tabela ${table}:`, error);
          // Continuar mesmo se uma tabela falhar
        }
      }

      this.updateProgress({
        current: 100,
        total: 100,
        status: 'completed',
        message: `Reset concluído! ${clearedTables.length} tabelas limpas`,
        tablesCleared: clearedTables
      });

      console.log('🎉 [RESET] Reset completo concluído');
      return { success: true };

    } catch (error) {
      console.error('❌ [RESET] Erro no reset:', error);
      
      this.updateProgress({
        current: 0,
        total: 100,
        status: 'error',
        message: `Erro no reset: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        tablesCleared: []
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Limpa uma tabela específica para o cliente
   */
  private async clearTable(tableName: string, clientId: string): Promise<void> {
    switch (tableName) {
      case 'ticket_messages':
        // Buscar IDs dos tickets do cliente primeiro
        const { data: ticketIds } = await supabase
          .from('conversation_tickets')
          .select('id')
          .eq('client_id', clientId);
        
        if (ticketIds && ticketIds.length > 0) {
          const ids = ticketIds.map(t => t.id);
          const { error: messagesError } = await supabase
            .from('ticket_messages')
            .delete()
            .in('ticket_id', ids);
          
          if (messagesError) throw messagesError;
        }
        break;

      case 'conversation_tickets':
        const { error: ticketsError } = await supabase
          .from('conversation_tickets')
          .delete()
          .eq('client_id', clientId);
        
        if (ticketsError) throw ticketsError;
        break;

      case 'customers':
        const { error: customersError } = await supabase
          .from('customers')
          .delete()
          .eq('client_id', clientId);
        
        if (customersError) throw customersError;
        break;

      case 'whatsapp_messages':
        // Buscar IDs das instâncias do cliente primeiro
        const { data: instanceIds } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('client_id', clientId);
        
        if (instanceIds && instanceIds.length > 0) {
          const ids = instanceIds.map(i => i.instance_id);
          const { error: whatsappMsgError } = await supabase
            .from('whatsapp_messages')
            .delete()
            .in('instance_id', ids);
          
          if (whatsappMsgError) throw whatsappMsgError;
        }
        break;

      case 'whatsapp_chats':
        // Buscar IDs das instâncias do cliente primeiro
        const { data: chatInstanceIds } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('client_id', clientId);
        
        if (chatInstanceIds && chatInstanceIds.length > 0) {
          const ids = chatInstanceIds.map(i => i.instance_id);
          const { error: whatsappChatError } = await supabase
            .from('whatsapp_chats')
            .delete()
            .in('instance_id', ids);
          
          if (whatsappChatError) throw whatsappChatError;
        }
        break;

      case 'ticket_events':
        // Buscar IDs dos tickets do cliente primeiro
        const { data: eventTicketIds } = await supabase
          .from('conversation_tickets')
          .select('id')
          .eq('client_id', clientId);
        
        if (eventTicketIds && eventTicketIds.length > 0) {
          const ids = eventTicketIds.map(t => t.id);
          const { error: eventsError } = await supabase
            .from('ticket_events')
            .delete()
            .in('ticket_id', ids);
          
          if (eventsError) throw eventsError;
        }
        break;

      default:
        console.warn(`⚠️ [RESET] Tabela ${tableName} não reconhecida para limpeza`);
    }
  }

  /**
   * Limpa apenas dados antigos (preserva últimos 7 dias)
   */
  async clearOldData(clientId: string, daysToKeep = 7): Promise<{ success: boolean; error?: string }> {
    console.log(`🗑️ [RESET] Limpando dados antigos (>${daysToKeep} dias) para cliente:`, clientId);
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();

      this.updateProgress({
        current: 0,
        total: 100,
        status: 'resetting',
        message: `Removendo dados anteriores a ${cutoffDate.toLocaleDateString('pt-BR')}...`,
        tablesCleared: []
      });

      // Buscar IDs dos tickets do cliente primeiro
      const { data: ticketIds } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId);
      
      if (ticketIds && ticketIds.length > 0) {
        const ids = ticketIds.map(t => t.id);
        // Deletar mensagens antigas
        const { error: oldMessagesError } = await supabase
          .from('ticket_messages')
          .delete()
          .lt('created_at', cutoffISO)
          .in('ticket_id', ids);

        if (oldMessagesError) throw oldMessagesError;
      }

      this.updateProgress({
        current: 100,
        total: 100,
        status: 'completed',
        message: 'Limpeza de dados antigos concluída!',
        tablesCleared: ['ticket_messages (antigas)']
      });

      return { success: true };

    } catch (error) {
      console.error('❌ [RESET] Erro na limpeza de dados antigos:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  private updateProgress(progress: Partial<ResetProgress>) {
    if (this.progressCallback) {
      const fullProgress: ResetProgress = {
        current: 0,
        total: 100,
        message: 'Processando...',
        status: 'idle',
        tablesCleared: [],
        ...progress
      };
      
      this.progressCallback(fullProgress);
    }
  }
}

export const databaseResetService = new DatabaseResetService();