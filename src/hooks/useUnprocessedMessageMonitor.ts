/**
 * Hook para monitoramento de mensagens não processadas
 * PARTE 4: Melhorar monitoramento
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { unprocessedMessageProcessor, type ProcessingStatus } from '@/services/unprocessedMessageProcessor';

export interface UnprocessedStats {
  totalUnprocessed: number;
  oldestMessage?: string;
  instanceBreakdown: Array<{
    instanceId: string;
    instanceName: string;
    count: number;
  }>;
  lastCheck: string;
}

export const useUnprocessedMessageMonitor = (clientId: string) => {
  const [stats, setStats] = useState<UnprocessedStats>({
    totalUnprocessed: 0,
    instanceBreakdown: [],
    lastCheck: new Date().toISOString()
  });
  
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    totalPending: 0,
    processing: 0,
    processed: 0,
    errors: 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carregar estatísticas de mensagens não processadas
   */
  const loadStats = useCallback(async () => {
    try {
      setError(null);
      
      // Buscar instâncias do cliente
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_id, custom_name, status')
        .eq('client_id', clientId);

      if (instancesError) {
        throw instancesError;
      }

      if (!instances || instances.length === 0) {
        setStats({
          totalUnprocessed: 0,
          instanceBreakdown: [],
          lastCheck: new Date().toISOString()
        });
        return;
      }

      const instanceIds = instances.map(i => i.instance_id);

      // Buscar mensagens não processadas
      const { data: unprocessedMessages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('instance_id, created_at')
        .eq('is_processed', false)
        .eq('from_me', false)
        .in('instance_id', instanceIds)
        .order('created_at', { ascending: true });

      if (messagesError) {
        throw messagesError;
      }

      // Calcular estatísticas
      const breakdown = instances.map(instance => {
        const count = unprocessedMessages?.filter(
          msg => msg.instance_id === instance.instance_id
        ).length || 0;

        return {
          instanceId: instance.instance_id,
          instanceName: instance.custom_name || `Instância ${instance.instance_id.slice(-8)}`,
          count
        };
      });

      const oldestMessage = unprocessedMessages?.[0]?.created_at;

      setStats({
        totalUnprocessed: unprocessedMessages?.length || 0,
        oldestMessage,
        instanceBreakdown: breakdown.filter(item => item.count > 0),
        lastCheck: new Date().toISOString()
      });

    } catch (err) {
      console.error('❌ [MONITOR] Erro ao carregar estatísticas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [clientId]);

  /**
   * Processar mensagens pendentes
   */
  const processUnprocessedMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 [MONITOR] Iniciando processamento manual...');
      
      const result = await unprocessedMessageProcessor.processUnprocessedMessages(clientId);
      setProcessingStatus(result);
      
      // Recarregar estatísticas após processamento
      await loadStats();
      
      console.log('✅ [MONITOR] Processamento concluído:', result);
      
    } catch (err) {
      console.error('❌ [MONITOR] Erro no processamento:', err);
      setError(err instanceof Error ? err.message : 'Erro no processamento');
    } finally {
      setIsLoading(false);
    }
  }, [clientId, loadStats]);

  /**
   * Verificar se tem mensagens muito antigas (> 1 hora)
   */
  const hasOldMessages = useCallback((): boolean => {
    if (!stats.oldestMessage) return false;
    
    const oldestTime = new Date(stats.oldestMessage).getTime();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    return oldestTime < oneHourAgo;
  }, [stats.oldestMessage]);

  /**
   * Obter status atual do processador
   */
  const updateProcessingStatus = useCallback(() => {
    const status = unprocessedMessageProcessor.getStatus();
    setProcessingStatus(status);
  }, []);

  // Configurar polling para atualizações automáticas
  useEffect(() => {
    if (!clientId) return;

    // Carregar inicial
    loadStats();
    
    // Polling a cada 30 segundos
    const statsInterval = setInterval(loadStats, 30000);
    
    // Atualizar status do processamento a cada 5 segundos
    const statusInterval = setInterval(updateProcessingStatus, 5000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(statusInterval);
    };
  }, [clientId, loadStats, updateProcessingStatus]);

  // Configurar listener em tempo real para novas mensagens
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel('unprocessed_messages_monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `is_processed=eq.false`
        },
        () => {
          console.log('📨 [MONITOR] Nova mensagem detectada, recarregando stats...');
          loadStats();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [clientId, loadStats]);

  return {
    stats,
    processingStatus,
    isLoading,
    error,
    hasOldMessages: hasOldMessages(),
    isProcessing: unprocessedMessageProcessor.getIsProcessing(),
    
    // Actions
    loadStats,
    processUnprocessedMessages,
    updateProcessingStatus
  };
};