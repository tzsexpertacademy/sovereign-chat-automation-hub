
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { useOnlineStatus } from './useOnlineStatus';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(true); // SEMPRE ONLINE
  
  // Hook para gerenciar status online
  const { markActivity } = useOnlineStatus(clientId, true);

  const loadTickets = useCallback(async () => {
    try {
      console.log('🎫 Carregando tickets para cliente:', clientId);
      setIsLoading(true);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      setTickets(ticketsData);
      
      console.log(`✅ ${ticketsData.length} tickets carregados`);
      
      // Marcar atividade quando carregar tickets
      markActivity();
      
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, markActivity]);

  // Simular indicadores de IA ativa
  const simulateAIActivity = useCallback(() => {
    // Simular digitação ocasional
    const typingInterval = setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000 + Math.random() * 3000);
      }
    }, 30000); // A cada 30 segundos

    // Simular gravação ocasional
    const recordingInterval = setInterval(() => {
      if (Math.random() < 0.05) { // 5% chance
        setIsRecording(true);
        setTimeout(() => setIsRecording(false), 1000 + Math.random() * 2000);
      }
    }, 45000); // A cada 45 segundos

    return () => {
      clearInterval(typingInterval);
      clearInterval(recordingInterval);
    };
  }, []);

  // Escutar mudanças em tempo real
  useEffect(() => {
    if (!clientId) return;

    loadTickets();

    // Escutar novos tickets
    const ticketsChannel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('🔄 Mudança em ticket:', payload);
          loadTickets();
        }
      )
      .subscribe();

    // Escutar mudanças em mensagens
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages'
        },
        (payload) => {
          console.log('💬 Nova mensagem:', payload);
          
          // Simular indicadores quando há atividade de IA
          if (payload.new && (payload.new as any).is_ai_response) {
            setIsTyping(true);
            setTimeout(() => setIsTyping(false), 1500);
          }
          
          loadTickets();
          markActivity();
        }
      )
      .subscribe();

    // Simular atividade da IA
    const cleanupAI = simulateAIActivity();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(messagesChannel);
      cleanupAI();
    };
  }, [clientId, loadTickets, markActivity, simulateAIActivity]);

  // Manter sempre online
  useEffect(() => {
    setIsOnline(true);
    
    const onlineInterval = setInterval(() => {
      setIsOnline(true);
      markActivity();
    }, 10000); // A cada 10 segundos

    return () => clearInterval(onlineInterval);
  }, [markActivity]);

  const reloadTickets = useCallback(() => {
    loadTickets();
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping,
    isRecording,
    isOnline,
    reloadTickets
  };
};
