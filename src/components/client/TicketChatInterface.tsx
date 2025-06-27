
import React, { useState, useEffect, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTicketMessages } from '@/hooks/useTicketMessages';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHumanizedTyping } from '@/hooks/useHumanizedTyping';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import TicketHeader from './chat/TicketHeader';
import ConnectionStatus from './chat/ConnectionStatus';
import MessagesList from './chat/MessagesList';
import MessageInput from './chat/MessageInput';
import TypingIndicator from './TypingIndicator';
import { useTicketData } from './chat/useTicketData';
import { useAudioHandling } from './chat/useAudioHandling';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading } = useTicketMessages(ticketId);
  const { toast } = useToast();
  const { markActivity, isOnline } = useOnlineStatus(clientId, true);
  const { simulateHumanTyping, isTyping, isRecording } = useHumanizedTyping(clientId);
  const { simulateMessageProgression, getMessageStatus } = useMessageStatus();
  const { ticket, queueInfo, connectedInstance } = useTicketData(ticketId, clientId);
  const { handleAudioReady: processAudioReady } = useAudioHandling(ticketId);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleClearHistory = async () => {
    if (!ticketId || isClearing) return;

    try {
      setIsClearing(true);
      console.log('🗑️ Limpando histórico do ticket:', ticketId);

      const { error } = await supabase
        .from('ticket_messages')
        .delete()
        .eq('ticket_id', ticketId);

      if (error) {
        console.error('❌ Erro ao limpar histórico:', error);
        throw error;
      }

      console.log('✅ Histórico do ticket limpo com sucesso');
      
      toast({
        title: "Histórico Limpo",
        description: "Todas as mensagens do ticket foram removidas com sucesso"
      });

    } catch (error) {
      console.error('❌ Erro ao limpar histórico:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar histórico do ticket",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleAudioReady = async (audioBlob: Blob, duration: number) => {
    await processAudioReady(
      audioBlob, 
      duration, 
      ticket, 
      connectedInstance, 
      simulateMessageProgression, 
      markActivity
    );
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticket || !connectedInstance || isSending) {
      if (!connectedInstance) {
        toast({
          title: "Erro",
          description: "Nenhuma instância WhatsApp conectada",
          variant: "destructive"
        });
      }
      return;
    }

    try {
      setIsSending(true);
      const messageId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      simulateMessageProgression(messageId, false);
      
      console.log('📤 Enviando mensagem:', {
        instanceId: connectedInstance,
        chatId: ticket.chat_id,
        message: newMessage.substring(0, 50) + '...',
        customerPhone: ticket.customer?.phone
      });

      markActivity();

      const response = await whatsappService.sendMessage(
        connectedInstance,
        ticket.chat_id,
        newMessage
      );

      console.log('📡 Resposta do envio:', response);

      if (response.success) {
        console.log('✅ Mensagem enviada com sucesso via WhatsApp');

        console.log('💾 Salvando mensagem manual no ticket:', {
          ticketId,
          content: newMessage.substring(0, 50)
        });
        
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: messageId,
          from_me: true,
          sender_name: 'Atendente',
          content: newMessage,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('💾 Mensagem manual registrada no ticket');
        setNewMessage('');
        
        toast({
          title: "Sucesso",
          description: "Mensagem enviada com sucesso"
        });
      } else {
        console.error('❌ Erro ao enviar mensagem via WhatsApp:', response.error);
        toast({
          title: "Erro",
          description: response.error || "Erro ao enviar mensagem",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
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
      <TicketHeader
        queueInfo={queueInfo}
        onClearHistory={handleClearHistory}
        isClearing={isClearing}
        messagesCount={messages.length}
      />

      <ConnectionStatus
        connectedInstance={connectedInstance}
        isOnline={isOnline}
      />

      <MessagesList
        messages={messages}
        scrollAreaRef={scrollAreaRef}
        getMessageStatus={getMessageStatus}
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
        connectedInstance={connectedInstance}
        isSending={isSending}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};

export default TicketChatInterface;
