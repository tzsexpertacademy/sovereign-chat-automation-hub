/**
 * HOOK SIMPLIFICADO PARA MENSAGENS DE TICKETS
 * Sistema ESTÁVEL - Single Source of Truth com Supabase Real-time APENAS
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

interface TicketMessagesUnifiedConfig {
  ticketId: string;
  clientId: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastUpdate: number;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export const useTicketMessagesUnified = ({ ticketId, clientId }: TicketMessagesUnifiedConfig) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateSource, setLastUpdateSource] = useState<'supabase'>('supabase');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastUpdate: 0,
    status: 'disconnected'
  });
  
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const messageIdsRef = useRef<Set<string>>(new Set());

  // 🎯 DEDUPLICAÇÃO SIMPLES e EFICAZ
  const addMessageSafely = useCallback((newMessage: TicketMessage) => {
    setMessages(prevMessages => {
      // Verificação O(1) com Set
      if (messageIdsRef.current.has(newMessage.message_id)) {
        return prevMessages;
      }

      // Verificação adicional por ID único do banco  
      const hasDbId = prevMessages.some(m => m.id === newMessage.id);
      if (hasDbId) {
        return prevMessages;
      }

      // ✅ ADICIONAR mensagem + cache do ID
      messageIdsRef.current.add(newMessage.message_id);
      const updated = [...prevMessages, newMessage];
      
      // Ordenar por timestamp
      return updated.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
  }, []);

  // 🚀 CARREGAMENTO SIMPLES via Supabase
  const loadMessages = useCallback(async () => {
    try {
      console.log(`🔄 [MESSAGES] Carregando mensagens para ticket: ${ticketId}`);
      
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('❌ [MESSAGES] Erro ao carregar:', error);
        setConnectionStatus(prev => ({ ...prev, isConnected: false, status: 'error' }));
        return;
      }

      if (data) {
        console.log(`✅ [MESSAGES] ${data.length} mensagens carregadas`);
        setMessages(data);
        messageIdsRef.current.clear();
        data.forEach(msg => messageIdsRef.current.add(msg.message_id));
        setLastUpdateSource('supabase');
      }

      setConnectionStatus(prev => ({ 
        ...prev, 
        isConnected: true, 
        lastUpdate: Date.now(),
        status: 'connected' 
      }));

    } catch (error) {
      console.error('❌ [MESSAGES] Erro crítico:', error);
      setConnectionStatus(prev => ({ 
        ...prev, 
        isConnected: false, 
        status: 'error' 
      }));
    }
  }, [ticketId, addMessageSafely]);

  // 🔗 LISTENER SUPABASE SIMPLES E ESTÁVEL
  const setupSupabaseListener = useCallback(() => {
    console.log(`🔗 [REALTIME] Configurando listener para ticket: ${ticketId}`);
    
    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public', 
        table: 'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        if (payload.new) {
          console.log('⚡ [REALTIME] Nova mensagem recebida:', payload.new);
          addMessageSafely(payload.new as TicketMessage);
          setConnectionStatus(prev => ({ 
            ...prev, 
            isConnected: true, 
            lastUpdate: Date.now(),
            status: 'connected'
          }));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ticket_messages', 
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        if (payload.new) {
          console.log('🔄 [REALTIME] Mensagem atualizada:', payload.new);
          setMessages(prevMessages => 
            prevMessages.map(msg => msg.id === payload.new.id ? payload.new as TicketMessage : msg)
          );
        }
      })
      .subscribe((status) => {
        console.log(`📡 [REALTIME] Status da conexão: ${status}`);
        setConnectionStatus(prev => ({ 
          ...prev, 
          isConnected: status === 'SUBSCRIBED', 
          lastUpdate: Date.now(),
          status: status === 'SUBSCRIBED' ? 'connected' : 'connecting'
        }));
      });

    return channel;
  }, [ticketId, addMessageSafely]);

  // Effect principal SUPER SIMPLIFICADO
  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    // Reset apenas ao trocar de ticket
    if (currentTicketRef.current !== ticketId) {
      console.log(`🔄 [INIT] Inicializando novo ticket: ${ticketId}`);
      currentTicketRef.current = ticketId;
      setMessages([]);
      messageIdsRef.current.clear();
      setIsLoading(true);
      
      // Cleanup anterior
      if (channelRef.current) {
        console.log('🧹 [CLEANUP] Removendo listener anterior');
        supabase.removeChannel(channelRef.current);
      }

      // Inicializar: carregar mensagens + setup real-time
      loadMessages().finally(() => setIsLoading(false));
      channelRef.current = setupSupabaseListener();
    }

    return () => {
      if (channelRef.current) {
        console.log('🧹 [CLEANUP] Limpeza final do listener');
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId, loadMessages, setupSupabaseListener]);

  return {
    messages,
    isLoading,
    lastUpdateSource,
    reload: loadMessages,
    isRealtimeActive: connectionStatus.isConnected,
    isPollingActive: false, // Polling removido
    connectionStatus
  };
};