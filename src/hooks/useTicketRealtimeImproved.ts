
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { yumerMessageSyncService } from '@/services/yumerMessageSyncService';
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

  // Carregar tickets com debug melhorado
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
      

      // Verificar mensagens não processadas
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId);

      if (instances && instances.length > 0) {
        const instanceIds = instances.map(i => i.instance_id);
        const { data: unprocessedMessages } = await supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact' })
          .in('instance_id', instanceIds)
          .eq('is_processed', false);
        
        
      }
      
      const ticketsData = await ticketsService.getTicketsByClient(clientId);
      
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

  // Sincronizar mensagens YUMER não processadas
  const syncUnprocessedMessages = useCallback(async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
      setSyncStatus('syncing');
      console.log('🔄 [SYNC] Iniciando sincronização de mensagens YUMER não processadas');
      
      const result = await yumerMessageSyncService.convertUnprocessedMessages(clientId);
      
      if (mountedRef.current) {
        setSyncStatus('success');
        setLastSyncTime(new Date());
        
        if (result.converted > 0) {
          setTimeout(loadTickets, 1000);
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        setSyncStatus('error');
        toast({
          title: "Erro na sincronização YUMER",
          description: "Não foi possível sincronizar as mensagens YUMER. Tentando novamente...",
          variant: "destructive"
        });
      }
    }
  }, [clientId, loadTickets, toast]);

  // Configurar listeners de tempo real melhorados
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 [REALTIME] Configurando listeners para cliente:', clientId);
    mountedRef.current = true;

    // Carregar tickets iniciais
    loadTickets();

    // Sincronizar mensagens YUMER não processadas após 2 segundos
    setTimeout(syncUnprocessedMessages, 2000);

    // Listener para mudanças nos tickets
    const ticketsChannel = supabase
      .channel(`tickets-realtime-yumer-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
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
          if (mountedRef.current) {
            setTimeout(loadTickets, 500);
          }
        }
      )
      .subscribe();

    channelRef.current = ticketsChannel;

    // Listener para novas mensagens WhatsApp/YUMER
    const messagesChannel = supabase
      .channel(`whatsapp-messages-yumer-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        async (payload) => {
          // Verificar se a mensagem pertence a uma instância do cliente
          const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('client_id')
            .eq('instance_id', payload.new?.instance_id)
            .single();

          if (instance?.client_id === clientId && mountedRef.current) {
            setTimeout(loadTickets, 1000);
          }
        }
      )
      .subscribe();

    messageSyncChannelRef.current = messagesChannel;

    // Sincronização automática periódica (a cada 2 minutos para reduzir carga)
    const syncInterval = setInterval(() => {
      if (mountedRef.current) {
        syncUnprocessedMessages();
      }
    }, 120000);

    return () => {
      console.log('🔌 [REALTIME] Limpando listeners YUMER');
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
