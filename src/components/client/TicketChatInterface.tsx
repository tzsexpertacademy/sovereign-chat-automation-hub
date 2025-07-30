
import React, { useState, useEffect, useRef } from 'react';
import { unifiedMessageService } from '@/services/unifiedMessageService';
import { ticketsService } from '@/services/ticketsService';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedTicketMessages } from '@/hooks/useUnifiedTicketMessages';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHumanizedTyping } from '@/hooks/useHumanizedTyping';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import MessagesList from './chat/MessagesList';
import MessageInput from './chat/MessageInput';
import TypingIndicator from './TypingIndicator';
import PresenceKeepAlive from './chat/PresenceKeepAlive';

import { useTicketData } from './chat/useTicketData';
import { useAudioHandling } from './chat/useAudioHandling';
import WebSocketStatus from './WebSocketStatus';
import UnifiedMessagesDebug from './UnifiedMessagesDebug';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const { markActivity, isOnline } = useOnlineStatus(clientId, true);
  const { simulateHumanTyping, isTyping, isRecording } = useHumanizedTyping(clientId);
  const { getMessageStatus } = useMessageStatus({ ticketId });
  const { ticket, queueInfo, connectedInstance, actualInstanceId } = useTicketData(ticketId, clientId);
  const { handleAudioReady: processAudioReady } = useAudioHandling(ticketId);

  // Unified Messages - WebSocket + Supabase + Polling inteligente
  const { 
    messages, 
    isLoading, 
    wsConnected, 
    isFallbackActive, 
    reconnectAttempts, 
    lastUpdateSource,
    reload 
  } = useUnifiedTicketMessages({
    ticketId,
    clientId,
    instanceId: actualInstanceId
  });

  // Limpar estado quando mudar de ticket
  useEffect(() => {
    setNewMessage('');
    setIsSending(false);
  }, [ticketId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);


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
      const messageId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      // Limpar input imediatamente para feedback visual
      setNewMessage('');
      
      
      console.log('📤 [TICKET-SEND] Iniciando envio:', {
        instanceId: actualInstanceId,
        chatId: ticket.chat_id,
        messagePreview: messageToSend.substring(0, 50) + '...',
        customerPhone: ticket.customer?.phone,
        ticketId
      });

      markActivity();

      // Enviar mensagem manual via serviço unificado
      const response = await unifiedMessageService.sendManualMessage(
        actualInstanceId,
        ticket.chat_id,
        messageToSend,
        clientId
      );
      
      console.log('📡 [TICKET-SEND] Resposta completa:', {
        success: response.success,
        error: response.error,
        details: response.details,
        messageId: response.messageId,
        timestamp: response.timestamp
      });

      if (response.success) {
        console.log('✅ [TICKET-SEND] Mensagem enviada - salvando no ticket');

        // Salvar no banco de dados com timestamp real da API
        await ticketsService.addTicketMessage({
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

        console.log('💾 [TICKET-SEND] Mensagem salva no ticket com sucesso');
      } else {
        console.error('❌ [TICKET-SEND] Falha no envio:', {
          error: response.error,
          details: response.details,
          instanceId: actualInstanceId
        });
        
        toast({
          title: "❌ Erro no Envio",
          description: response.details ? 
            `${response.error}\n${response.details}` : 
            (response.error || "Erro desconhecido ao enviar mensagem"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [TICKET-SEND] Erro crítico:', error);
      
      toast({
        title: "❌ Erro Crítico",
        description: "Falha na comunicação com o servidor. Verifique sua conexão.",
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
      
      {/* WebSocket Status - Sistema Unificado */}
      <div className="flex justify-between items-center p-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Última atualização: <span className="font-medium text-foreground">{lastUpdateSource}</span>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {showDebug ? 'Ocultar' : 'Debug'}
          </button>
        </div>
        <WebSocketStatus
          isConnected={wsConnected}
          isFallbackActive={isFallbackActive}
          reconnectAttempts={reconnectAttempts}
        />
      </div>

      {/* Painel de Debug */}
      {showDebug && (
        <div className="p-2 border-b bg-muted/20">
          <UnifiedMessagesDebug
            wsConnected={wsConnected}
            isFallbackActive={isFallbackActive}
            reconnectAttempts={reconnectAttempts}
            lastUpdateSource={lastUpdateSource}
            messagesCount={messages.length}
            onReload={reload}
          />
        </div>
      )}

      <MessagesList
        messages={messages}
        scrollAreaRef={scrollAreaRef}
        getMessageStatus={(messageId: string) => getMessageStatus(messageId)}
        ticketId={ticketId}
        instanceId={ticket?.instance_id}
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
      />
    </div>
  );
};

export default TicketChatInterface;
