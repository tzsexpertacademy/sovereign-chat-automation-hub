import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { unifiedMessageService } from '@/services/unifiedMessageService';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { useToast } from '@/hooks/use-toast';
import { useTicketMessagesUnified } from '@/hooks/useTicketMessagesUnified';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHumanizedTyping } from '@/hooks/useHumanizedTyping';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import { useAudioAutoProcessor } from '@/hooks/useAudioAutoProcessor';
import { useAudioProcessingMonitor } from '@/hooks/useAudioProcessingMonitor';
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

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<TicketMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const debugCommandExecutingRef = useRef(false);
  const lastDebugExecutionRef = useRef<number>(0);
  
  const { toast } = useToast();
  const { markActivity, isOnline } = useOnlineStatus(clientId, true);
  const { simulateHumanTyping, isTyping, isRecording, startTyping, stopTyping } = useHumanizedTyping(clientId);
  const { getMessageStatus } = useMessageStatus({ ticketId });
  const { ticket, queueInfo, connectedInstance, actualInstanceId } = useTicketData(ticketId, clientId);
  const { handleAudioReady: processAudioReady } = useAudioHandling(ticketId);
  
  // 🎵 PROCESSAMENTO AUTOMÁTICO DE ÁUDIO: Transcrição em tempo real
  useAudioAutoProcessor(clientId);
  
  // 📊 MONITORAMENTO DE PROCESSAMENTO DE ÁUDIO
  const { startMonitoring, stopMonitoring, isMonitoring } = useAudioProcessingMonitor(clientId);
  
  // Iniciar monitoramento automático
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, []);

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

  // 🚀 OPTIMISTIC UI: Combinar mensagens reais + optimísticas
  const allMessages = useMemo(() => {
    const combined = [...realTimeMessages, ...optimisticMessages];
    // Ordenar por timestamp e remover duplicatas por message_id
    const unique = combined.reduce((acc, msg) => {
      const existing = acc.find(m => m.message_id === msg.message_id);
      if (!existing) {
        acc.push(msg);
      }
      return acc;
    }, [] as TicketMessage[]);
    
    return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [realTimeMessages, optimisticMessages]);

  // Limpar estado quando mudar de ticket
  useEffect(() => {
    setNewMessage('');
    setIsSending(false);
    setOptimisticMessages([]);
  }, [ticketId]);

  // 🎯 LIMPAR optimistic messages quando mensagem real chega
  useEffect(() => {
    if (realTimeMessages.length > 0) {
      setOptimisticMessages(prev => 
        prev.filter(opt => !realTimeMessages.some(real => real.message_id === opt.message_id))
      );
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
        markActivity
      );
  };

  const handleSendMessage = useCallback(async (messageContent?: string, audioBlob?: Blob, audioDuration?: number) => {
    const content = messageContent || newMessage.trim();
    if (!content && !audioBlob) return;

    if (!ticket || !actualInstanceId) {
      toast({
        title: "❌ Erro de Conexão",
        description: "Instância WhatsApp não conectada ou ticket inválido.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    const messageId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // 🚀 OPTIMISTIC UI: Adicionar mensagem instantaneamente
    const optimisticMessage: TicketMessage = {
      id: `opt_${messageId}`,
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

    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    scrollToBottom();
    
    try {
      // Debug commands - importação dinâmica para não afetar bundle
      if (content.startsWith('/debugbloco')) {
        const { debugBlocoService } = await import('@/services/debugBlocoService');
        await debugBlocoService.handleDebugCommand(ticketId, clientId, actualInstanceId, ticket.chat_id);
        setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        return;
      }
      
      if (content.startsWith('/debugaudio')) {
        const { debugAudioService } = await import('@/services/debugAudioService');
        await debugAudioService.handleDebugCommand(ticketId, clientId, actualInstanceId, ticket.chat_id);
        setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        return;
      }

      if (content.startsWith('/debugaudiolib')) {
        const { debugAudioService } = await import('@/services/debugAudioService');
        await debugAudioService.handleDebugAudioLibraryCommand(ticketId, clientId, actualInstanceId, ticket.chat_id);
        setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        return;
      }

      // 🎯 ATUALIZAR STATUS: sending → sent
      setOptimisticMessages(prev => 
        prev.map(m => m.message_id === messageId 
          ? { ...m, processing_status: 'sent' } 
          : m
        )
      );

      // Comandos de bypass direto para Edge Function
      if (content.includes('faça um audio') || content.includes('faca um audio') || content.includes('grave um áudio')) {
        console.log('🎵 [BYPASS] Comando de áudio detectado - enviando direto para IA');
        
        const { error } = await supabase.functions.invoke('ai-assistant-process', {
          body: {
            chatId: ticket.chat_id,
            instanceId: actualInstanceId,
            clientId,
            content,
            messageId,
            timestamp: Date.now(),
            fromMe: true,
            pushName: 'Manual',
            command: 'audio_generation'
          }
        });

        if (error) {
          console.error('❌ [BYPASS] Erro na edge function:', error);
          toast({
            title: "❌ Erro",
            description: "Erro ao processar comando de áudio",
            variant: "destructive"
          });
          setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        } else {
          console.log('✅ [BYPASS] Comando de áudio enviado para processamento');
          toast({
            title: "✅ Sucesso",
            description: "Comando enviado para processamento",
            variant: "default"
          });
        }
        return;
      }

      if (content.includes('analise a imagem') || content.includes('analise essa imagem') || content.includes('descreva a imagem')) {
        console.log('📷 [BYPASS] Comando de análise de imagem detectado');
        
        const { error } = await supabase.functions.invoke('ai-assistant-process', {
          body: {
            chatId: ticket.chat_id,
            instanceId: actualInstanceId,
            clientId,
            content,
            messageId,
            timestamp: Date.now(),
            fromMe: true,
            pushName: 'Manual',
            command: 'image_analysis'
          }
        });

        if (error) {
          console.error('❌ [BYPASS] Erro na edge function:', error);
          toast({
            title: "❌ Erro",
            description: "Erro ao processar comando de imagem",
            variant: "destructive"
          });
          setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
        } else {
          console.log('✅ [BYPASS] Comando de imagem enviado para processamento');
          toast({
            title: "✅ Sucesso",
            description: "Comando enviado para processamento",
            variant: "default"
          });
        }
        return;
      }

      // 🚀 ENVIO OTIMIZADO: usar sempre unifiedMessageService
      const result = await unifiedMessageService.sendSmartMessage(
        actualInstanceId,
        ticket.chat_id,
        content,
        clientId,
        ticket.assigned_assistant_id || undefined,
        {
          onProgress: (sent, total) => {
            console.log(`📊 Progresso: ${sent}/${total} blocos enviados`);
          },
          onTypingStart: () => {
            startTyping?.(ticket.chat_id);
          },
          onTypingStop: () => {
            stopTyping?.(ticket.chat_id);
          }
        }
      );

      if (!result.success) {
        throw new Error(result.errors?.[0] || 'Erro no envio da mensagem');
      }

      // 🎯 ATUALIZAR STATUS: sent → saved
      setOptimisticMessages(prev => 
        prev.map(m => m.message_id === messageId 
          ? { ...m, processing_status: 'saved' } 
          : m
        )
      );

      console.log('✅ [CHAT-INTERFACE] Mensagem enviada via unifiedMessageService:', result);

      // 💾 SALVAMENTO UNIFICADO (sem duplicação, com retry robusto)
      let saveAttempts = 0;
      const maxRetries = 3;
      
      while (saveAttempts < maxRetries) {
        try {
          const savedMessage = await ticketsService.addTicketMessage({
            ticket_id: ticketId,
            message_id: result.messageIds?.[0] || messageId, // Usar ID real se disponível
            from_me: true,
            sender_name: 'Você',
            content,
            message_type: audioBlob ? 'audio' : 'text',
            timestamp,
            is_internal_note: false,
            is_ai_response: false,
            processing_status: 'processed',
            media_duration: audioDuration
          });

          console.log('💾 [CHAT-INTERFACE] Mensagem salva no banco:', savedMessage);
          break; // Sucesso, sair do loop
          
        } catch (saveError) {
          saveAttempts++;
          console.error(`❌ [CHAT-INTERFACE] Erro ao salvar (tentativa ${saveAttempts}/${maxRetries}):`, saveError);
          
          if (saveAttempts >= maxRetries) {
            console.error('❌ [CHAT-INTERFACE] Falha definitiva no salvamento após todas as tentativas');
            // Marcar mensagem como erro mas não falhar o envio
            setOptimisticMessages(prev => 
              prev.map(m => m.message_id === messageId 
                ? { ...m, processing_status: 'error' } 
                : m
              )
            );
            toast({
              title: "❌ Erro",
              description: "Mensagem enviada mas erro no salvamento",
              variant: "destructive"
            });
          } else {
            // Aguardar antes da próxima tentativa (backoff exponencial)
            await new Promise(resolve => setTimeout(resolve, saveAttempts * 1000));
          }
        }
      }

      toast({
        title: "✅ Sucesso",
        description: "Mensagem enviada",
        variant: "default"
      });

    } catch (error) {
      console.error('❌ [CHAT-INTERFACE] Erro ao enviar mensagem:', error);
      
      // 🚨 ROLLBACK: Remover mensagem optimística em caso de erro
      setOptimisticMessages(prev => prev.filter(m => m.message_id !== messageId));
      
      toast({
        title: "❌ Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  }, [newMessage, ticketId, clientId, ticket, actualInstanceId, toast, scrollToBottom, startTyping, stopTyping]);

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
          getMessageStatus={getMessageStatus}
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

      {(isTyping || isRecording) && (
        <div className="border-t border-border px-4 py-2">
          <TypingIndicator />
        </div>
      )}

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
};

export default TicketChatInterface;