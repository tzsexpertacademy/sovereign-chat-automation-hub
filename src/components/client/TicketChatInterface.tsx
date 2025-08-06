import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { unifiedMessageService } from '@/services/unifiedMessageService';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { useToast } from '@/hooks/use-toast';
import { useTicketMessagesUnified } from '@/hooks/useTicketMessagesUnified';
import MessagesList from './chat/MessagesList';
import MessageInput from './chat/MessageInput';
import TypingIndicator from './TypingIndicator';
import PresenceKeepAlive from './chat/PresenceKeepAlive';

import { useTicketData } from './chat/useTicketData';
import { useAudioHandling } from './chat/useAudioHandling';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = memo(({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<TicketMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const debugCommandExecutingRef = useRef(false);
  const lastDebugExecutionRef = useRef<number>(0);
  
  const { toast } = useToast();
  const { ticket, queueInfo, connectedInstance, actualInstanceId } = useTicketData(ticketId, clientId);
  const { handleAudioReady: processAudioReady } = useAudioHandling(ticketId);

  // Sistema OTIMIZADO Real-Time - Hook único unificado 
  const {
    messages: realTimeMessages,
    isLoading,
    lastUpdateSource,
    reload,
    isRealtimeActive,
    isPollingActive,
    connectionStatus
  } = useTicketMessagesUnified({
    ticketId,
    clientId
  });

  // 🚀 MENSAGENS FINAIS: Real-time + Optimistic simples
  const allMessages = useMemo(() => {
    // Combinar mensagens reais + optimísticas
    const combined = [...realTimeMessages, ...optimisticMessages];
    
    // Remover duplicatas por message_id (optimistic pode ter conflito)
    const uniqueMessages = combined.filter((msg, index, arr) => 
      arr.findIndex(m => m.message_id === msg.message_id) === index
    );
    
    // Ordenar por timestamp 
    return uniqueMessages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [realTimeMessages, optimisticMessages]);

  // Limpar estado quando mudar de ticket
  useEffect(() => {
    setNewMessage('');
    setIsSending(false);
    setOptimisticMessages([]);
  }, [ticketId]);

  // 🎯 LIMPEZA AUTOMÁTICA: Remover optimistic quando real-time chega  
  useEffect(() => {
    if (realTimeMessages.length > 0) {
      setOptimisticMessages(prev => {
        const cleaned = prev.filter(opt => 
          !realTimeMessages.some(real => 
            real.message_id === opt.message_id || 
            real.content === opt.content && Math.abs(new Date(real.timestamp).getTime() - new Date(opt.timestamp).getTime()) < 5000
          )
        );
        
        if (cleaned.length !== prev.length) {
          console.log(`🧹 [OPTIMISTIC] Limpeza: ${prev.length - cleaned.length} mensagens removidas`);
        }
        
        return cleaned;
      });
    }
  }, [realTimeMessages]);

  // 🚀 AUTO-SCROLL ULTRA-SUAVE para novas mensagens
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        requestAnimationFrame(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        });
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages, scrollToBottom]);

  // 🎯 DETECTAR novas mensagens para feedback visual imediato
  const prevMessagesLength = useRef(allMessages.length);
  useEffect(() => {
    if (allMessages.length > prevMessagesLength.current) {
      console.log('⚡ [OPTIMISTIC] Nova mensagem detectada - Scroll automático');
      prevMessagesLength.current = allMessages.length;
      scrollToBottom();
    }
  }, [allMessages.length, scrollToBottom]);

  const handleAudioReady = async (audioBlob: Blob, duration: number) => {
      await processAudioReady(
        audioBlob, 
        duration, 
        ticket, 
        actualInstanceId, 
        () => console.log('Activity marked')
      );
  };

  const handleSendMessage = useCallback(async (messageContent?: string, audioBlob?: Blob, audioDuration?: number) => {
    const content = messageContent || newMessage.trim();
    if (!content && !audioBlob) return;

    if (!ticket || !actualInstanceId) {
      toast({
        title: "❌ Erro",
        description: "Conexão não estabelecida",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    const messageId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // 🚀 OPTIMISTIC UI SIMPLES: Mostrar mensagem imediatamente
    const optimisticMessage: TicketMessage = {
      id: messageId,
      ticket_id: ticketId,
      message_id: messageId,
      from_me: true,
      sender_name: 'Você',
      content,
      message_type: audioBlob ? 'audio' : 'text',
      timestamp,
      is_internal_note: false,
      is_ai_response: false,
      processing_status: 'sending',
      created_at: timestamp,
      media_duration: audioDuration
    };

    console.log('⚡ [OPTIMISTIC] Adicionando mensagem optimística:', optimisticMessage);
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    try {
      // Debug commands - bypass para edge functions
      if (content.startsWith('/debug')) {
        const { debugBlocoService } = await import('@/services/debugBlocoService');
        await debugBlocoService.handleDebugCommand(ticketId, clientId, actualInstanceId, ticket.chat_id);
        setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        return;
      }

      // Comandos de AI diretos para Edge Function
      if (content.includes('faça um audio') || content.includes('analise a imagem')) {
        await supabase.functions.invoke('ai-assistant-process', {
          body: {
            chatId: ticket.chat_id,
            instanceId: actualInstanceId,
            clientId,
            content,
            messageId,
            timestamp: Date.now(),
            fromMe: true,
            pushName: 'Manual'
          }
        });
        
        setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        toast({ title: "✅ Sucesso", description: "Comando enviado para processamento" });
        return;
      }

      // 🚀 ENVIO ÚNICO VIA UNIFIED SERVICE - sem salvamento duplo
      const result = await unifiedMessageService.sendSmartMessage(
        actualInstanceId,
        ticket.chat_id,
        content,
        clientId,
        ticket.assigned_assistant_id || undefined,
        {
        onTypingStart: () => console.log('Typing started'),
          onTypingStop: () => console.log('Typing stopped')
        }
      );

      if (!result.success) {
        throw new Error(result.errors?.[0] || 'Erro no envio');
      }

      // ✅ ATUALIZAR STATUS E AGUARDAR REAL-TIME
      setOptimisticMessages(prev => 
        prev.map(m => m.message_id === messageId 
          ? { ...m, processing_status: 'sent', message_id: result.messageIds?.[0] || messageId } 
          : m
        )
      );

      console.log('✅ [SEND] Mensagem enviada com sucesso:', result);
      toast({ title: "✅ Sucesso", description: "Mensagem enviada" });

    } catch (error) {
      console.error('❌ [CHAT] Erro:', error);
      
      // 🚨 ROLLBACK OPTIMISTIC em caso de erro
      console.error('❌ [SEND] Erro ao enviar:', error);
      setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
      
      toast({
        title: "❌ Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  }, [newMessage, ticketId, clientId, ticket, actualInstanceId, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Carregando mensagens...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PresenceKeepAlive
        clientId={clientId}
        instanceId={actualInstanceId}
        chatId={ticket?.chat_id}
      />
      
      <div className="flex-1 overflow-hidden">
        <MessagesList
          messages={allMessages}
          scrollAreaRef={scrollAreaRef}
          getMessageStatus={() => 'sent'}
          ticketId={ticketId}
          instanceId={actualInstanceId}
          chatId={ticket?.chat_id}
          wsConnected={isRealtimeActive}
          isFallbackActive={isPollingActive}
          isCircuitBreakerBlocked={false}
          lastUpdateSource={lastUpdateSource as 'supabase' | 'polling' | 'websocket'}
          connectionStatus={connectionStatus}
        />
      </div>


      <div className="border-t border-border p-4">
        <MessageInput
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSendMessage={() => handleSendMessage()}
          onAudioReady={handleAudioReady}
          connectedInstance={actualInstanceId}
          isSending={isSending}
          onKeyPress={handleKeyPress}
          chatId={ticket?.chat_id || ''}
          ticketId={ticketId}
        />
      </div>
    </div>
  );
});

TicketChatInterface.displayName = 'TicketChatInterface';

export default TicketChatInterface;