
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
      
      console.log('📊 [TICKETS] Total de tickets no banco:', ticketCount?.length || 0);
      if (countError) {
        console.error('❌ [TICKETS] Erro ao contar tickets:', countError);
      }

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
        
        console.log('📨 [TICKETS] Mensagens não processadas:', unprocessedMessages?.length || 0);
      }
      
      const ticketsData = await ticketsService.getTicketsByClient(clientId);
      console.log('✅ [TICKETS] Tickets carregados via service:', ticketsData.length);
      console.log('📋 [TICKETS] Primeiros 3 tickets:', ticketsData.slice(0, 3).map(t => ({
        id: t.id,
        title: t.title,
        customerName: t.customer?.name,
        phone: t.customer?.phone,
        lastMessage: t.last_message_preview?.substring(0, 50)
      })));
      
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
          console.log(`✅ [SYNC] ${result.converted} mensagens YUMER convertidas`);
          
          // Recarregar tickets após sincronização
          setTimeout(loadTickets, 1000);
        }
        
        if (result.errors > 0) {
          console.warn(`⚠️ [SYNC] ${result.errors} erros durante conversão YUMER`);
        }
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro na sincronização YUMER:', error);
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
          console.log('🔄 [REALTIME] Mudança em tickets detectada:', payload.eventType, (payload.new as any)?.id);
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
          console.log('📨 [REALTIME] Nova mensagem em ticket detectada:', (payload.new as any)?.id);
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
          console.log('📨 [REALTIME] Nova mensagem WhatsApp/YUMER detectada:', payload.new?.message_id);
          
          // Verificar se a mensagem pertence a uma instância do cliente
          const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('client_id')
            .eq('instance_id', payload.new?.instance_id)
            .single();

          if (instance?.client_id === clientId && mountedRef.current) {
            console.log('✅ [REALTIME] Mensagem pertence ao cliente, processando...');
            
            toast({
              title: "Nova mensagem recebida",
              description: "Uma nova mensagem foi detectada e será processada automaticamente"
            });
            
            // Aguardar um pouco e recarregar tickets
            setTimeout(loadTickets, 1000);
          }
        }
      )
      .subscribe();

    messageSyncChannelRef.current = messagesChannel;

    // Sincronização automática periódica (a cada 30 segundos)
    const syncInterval = setInterval(() => {
      if (mountedRef.current) {
        syncUnprocessedMessages();
      }
    }, 30000);

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
