
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
  
  // Hook para gerenciar status online - CORRIGIDO
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

  // Simular indicadores de IA ativa - APRIMORADO
  const simulateAIActivity = useCallback(() => {
    // Simular digitação ocasional - mais realista
    const typingInterval = setInterval(() => {
      if (Math.random() < 0.08) { // 8% chance
        setIsTyping(true);
        const typingDuration = 2000 + Math.random() * 4000; // 2-6 segundos
        setTimeout(() => setIsTyping(false), typingDuration);
        console.log(`⌨️ IA simulando digitação por ${typingDuration}ms`);
      }
    }, 45000); // A cada 45 segundos

    // Simular gravação ocasional - mais realista
    const recordingInterval = setInterval(() => {
      if (Math.random() < 0.03) { // 3% chance
        setIsRecording(true);
        const recordingDuration = 1500 + Math.random() * 2500; // 1.5-4 segundos
        setTimeout(() => setIsRecording(false), recordingDuration);
        console.log(`🎤 IA simulando gravação por ${recordingDuration}ms`);
      }
    }, 60000); // A cada 1 minuto

    return () => {
      clearInterval(typingInterval);
      clearInterval(recordingInterval);
    };
  }, []);

  // Escutar mudanças em tempo real - OTIMIZADO
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

    // Escutar mudanças em mensagens - APRIMORADO
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
          
          // Simular indicadores quando há atividade de IA - CORRIGIDO
          if (payload.new && (payload.new as any).is_ai_response) {
            setIsTyping(true);
            setTimeout(() => setIsTyping(false), 1500);
            console.log('🤖 Atividade de IA detectada - mostrando digitação');
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

  // Manter sempre online - SIMPLIFICADO
  useEffect(() => {
    setIsOnline(true);
    
    // Marcar atividade periodicamente
    const onlineInterval = setInterval(() => {
      setIsOnline(true);
      markActivity();
      console.log(`📱 Status online mantido para cliente: ${clientId}`);
    }, 30000); // A cada 30 segundos

    return () => clearInterval(onlineInterval);
  }, [markActivity, clientId]);

  const reloadTickets = useCallback(() => {
    loadTickets();
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping,
    isRecording,
    isOnline: true, // SEMPRE ONLINE
    reloadTickets
  };
};
