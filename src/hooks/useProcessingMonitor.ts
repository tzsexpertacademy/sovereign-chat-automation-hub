/**
 * Hook para monitorar o status do sistema de processamento
 * Útil para debug e acompanhamento do pipeline de mensagens
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { messageProcessingController } from '@/services/messageProcessingController';

interface ProcessingStatus {
  batches: {
    total: number;
    pending: number;
    processing: number;
  };
  messages: {
    unprocessed: number;
    recentMessages: number;
  };
  controller: {
    activeLocks: number;
    processedMessages: number;
  };
  media: {
    pending: number;
    failed: number;
    completed: number;
  };
}

export const useProcessingMonitor = (clientId?: string) => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!clientId) return;
    
    setIsLoading(true);
    try {
      // Verificar batches
      const { data: batchesData } = await supabase
        .from('message_batches')
        .select('id, processing_started_at')
        .eq('client_id', clientId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const batches = {
        total: batchesData?.length || 0,
        pending: batchesData?.filter(b => !b.processing_started_at).length || 0,
        processing: batchesData?.filter(b => b.processing_started_at).length || 0
      };

      // Verificar mensagens não processadas
      const { data: messagesData } = await supabase
        .from('whatsapp_messages')
        .select('id, is_processed, created_at')
        .eq('client_id', clientId)
        .eq('from_me', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const messages = {
        unprocessed: messagesData?.filter(m => !m.is_processed).length || 0,
        recentMessages: messagesData?.length || 0
      };

      // Status do controller
      const controller = messageProcessingController.getStatus();

      // Verificar mídia pendente
      const { data: mediaData } = await supabase
        .from('ticket_messages')
        .select('id, message_type, processing_status')
        .in('message_type', ['audio', 'image', 'video', 'document'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const media = {
        pending: mediaData?.filter(m => m.processing_status === 'received').length || 0,
        failed: mediaData?.filter(m => m.processing_status === 'transcription_failed').length || 0,
        completed: mediaData?.filter(m => m.processing_status === 'completed').length || 0
      };

      setStatus({
        batches,
        messages,
        controller,
        media
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Erro ao buscar status de processamento:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  // Forçar processamento manual
  const forceProcessing = useCallback(async () => {
    try {
      console.log('🚀 [MONITOR] Forçando processamento manual...');
      
      // Chamar edge function de processamento de batches
      const { error: batchError } = await supabase.functions.invoke('process-message-batches', {
        body: { trigger: 'manual', chatId: null }
      });

      if (batchError) {
        console.error('❌ Erro ao processar batches:', batchError);
      } else {
        console.log('✅ Processamento de batches disparado');
      }

      // Chamar edge function de processamento de mídia
      const { error: mediaError } = await supabase.functions.invoke('process-received-media');

      if (mediaError) {
        console.error('❌ Erro ao processar mídia:', mediaError);
      } else {
        console.log('✅ Processamento de mídia disparado');
      }

      // Atualizar status após 2 segundos
      setTimeout(fetchStatus, 2000);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Erro no processamento manual:', error);
      return { success: false, error };
    }
  }, [fetchStatus]);

  // Limpar controller
  const cleanupController = useCallback(() => {
    messageProcessingController.cleanupOldProcessed();
    console.log('🧹 Controller limpo');
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (clientId) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [clientId, fetchStatus]);

  return {
    status,
    isLoading,
    lastUpdate,
    refresh: fetchStatus,
    forceProcessing,
    cleanupController
  };
};