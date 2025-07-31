import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BatchMetrics {
  totalBatches: number;
  pendingBatches: number;
  processingBatches: number;
  avgProcessingTime: number;
  lastProcessedAt: string | null;
}

interface BatchMonitoringConfig {
  clientId: string;
  checkInterval?: number; // em ms, padrão 30s
}

/**
 * Hook para monitorar saúde do sistema de processamento em bloco
 */
export function useBatchMonitoring({ clientId, checkInterval = 30000 }: BatchMonitoringConfig) {
  const [metrics, setMetrics] = useState<BatchMetrics>({
    totalBatches: 0,
    pendingBatches: 0,
    processingBatches: 0,
    avgProcessingTime: 0,
    lastProcessedAt: null
  });
  const [isMonitoring, setIsMonitoring] = useState(false);

  /**
   * Coletar métricas do sistema de batches
   */
  const collectMetrics = async () => {
    try {
      console.log('📊 [BATCH-MONITOR] Coletando métricas para client:', clientId);

      // Contar batches por status
      const [totalResponse, pendingResponse, processingResponse] = await Promise.all([
        supabase
          .from('message_batches')
          .select('id', { count: 'exact' })
          .eq('client_id', clientId),
        
        supabase
          .from('message_batches')
          .select('id', { count: 'exact' })
          .eq('client_id', clientId)
          .is('processing_started_at', null),
        
        supabase
          .from('message_batches')
          .select('id', { count: 'exact' })
          .eq('client_id', clientId)
          .not('processing_started_at', 'is', null)
      ]);

      // Verificar mensagens órfãs (processadas mas não em ticket_messages)
      const { data: orphanMessages } = await supabase
        .from('whatsapp_messages')
        .select('message_id')
        .eq('is_processed', true)
        .not('message_id', 'in', `(
          SELECT DISTINCT message_id 
          FROM ticket_messages 
          WHERE message_id IS NOT NULL
        )`);

      if (orphanMessages && orphanMessages.length > 0) {
        console.warn(`⚠️ [BATCH-MONITOR] Encontradas ${orphanMessages.length} mensagens órfãs (processadas mas não em tickets)`);
      }

      // Último processamento
      const { data: lastBatch } = await supabase
        .from('message_batches')
        .select('created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setMetrics({
        totalBatches: totalResponse.count || 0,
        pendingBatches: pendingResponse.count || 0,
        processingBatches: processingResponse.count || 0,
        avgProcessingTime: 0, // TODO: calcular baseado em histórico
        lastProcessedAt: lastBatch?.created_at || null
      });

      console.log('📊 [BATCH-MONITOR] Métricas coletadas:', {
        total: totalResponse.count,
        pending: pendingResponse.count,
        processing: processingResponse.count,
        orphans: orphanMessages?.length || 0
      });

    } catch (error) {
      console.error('❌ [BATCH-MONITOR] Erro ao coletar métricas:', error);
    }
  };

  /**
   * Recuperar mensagens órfãs
   */
  const recoverOrphanMessages = async () => {
    try {
      console.log('🔄 [BATCH-MONITOR] Iniciando recuperação de mensagens órfãs...');

      // Chamar função de processamento para tentar reprocessar
      const { error } = await supabase.functions.invoke('process-message-batches', {
        body: { 
          trigger: 'recovery',
          clientId,
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('❌ [BATCH-MONITOR] Erro na recuperação:', error);
      } else {
        console.log('✅ [BATCH-MONITOR] Recuperação iniciada com sucesso');
        // Recolher métricas após recuperação
        setTimeout(collectMetrics, 5000);
      }

    } catch (error) {
      console.error('❌ [BATCH-MONITOR] Erro inesperado na recuperação:', error);
    }
  };

  /**
   * Iniciar monitoramento
   */
  const startMonitoring = () => {
    setIsMonitoring(true);
    collectMetrics(); // Coleta inicial
  };

  /**
   * Parar monitoramento
   */
  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  // Effect para monitoramento contínuo
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(collectMetrics, checkInterval);
    return () => clearInterval(interval);
  }, [isMonitoring, checkInterval, clientId]);

  // Auto-start monitoring
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [clientId]);

  return {
    metrics,
    isMonitoring,
    collectMetrics,
    recoverOrphanMessages,
    startMonitoring,
    stopMonitoring,
    // Status helpers
    hasIssues: metrics.pendingBatches > 5 || metrics.processingBatches > 3,
    isHealthy: metrics.pendingBatches <= 2 && metrics.processingBatches <= 1
  };
}