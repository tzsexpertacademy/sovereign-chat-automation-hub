import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { yumerMessageSyncService } from '@/services/yumerMessageSyncService';
import { whatsappMessageProcessor } from '@/services/whatsappMessageProcessor';

interface WhatsAppMessageSyncConfig {
  clientId: string;
  onMessageProcessed?: (messageId: string) => void;
}

export const useWhatsAppMessageSync = ({ 
  clientId, 
  onMessageProcessed 
}: WhatsAppMessageSyncConfig) => {
  const channelRef = useRef<any>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 🔄 FORÇA PROCESSAMENTO de mensagens não processadas
  const forceProcessUnprocessedMessages = useCallback(async () => {
    console.log('🔄 [WA-SYNC] Verificando mensagens não processadas...');
    
    try {
      // Usar novo processador direto
      const result = await whatsappMessageProcessor.processUnprocessedMessages(clientId);
      if (result.processed > 0) {
        console.log(`✅ [WA-SYNC] ${result.processed} mensagens processadas`);
        onMessageProcessed?.('bulk_processing');
      }
      
      // Fallback com Yumer se necessário
      if (result.processed === 0) {
        const yumerResult = await yumerMessageSyncService.convertUnprocessedMessages(clientId);
        if (yumerResult.converted > 0) {
          console.log(`✅ [WA-SYNC] ${yumerResult.converted} mensagens via Yumer`);
          onMessageProcessed?.('yumer_fallback');
        }
      }
    } catch (error) {
      console.error('❌ [WA-SYNC] Erro ao processar mensagens:', error);
    }
  }, [clientId, onMessageProcessed]);

  // 📡 ESCUTA novas mensagens WhatsApp
  const setupRealtimeListener = useCallback(() => {
    if (!clientId || channelRef.current) return;

    const channel = supabase
      .channel(`whatsapp-sync-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `is_processed=eq.false`
        },
        async (payload) => {
          if (payload.new) {
            const newMessage = payload.new as any;
            console.log('📨 [WA-SYNC] Nova mensagem WhatsApp detectada:', newMessage.message_id);
            
            // Aguardar 2 segundos e forçar processamento
            setTimeout(() => {
              forceProcessUnprocessedMessages();
            }, 2000);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    console.log('📡 [WA-SYNC] Listener ativo para WhatsApp messages');
  }, [clientId, forceProcessUnprocessedMessages]);

  // ⏰ POLLING DE BACKUP (a cada 10 segundos)
  const startBackupPolling = useCallback(() => {
    if (syncIntervalRef.current) return;

    syncIntervalRef.current = setInterval(() => {
      forceProcessUnprocessedMessages();
    }, 10000); // 10 segundos

    console.log('⏰ [WA-SYNC] Polling de backup iniciado (10s)');
  }, [forceProcessUnprocessedMessages]);

  // 🚀 INICIALIZAÇÃO
  useEffect(() => {
    if (!clientId) return;

    // Processar mensagens existentes imediatamente
    forceProcessUnprocessedMessages();
    
    // Configurar listeners e polling
    setupRealtimeListener();
    startBackupPolling();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      console.log('🧹 [WA-SYNC] Cleanup realizado');
    };
  }, [clientId, setupRealtimeListener, startBackupPolling, forceProcessUnprocessedMessages]);

  return {
    forceSync: forceProcessUnprocessedMessages,
    isActive: channelRef.current !== null
  };
};