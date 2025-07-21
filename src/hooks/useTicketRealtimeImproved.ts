
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { messageSyncService } from '@/services/messageSyncService';
import { useToast } from '@/hooks/use-toast';

export const useTicketRealtimeImproved = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const channelRef = useRef<any>(null);
  const messageSyncChannelRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const { toast } = useToast();

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      console.log('🔄 [TICKETS] Carregando tickets para cliente:', clientId);
      
      // Verificar se existem tickets no banco primeiro
      const { data: ticketCount, error: countError } = await supabase
        .from('conversation_tickets')
        .select('id', { count: 'exact' })
        .eq('client_id', clientId);
      
      console.log('📊 [TICKETS] Total de tickets no banco:', ticketCount?.length || 0);
      if (countError) {
        console.error('❌ [TICKETS] Erro ao contar tickets:', countError);
      }
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ [TICKETS] Tickets carregados via service:', ticketsData.length);
      console.log('📋 [TICKETS] Primeiros 3 tickets:', ticketsData.slice(0, 3));
      
      if (mountedRef.current) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('❌ [TICKETS] Erro ao carregar tickets:', error);
      if (mountedRef.current) {
        toast({
          title: "Erro ao carregar conversas",
          description: "Não foi possível carregar as conversas. Tentando novamente...",
          variant: "destructive"
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId, toast]);

  // Sincronizar mensagens não processadas
  const syncUnprocessedMessages = useCallback(async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
      setSyncStatus('syncing');
      console.log('🔄 [SYNC] Iniciando sincronização de mensagens não processadas');
      
      const result = await messageSyncService.syncUnprocessedMessages(clientId);
      
      if (mountedRef.current) {
        setSyncStatus('success');
        setLastSyncTime(new Date());
        
        if (result.processed > 0) {
          console.log(`✅ [SYNC] ${result.processed} mensagens sincronizadas`);
          
          toast({
            title: "Mensagens sincronizadas",
            description: `${result.processed} mensagens foram processadas${result.errors > 0 ? ` (${result.errors} erros)` : ''}`
          });
          
          // Recarregar tickets após sincronização
          setTimeout(loadTickets, 1000);
        }
        
        if (result.errors > 0) {
          console.warn(`⚠️ [SYNC] ${result.errors} erros durante sincronização`);
        }
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro na sincronização:', error);
      if (mountedRef.current) {
        setSyncStatus('error');
        toast({
          title: "Erro na sincronização",
          description: "Não foi possível sincronizar as mensagens. Tentando novamente...",
          variant: "destructive"
        });
      }
    }
  }, [clientId, loadTickets, toast]);

  // Configurar listeners de tempo real
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 [REALTIME] Configurando listeners para cliente:', clientId);
    mountedRef.current = true;

    // Carregar tickets iniciais
    loadTickets();

    // Sincronizar mensagens não processadas
    setTimeout(syncUnprocessedMessages, 2000);

    // Listener para mudanças nos tickets
    const ticketsChannel = supabase
      .channel(`tickets-realtime-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('🔄 [REALTIME] Mudança em tickets detectada:', payload.eventType);
          if (mountedRef.current) {
            setTimeout(loadTickets, 500);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages'
        },
        (payload) => {
          console.log('📨 [REALTIME] Nova mensagem em ticket detectada');
          if (mountedRef.current) {
            setTimeout(loadTickets, 500);
          }
        }
      )
      .subscribe();

    channelRef.current = ticketsChannel;

    // Listener para novas mensagens WhatsApp
    const messagesChannel = messageSyncService.setupRealtimeListener(
      clientId,
      (message) => {
        console.log('📨 [REALTIME] Nova mensagem WhatsApp processada:', message.message_id);
        if (mountedRef.current) {
          toast({
            title: "Nova mensagem recebida",
            description: "Uma nova mensagem foi processada automaticamente"
          });
          setTimeout(loadTickets, 1000);
        }
      }
    );

    messageSyncChannelRef.current = messagesChannel;

    // Sincronização automática periódica
    const syncInterval = setInterval(() => {
      if (mountedRef.current) {
        syncUnprocessedMessages();
      }
    }, 30000); // A cada 30 segundos

    return () => {
      console.log('🔌 [REALTIME] Limpando listeners');
      mountedRef.current = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (messageSyncChannelRef.current) {
        supabase.removeChannel(messageSyncChannelRef.current);
      }
      
      clearInterval(syncInterval);
    };
  }, [clientId, loadTickets, syncUnprocessedMessages, toast]);

  const reloadTickets = useCallback(() => {
    if (mountedRef.current) {
      loadTickets();
    }
  }, [loadTickets]);

  const forceSyncMessages = useCallback(() => {
    if (mountedRef.current) {
      syncUnprocessedMessages();
    }
  }, [syncUnprocessedMessages]);

  return {
    tickets,
    isLoading,
    syncStatus,
    lastSyncTime,
    reloadTickets,
    forceSyncMessages,
    // Compatibilidade com hook antigo
    isTyping: false,
    isOnline: true,
    getBatchInfo: () => ({ pending: 0, processing: false }),
    isAssistantTyping: () => false,
    isAssistantRecording: () => false
  };
};
