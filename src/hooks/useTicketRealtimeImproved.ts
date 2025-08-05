
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { yumerMessageSyncService } from '@/services/yumerMessageSyncService';
import { useToast } from '@/hooks/use-toast';

// Debounce para evitar múltiplas chamadas
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const useTicketRealtimeImproved = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const lastLoadTime = useRef<number>(0);
  const { toast } = useToast();

  // Carregar tickets com debounce para evitar loop infinito
  const loadTickets = useCallback(async () => {
    if (!clientId || !mountedRef.current) return;
    
    // Throttle: máximo 1 call por segundo
    const now = Date.now();
    if (now - lastLoadTime.current < 1000) {
      console.log('🔄 [TICKETS] Carregamento throttled, aguardando...');
      return;
    }
    lastLoadTime.current = now;
    
    try {
      setIsLoading(true);
      console.log('🔄 [TICKETS] Carregando tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getTicketsByClient(clientId);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
        console.log('✅ [TICKETS] Tickets carregados:', ticketsData.length);
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

  // Debounced loadTickets para evitar múltiplas chamadas - REDUZIDO para reabertura rápida
  const debouncedLoadTickets = useCallback(
    debounce(() => {
      if (mountedRef.current) {
        console.log('🚀 [REALTIME] Executando reload debounced');
        loadTickets();
      }
    }, 300), // 300ms de debounce para atualizações rápidas
    [loadTickets]
  );

  // Configurar listeners de tempo real otimizados
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 [REALTIME] Configurando listeners para cliente:', clientId);
    mountedRef.current = true;

    // Carregar tickets iniciais
    loadTickets();

    // Sincronizar mensagens YUMER não processadas após 3 segundos
    setTimeout(syncUnprocessedMessages, 3000);

    // ✅ LISTENER UNIFICADO MELHORADO COM LOGS ESPECÍFICOS
    const unifiedChannel = supabase
      .channel(`tickets-unified-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          const { eventType, new: newTicket, old: oldTicket } = payload;
          console.log('🔄 [REALTIME] Mudança em ticket detectada:', {
            evento: eventType,
            ticketId: (newTicket as any)?.id || (oldTicket as any)?.id,
            status: (newTicket as any)?.status,
            filaId: (newTicket as any)?.assigned_queue_id,
            oldStatus: (oldTicket as any)?.status,
            oldFilaId: (oldTicket as any)?.assigned_queue_id
          });

          // DETECTAR REABERTURA AUTOMÁTICA
          if (eventType === 'UPDATE' && oldTicket && newTicket) {
            const oldT = oldTicket as any;
            const newT = newTicket as any;
            const statusMudou = oldT.status !== newT.status;
            const filaMudou = oldT.assigned_queue_id !== newT.assigned_queue_id;
            
            if (statusMudou && ['closed', 'resolved'].includes(oldT.status) && newT.status === 'open') {
              console.log('🔓 [REALTIME] REABERTURA AUTOMÁTICA DETECTADA!', {
                ticketId: newT.id,
                statusAnterior: oldT.status,
                novoStatus: newT.status,
                novaFila: newT.assigned_queue_id
              });
            }
            
            if (filaMudou) {
              console.log('🔄 [REALTIME] TRANSFERÊNCIA DE FILA DETECTADA!', {
                ticketId: newT.id,
                filaAnterior: oldT.assigned_queue_id,
                novaFila: newT.assigned_queue_id
              });
            }
          }
          
          debouncedLoadTickets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages'
        },
        async (payload) => {
          // Verificar se a mensagem pertence a um ticket do cliente
          const { data: ticket } = await supabase
            .from('conversation_tickets')
            .select('client_id')
            .eq('id', payload.new?.ticket_id)
            .single();

          if (ticket?.client_id === clientId && mountedRef.current) {
            console.log('📨 [REALTIME] Nova mensagem detectada:', {
              ticketId: payload.new?.ticket_id,
              messageId: payload.new?.message_id,
              conteudo: payload.new?.content?.substring(0, 30)
            });
            debouncedLoadTickets();
          }
        }
      )
      .subscribe();

    channelRef.current = unifiedChannel;

    // Sincronização automática periódica reduzida
    const syncInterval = setInterval(() => {
      if (mountedRef.current) {
        syncUnprocessedMessages();
      }
    }, 180000); // 3 minutos

    return () => {
      console.log('🔌 [REALTIME] Limpando listeners');
      mountedRef.current = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      clearInterval(syncInterval);
    };
  }, [clientId, loadTickets, debouncedLoadTickets, syncUnprocessedMessages]);

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
