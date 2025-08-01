
import React, { useState, useEffect, useRef } from 'react';
import { unifiedMessageService } from '@/services/unifiedMessageService';
import { ticketsService } from '@/services/ticketsService';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedTicketMessages } from '@/hooks/useOptimizedTicketMessages';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHumanizedTyping } from '@/hooks/useHumanizedTyping';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import MessagesList from './chat/MessagesList';
import MessageInput from './chat/MessageInput';
import TypingIndicator from './TypingIndicator';
import PresenceKeepAlive from './chat/PresenceKeepAlive';

import { useTicketData } from './chat/useTicketData';
import { useAudioHandling } from './chat/useAudioHandling';
import FinalSimpleStatus from './FinalSimpleStatus';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const { markActivity, isOnline } = useOnlineStatus(clientId, true);
  const { simulateHumanTyping, isTyping, isRecording } = useHumanizedTyping(clientId);
  const { getMessageStatus } = useMessageStatus({ ticketId });
  const { ticket, queueInfo, connectedInstance, actualInstanceId } = useTicketData(ticketId, clientId);
  const { handleAudioReady: processAudioReady } = useAudioHandling(ticketId);

  // Sistema 100% Real-Time - Supabase + Optimistic Updates
  const { 
    messages, 
    isLoading, 
    lastUpdateSource,
    reload,
    isSupabaseActive,
    isPollingActive,
    addOptimisticMessage,
    confirmOptimisticMessage,
    failOptimisticMessage
  } = useOptimizedTicketMessages({
    ticketId,
    clientId
  });

  // Limpar estado quando mudar de ticket
  useEffect(() => {
    setNewMessage('');
    setIsSending(false);
  }, [ticketId]);

  // 🚀 AUTO-SCROLL ULTRA-SUAVE para novas mensagens
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        // ⚡ SCROLL INSTANTÂNEO com animação suave
        requestAnimationFrame(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        });
      }
    }
  }, [messages]);

  // 🎯 DETECTAR novas mensagens para feedback visual imediato
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      console.log('⚡ [ULTRA-FAST] Nova mensagem detectada - Scroll automático');
      prevMessagesLength.current = messages.length;
    }
  }, [messages.length]);


  const handleAudioReady = async (audioBlob: Blob, duration: number) => {
      await processAudioReady(
        audioBlob, 
        duration, 
        ticket, 
        actualInstanceId, 
        markActivity
      );
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticket || !actualInstanceId || isSending) {
      if (!actualInstanceId) {
        toast({
          title: "❌ Erro de Conexão",
          description: "Nenhuma instância WhatsApp conectada. Conecte uma instância primeiro.",
          variant: "destructive"
        });
      } else if (!newMessage.trim()) {
        toast({
          title: "❌ Mensagem Vazia",
          description: "Digite uma mensagem antes de enviar.",
          variant: "destructive"
        });
      }
      return;
    }

    try {
      setIsSending(true);
      const messageToSend = newMessage.trim();
      const messageId = `rest_msg_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // Limpar input imediatamente
      setNewMessage('');
      
      // ⚡ OPTIMISTIC UPDATE ULTRA-RÁPIDO - ZERO delay visual
      const optimisticMessageId = addOptimisticMessage({
        message_id: messageId,
        content: messageToSend,
        message_type: 'text',
        from_me: true,
        sender_name: '⚡ Enviando...',
        timestamp: timestamp,
        processing_status: 'sending'
      });
      
      console.log('⚡ [ULTRA-FAST] Mensagem INSTANTÂNEA criada, enviando:', {
        instanceId: actualInstanceId,
        chatId: ticket.chat_id,
        messagePreview: messageToSend.substring(0, 50) + '...',
        optimisticId: optimisticMessageId,
        instantTime: Date.now()
      });

      markActivity();

      // Enviar mensagem via API
      const response = await unifiedMessageService.sendManualMessage(
        actualInstanceId,
        ticket.chat_id,
        messageToSend,
        clientId
      );
      
      if (response.success) {
        console.log('⚡ [ULTRA-FAST] Enviado com SUCESSO, salvando no banco IMEDIATAMENTE...');

        // 🚀 SALVAR INSTANTANEAMENTE no banco
        const savePromise = ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: response.messageId || messageId,
          from_me: true,
          sender_name: 'Atendente',
          content: messageToSend,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          timestamp: typeof response.timestamp === 'string' ? response.timestamp : timestamp
        });

        // ⚡ CONFIRMAR IMEDIATAMENTE (Supabase detectará em < 1 segundo)
        confirmOptimisticMessage(optimisticMessageId);
        
        // 🚀 AGUARDAR salvamento em paralelo (não bloqueia UI)
        savePromise.then(() => {
          console.log('💾 [ULTRA-FAST] Mensagem SALVA com sucesso no banco');
        }).catch(error => {
          console.error('❌ [ULTRA-FAST] Erro ao salvar (mas enviou):', error);
        });
        
        console.log('✅ [ULTRA-FAST] Fluxo COMPLETO - Instantâneo para usuário');
      } else {
        console.error('❌ [ULTRA-FAST] FALHA no envio:', response.error);
        
        // ❌ FALHA IMEDIATA com feedback visual
        failOptimisticMessage(optimisticMessageId);
        
        toast({
          title: "❌ Falha no Envio",
          description: response.details || response.error || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [REAL-TIME] Erro crítico:', error);
      
      toast({
        title: "❌ Erro Crítico",
        description: "Falha na comunicação com o servidor.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <PresenceKeepAlive
        clientId={clientId}
        instanceId={actualInstanceId || ''}
        chatId={ticket?.chat_id || ''}
        enabled={!!(actualInstanceId && ticket?.chat_id)}
      />
      
      {/* Status - Chat ULTRA-FLUIDO */}
      <div className="flex justify-between items-center p-2 border-b bg-gradient-to-r from-green-50 to-blue-50">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-green-600 animate-pulse">⚡ CHAT ULTRA-FLUIDO</span>
          <span className="ml-2 text-xs text-green-700">
            {lastUpdateSource === 'supabase' ? '📡 Supabase Instantâneo' : '🔄 Polling Backup'}
          </span>
          <span className="ml-2 text-xs text-blue-600">
            • {messages.length} msgs • {'<'} 1s delay
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-600 font-medium">ATIVO</span>
        </div>
      </div>

      <MessagesList
        messages={messages}
        scrollAreaRef={scrollAreaRef}
        getMessageStatus={(messageId: string) => getMessageStatus(messageId)}
        ticketId={ticketId}
        instanceId={ticket?.instance_id}
        chatId={ticket?.chat_id}
        wsConnected={isSupabaseActive}
        isFallbackActive={!isSupabaseActive}
        isCircuitBreakerBlocked={false}
        lastUpdateSource={lastUpdateSource}
      />

      {(isTyping(ticket?.chat_id || '') || isRecording(ticket?.chat_id || '')) && (
        <TypingIndicator 
          isTyping={isTyping(ticket?.chat_id || '')}
          isRecording={isRecording(ticket?.chat_id || '')}
          userName="🤖 Assistente IA"
          isAI={true}
        />
      )}

      <MessageInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSendMessage={handleSendMessage}
        onAudioReady={handleAudioReady}
        connectedInstance={actualInstanceId}
        isSending={isSending}
        onKeyPress={handleKeyPress}
        chatId={ticket?.chat_id || ''}
        ticketId={ticketId}
      />
    </div>
  );
};

export default TicketChatInterface;
