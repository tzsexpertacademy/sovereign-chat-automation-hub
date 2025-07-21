
import { supabase } from '@/integrations/supabase/client';
import { yumerWhatsappService } from './yumerWhatsappService';
import { ticketsService } from './ticketsService';

export interface ImportStatus {
  isImporting: boolean;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  lastImportAt?: Date;
  nextImportAt?: Date;
}

export const incrementalImportService = {
  // Importação incremental (só mensagens novas)
  async performIncrementalImport(clientId: string): Promise<{ imported: number; errors: number }> {
    console.log(`📥 [INCREMENTAL] Iniciando importação incremental para cliente: ${clientId}`);
    
    try {
      // Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, id')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (!instances || instances.length === 0) {
        console.log(`⚠️ [INCREMENTAL] Nenhuma instância conectada encontrada`);
        return { imported: 0, errors: 0 };
      }

      let totalImported = 0;
      let totalErrors = 0;

      for (const instance of instances) {
        try {
          console.log(`📱 [INCREMENTAL] Processando instância: ${instance.instance_id}`);
          
          // Buscar última mensagem importada
          const { data: lastMessage } = await supabase
            .from('whatsapp_messages')
            .select('timestamp')
            .eq('instance_id', instance.instance_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          const fromDate = lastMessage?.timestamp 
            ? new Date(lastMessage.timestamp)
            : new Date(Date.now() - 24 * 60 * 60 * 1000); // Últimas 24h se não houver mensagens

          console.log(`📅 [INCREMENTAL] Importando desde: ${fromDate.toISOString()}`);

          // Buscar chats da instância
          const chatsResponse = await yumerWhatsappService.getChats(instance.instance_id);
          
          if (!chatsResponse.success || !chatsResponse.data) {
            console.warn(`⚠️ [INCREMENTAL] Erro ao buscar chats:`, chatsResponse.error);
            totalErrors++;
            continue;
          }

          // Processar cada chat
          for (const chat of chatsResponse.data.slice(0, 20)) { // Limitar a 20 chats por vez
            try {
              // Buscar mensagens do chat desde a última importação
              const messagesResponse = await yumerWhatsappService.getChatMessages(
                instance.instance_id,
                chat.id,
                {
                  limit: 50,
                  fromDate: fromDate.toISOString()
                }
              );

              if (messagesResponse.success && messagesResponse.data) {
                const newMessages = messagesResponse.data.filter(msg => 
                  new Date(msg.timestamp * 1000) > fromDate
                );

                console.log(`📨 [INCREMENTAL] ${newMessages.length} mensagens novas no chat ${chat.id}`);

                // Processar mensagens novas
                for (const message of newMessages) {
                  try {
                    await this.processNewMessage(message, instance.instance_id, clientId);
                    totalImported++;
                  } catch (error) {
                    console.error(`❌ [INCREMENTAL] Erro ao processar mensagem:`, error);
                    totalErrors++;
                  }
                }
              }
            } catch (error) {
              console.error(`❌ [INCREMENTAL] Erro ao processar chat ${chat.id}:`, error);
              totalErrors++;
            }
          }
        } catch (error) {
          console.error(`❌ [INCREMENTAL] Erro ao processar instância ${instance.instance_id}:`, error);
          totalErrors++;
        }
      }

      console.log(`✅ [INCREMENTAL] Importação concluída: ${totalImported} importadas, ${totalErrors} erros`);
      
      // Atualizar timestamp da última importação
      await supabase
        .from('whatsapp_instances')
        .update({ last_import_at: new Date().toISOString() })
        .eq('client_id', clientId);

      return { imported: totalImported, errors: totalErrors };
    } catch (error) {
      console.error(`❌ [INCREMENTAL] Erro crítico na importação:`, error);
      throw error;
    }
  },

  // Processar mensagem nova
  async processNewMessage(message: any, instanceId: string, clientId: string) {
    // Verificar se mensagem já existe
    const { data: existingMessage } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('message_id', message.id)
      .eq('instance_id', instanceId)
      .single();

    if (existingMessage) {
      return; // Mensagem já existe
    }

    // Salvar mensagem
    await supabase
      .from('whatsapp_messages')
      .insert({
        message_id: message.id,
        chat_id: message.from,
        instance_id: instanceId,
        sender: message.author || message.from,
        body: message.body || '',
        message_type: message.type || 'text',
        from_me: message.fromMe || false,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
        is_processed: false
      });

    console.log(`💾 [INCREMENTAL] Mensagem salva: ${message.id}`);
  },

  // Importação com retry automático
  async performImportWithRetry(clientId: string, maxRetries: number = 3): Promise<{ imported: number; errors: number }> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🔄 [RETRY-IMPORT] Tentativa ${attempt}/${maxRetries} para cliente: ${clientId}`);
        
        const result = await this.performIncrementalImport(clientId);
        
        if (result.errors === 0 || result.imported > 0) {
          console.log(`✅ [RETRY-IMPORT] Sucesso na tentativa ${attempt}`);
          return result;
        }
        
        throw new Error(`Importação falhou: ${result.errors} erros, ${result.imported} importadas`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Erro desconhecido');
        console.error(`❌ [RETRY-IMPORT] Tentativa ${attempt} falhou:`, lastError.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial
          console.log(`⏳ [RETRY-IMPORT] Aguardando ${delay}ms antes da próxima tentativa`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Todas as tentativas de importação falharam');
  },

  // Status da importação
  async getImportStatus(clientId: string): Promise<ImportStatus> {
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('last_import_at')
      .eq('client_id', clientId);

    const lastImportAt = instances?.reduce((latest, instance) => {
      const importDate = instance.last_import_at ? new Date(instance.last_import_at) : null;
      if (!importDate) return latest;
      return !latest || importDate > latest ? importDate : latest;
    }, null as Date | null);

    const nextImportAt = lastImportAt 
      ? new Date(lastImportAt.getTime() + 5 * 60 * 1000) // Próxima em 5 minutos
      : new Date();

    return {
      isImporting: false, // TODO: Implementar controle de estado
      progress: {
        current: 0,
        total: 100,
        message: lastImportAt ? 'Última importação concluída' : 'Nenhuma importação realizada'
      },
      lastImportAt: lastImportAt || undefined,
      nextImportAt
    };
  }
};
