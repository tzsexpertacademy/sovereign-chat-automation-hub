/**
 * Processador de Emergência para Batches
 * Garante que mensagens não fiquem perdidas por problemas de timing
 */

import { supabase } from '@/integrations/supabase/client';

export class EmergencyBatchProcessor {
  private static instance: EmergencyBatchProcessor;
  private processingInterval: NodeJS.Timeout | null = null;

  static getInstance(): EmergencyBatchProcessor {
    if (!EmergencyBatchProcessor.instance) {
      EmergencyBatchProcessor.instance = new EmergencyBatchProcessor();
    }
    return EmergencyBatchProcessor.instance;
  }

  /**
   * Iniciar monitoramento de emergência
   * Verifica batches órfãos a cada 10 segundos
   */
  startEmergencyMonitoring() {
    if (this.processingInterval) {
      console.log('⚡ [EMERGENCY] Monitor já ativo');
      return;
    }

    console.log('🚨 [EMERGENCY] Iniciando monitor de batches órfãos');
    
    this.processingInterval = setInterval(async () => {
      await this.checkOrphanedBatches();
    }, 10000); // Verificar a cada 10 segundos
  }

  /**
   * Parar monitoramento de emergência
   */
  stopEmergencyMonitoring() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('🛑 [EMERGENCY] Monitor parado');
    }
  }

  /**
   * Verificar e processar batches órfãos
   */
  private async checkOrphanedBatches() {
    try {
      // Buscar batches que estão pendentes há mais de 5 segundos (emergência)
      const { data: orphanedBatches, error } = await supabase
        .from('message_batches')
        .select('*')
        .is('processing_started_at', null)
        .lt('last_updated', new Date(Date.now() - 5000).toISOString()) // 5 segundos atrás
        .limit(5);

      if (error) {
        console.error('❌ [EMERGENCY] Erro ao buscar batches órfãos:', error);
        return;
      }

      if (orphanedBatches && orphanedBatches.length > 0) {
        console.log(`🚨 [EMERGENCY] Encontrados ${orphanedBatches.length} batches órfãos, forçando processamento`);
        
        // Forçar processamento de batches órfãos
        await this.forceProcessBatches(orphanedBatches);
      }
    } catch (error) {
      console.error('❌ [EMERGENCY] Erro no monitor:', error);
    }
  }

  /**
   * Forçar processamento de batches específicos
   */
  private async forceProcessBatches(batches: any[]) {
    for (const batch of batches) {
      try {
        console.log(`⚡ [EMERGENCY] Forçando processamento do batch: ${batch.id}`);
        
        // Chamar edge function para processar
        const { error } = await supabase.functions.invoke('process-message-batches', {
          body: { 
            trigger: 'emergency',
            chatId: batch.chat_id,
            forceProcess: true
          }
        });

        if (error) {
          console.error(`❌ [EMERGENCY] Erro ao forçar batch ${batch.id}:`, error);
        } else {
          console.log(`✅ [EMERGENCY] Batch ${batch.id} enviado para processamento`);
        }
      } catch (error) {
        console.error(`❌ [EMERGENCY] Erro ao processar batch ${batch.id}:`, error);
      }
    }
  }

  /**
   * Executar limpeza manual de batches órfãos
   */
  async manualCleanup() {
    try {
      console.log('🧹 [EMERGENCY] Executando limpeza manual de batches órfãos');
      
      const { data, error } = await supabase.rpc('cleanup_orphaned_batches');
      
      if (error) {
        console.error('❌ [EMERGENCY] Erro na limpeza:', error);
        return { success: false, error: error.message };
      }
      
      console.log(`✅ [EMERGENCY] Limpeza concluída: ${data} batches limpos`);
      return { success: true, cleaned: data };
    } catch (error) {
      console.error('❌ [EMERGENCY] Erro na limpeza manual:', error);
      return { success: false, error };
    }
  }

  /**
   * Forçar processamento imediato de um chat específico
   */
  async forceProcessChat(chatId: string, clientId: string) {
    try {
      console.log(`⚡ [EMERGENCY] Forçando processamento para chat: ${chatId}`);
      
      const { error } = await supabase.functions.invoke('process-message-batches', {
        body: { 
          trigger: 'emergency_chat',
          chatId: chatId,
          clientId: clientId,
          forceProcess: true
        }
      });

      if (error) {
        console.error(`❌ [EMERGENCY] Erro ao forçar chat ${chatId}:`, error);
        return { success: false, error: error.message };
      }
      
      console.log(`✅ [EMERGENCY] Chat ${chatId} enviado para processamento`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [EMERGENCY] Erro ao processar chat ${chatId}:`, error);
      return { success: false, error };
    }
  }

  /**
   * Obter estatísticas de batches
   */
  async getBatchStats() {
    try {
      const { data: pendingCount } = await supabase
        .from('message_batches')
        .select('id', { count: 'exact' })
        .is('processing_started_at', null);

      const { data: processingCount } = await supabase
        .from('message_batches')
        .select('id', { count: 'exact' })
        .not('processing_started_at', 'is', null);

      const { data: orphanedCount } = await supabase
        .from('message_batches')
        .select('id', { count: 'exact' })
        .is('processing_started_at', null)
        .lt('last_updated', new Date(Date.now() - 10000).toISOString());

      return {
        pending: pendingCount?.length || 0,
        processing: processingCount?.length || 0,
        orphaned: orphanedCount?.length || 0
      };
    } catch (error) {
      console.error('❌ [EMERGENCY] Erro ao obter stats:', error);
      return { pending: 0, processing: 0, orphaned: 0 };
    }
  }
}

// Instância singleton
export const emergencyProcessor = EmergencyBatchProcessor.getInstance();