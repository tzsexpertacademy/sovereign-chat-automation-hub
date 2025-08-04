
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { unifiedMessageService } from '@/services/unifiedMessageService';
import { ticketsService } from '@/services/ticketsService';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedTicketMessages } from '@/hooks/useOptimizedTicketMessages';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHumanizedTyping } from '@/hooks/useHumanizedTyping';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import { useAudioAutoProcessor } from '@/hooks/useAudioAutoProcessor';
import { ManualAudioTestPanel } from './ManualAudioTestPanel';
import MessagesList from './chat/MessagesList';
import MessageInput from './chat/MessageInput';
import TypingIndicator from './TypingIndicator';
import PresenceKeepAlive from './chat/PresenceKeepAlive';

import { useTicketData } from './chat/useTicketData';
import { useAudioHandling } from './chat/useAudioHandling';
import FinalSimpleStatus from './FinalSimpleStatus';
import { VideoTestPanel } from './VideoTestPanel';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
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

    const messageToSend = newMessage.trim();

    // 🚨 INTERCEPTAR COMANDOS DEBUG ESPECIAIS COM DEBOUNCE E TYPING INTEGRADO
    if (messageToSend === '/debugbloco' || messageToSend === '/debugaudio' || messageToSend === '/debugaudiolib') {
      const currentTime = Date.now();
      const executionId = `debug_${currentTime}`;
      
      // 🔒 VERIFICAR se já está executando (simplified)
      if (debugCommandExecutingRef.current) {
        console.warn('🚨 [DEBUG] Comando /debugbloco BLOQUEADO - já executando');
        toast({
          title: "⚠️ Debug em Execução",
          description: "Aguarde a conclusão do teste anterior.",
          variant: "destructive"
        });
        return;
      }
      
      try {
        debugCommandExecutingRef.current = true;
        lastDebugExecutionRef.current = currentTime;
        
        const isDebugAudio = messageToSend === '/debugaudio';
        const isDebugAudioLib = messageToSend === '/debugaudiolib';
        const commandType = isDebugAudio ? 'AUDIO' : (isDebugAudioLib ? 'AUDIOLIB' : 'BLOCO');
        console.log(`🚨 [DEBUG-${executionId}] Comando /debug${commandType.toLowerCase()} INICIANDO`);
        setNewMessage('');
        
        // IMPORTAR E EXECUTAR COM LOGGING EXTENSIVO
        try {
          if (isDebugAudio) {
            console.log(`📦 [DEBUG-${executionId}] Importando debugAudioService...`);
            const serviceModule = await import('@/services/debugAudioService');
            console.log(`✅ [DEBUG-${executionId}] debugAudioService importado:`, !!serviceModule.debugAudioService);
            
            if (!serviceModule.debugAudioService) {
              throw new Error('debugAudioService não encontrado no módulo');
            }
            
            console.log(`🎯 [DEBUG-${executionId}] Executando handleDebugCommand...`);
            await serviceModule.debugAudioService.handleDebugCommand(
              ticketId,
              clientId,
              actualInstanceId,
              ticket.chat_id
            );
          } else if (isDebugAudioLib) {
            console.log(`📦 [DEBUG-${executionId}] Importando debugAudioService para biblioteca...`);
            const serviceModule = await import('@/services/debugAudioService');
            console.log(`✅ [DEBUG-${executionId}] debugAudioService importado:`, !!serviceModule.debugAudioService);
            
            if (!serviceModule.debugAudioService) {
              throw new Error('debugAudioService não encontrado no módulo');
            }
            
            console.log(`🎯 [DEBUG-${executionId}] Executando handleDebugAudioLibraryCommand...`);
            await serviceModule.debugAudioService.handleDebugAudioLibraryCommand(
              ticketId,
              clientId,
              actualInstanceId,
              ticket.chat_id
            );
          } else {
            console.log(`📦 [DEBUG-${executionId}] Importando debugBlocoService...`);
            const serviceModule = await import('@/services/debugBlocoService');
            console.log(`✅ [DEBUG-${executionId}] debugBlocoService importado:`, !!serviceModule.debugBlocoService);
            
            if (!serviceModule.debugBlocoService) {
              throw new Error('debugBlocoService não encontrado no módulo');
            }
            
            console.log(`🎯 [DEBUG-${executionId}] Executando handleDebugCommand...`);
            await serviceModule.debugBlocoService.handleDebugCommand(
              ticketId,
              clientId,
              actualInstanceId,
              ticket.chat_id
            );
          }
          
          console.log(`✅ [DEBUG-${executionId}] handleDebugCommand CONCLUÍDO`);
        } catch (importError) {
          console.error(`❌ [DEBUG-${executionId}] Erro na importação/execução:`, importError);
          throw new Error(`Falha na importação: ${importError instanceof Error ? importError.message : 'Erro desconhecido'}`);
        }
        
        const successMessage = isDebugAudio 
          ? "Teste de comandos de áudio concluído! Verifique as mensagens do chat."
          : isDebugAudioLib 
            ? "Teste da biblioteca de áudio concluído! Verifique as mensagens do chat."
            : "Teste do sistema de blocos concluído! Verifique as mensagens do chat.";
          
        toast({
          title: "✅ Debug Executado",
          description: successMessage,
          variant: "default"
        });
      } catch (error) {
        console.error(`❌ [DEBUG-${executionId}] Erro no comando /debugbloco:`, error);
        toast({
          title: "❌ Erro no Debug",
          description: error instanceof Error ? error.message : "Falha ao executar teste do sistema de blocos.",
          variant: "destructive"
        });
      } finally {
        debugCommandExecutingRef.current = false;
      }
      
      return;
    }

    try {
      setIsSending(true);
      const messageId = `rest_msg_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // Limpar input imediatamente
      setNewMessage('');

      // 🎵 BYPASS DIRETO PARA COMANDOS DE ÁUDIO DA BIBLIOTECA
      console.log('🔍 [AUDIO-LIBRARY] Verificando comando de áudio:', messageToSend);
      
      const audioLibraryPattern = /audio\s+([^:\s\n]+)/i;
      const audioMatch = messageToSend.match(audioLibraryPattern);

      // 🖼️ BYPASS DIRETO PARA COMANDOS DE IMAGEM DA BIBLIOTECA
      console.log('🔍 [IMAGE-LIBRARY] Verificando comando de imagem:', messageToSend);
      
      const imageLibraryPattern = /image\s+([^:\s\n]+)/i;
      const imageMatch = messageToSend.match(imageLibraryPattern);

      const assistantId = ticket.assigned_assistant_id || queueInfo?.assistant_id;
      
      console.log('🔍 [LIBRARY-COMMANDS] Resultado das regex:', {
        audioPattern: audioLibraryPattern.toString(),
        imagePattern: imageLibraryPattern.toString(),
        message: messageToSend,
        audioMatch: audioMatch,
        imageMatch: imageMatch,
        hasTicketAssistant: !!ticket.assigned_assistant_id,
        hasQueueAssistant: !!queueInfo?.assistant_id,
        finalAssistantId: assistantId
      });

      // 🎵 PROCESSAR COMANDO DE ÁUDIO
      if (audioMatch && assistantId) {
        console.log('🎵 [AUDIO-LIBRARY] Comando detectado - BYPASS DIRETO:', {
          fullCommand: messageToSend,
          trigger: audioMatch[1],
          assistantId: assistantId,
          source: ticket.assigned_assistant_id ? 'ticket' : 'queue',
          ticketId,
          clientId,
          instanceId: actualInstanceId
        });

        // ⚡ BYPASS DIRETO - Chamar edge function ai-assistant-process diretamente
        try {
          console.log('🚀 [AUDIO-LIBRARY] Chamando ai-assistant-process diretamente...');
          
          // Estrutura de dados igual ao batch processor
          const messageData = {
            content: messageToSend,
            messageId: `MANUAL_${Date.now()}`,
            timestamp: new Date().toISOString(),
            phoneNumber: ticket.customer_phone || '0000000000',
            customerName: ticket.customer_name || 'Cliente'
          };

          const requestBody = {
            ticketId,
            messages: [messageData],
            context: {
              chatId: ticket.chat_id,
              customerName: ticket.customer_name || 'Cliente',
              phoneNumber: ticket.customer_phone || '0000000000',
              batchInfo: `Comando de áudio manual`
            }
          };

          console.log('📦 [AUDIO-LIBRARY] Payload para edge function:', requestBody);

          const { data: response, error } = await supabase.functions.invoke('ai-assistant-process', {
            body: requestBody
          });

          if (error) {
            throw error;
          }

          console.log('✅ [AUDIO-LIBRARY] Edge function executada com sucesso:', response);
          
          toast({
            title: "🎵 Comando de Áudio",
            description: "Comando processado com sucesso!",
            variant: "default"
          });

        } catch (error) {
          console.error('❌ [AUDIO-LIBRARY] Erro no bypass direto:', error);
          toast({
            title: "❌ Erro no Comando",
            description: "Falha ao processar comando de áudio",
            variant: "destructive"
          });
        }
        
        setIsSending(false);
        markActivity();
        return;
      }

      // 🖼️ PROCESSAR COMANDO DE IMAGEM
      if (imageMatch && assistantId) {
        console.log('🖼️ [IMAGE-LIBRARY] Comando detectado - BYPASS DIRETO:', {
          fullCommand: messageToSend,
          trigger: imageMatch[1],
          assistantId: assistantId,
          source: ticket.assigned_assistant_id ? 'ticket' : 'queue',
          ticketId,
          clientId,
          instanceId: actualInstanceId
        });

        // ⚡ BYPASS DIRETO - Chamar edge function ai-assistant-process diretamente
        try {
          console.log('🚀 [IMAGE-LIBRARY] Chamando ai-assistant-process diretamente...');
          
          // Estrutura de dados igual ao batch processor
          const messageData = {
            content: messageToSend,
            messageId: `MANUAL_${Date.now()}`,
            timestamp: new Date().toISOString(),
            phoneNumber: ticket.customer_phone || '0000000000',
            customerName: ticket.customer_name || 'Cliente'
          };

          const requestBody = {
            ticketId,
            messages: [messageData],
            context: {
              chatId: ticket.chat_id,
              customerName: ticket.customer_name || 'Cliente',
              phoneNumber: ticket.customer_phone || '0000000000',
              batchInfo: `Comando de imagem manual`
            }
          };

          console.log('📦 [IMAGE-LIBRARY] Payload para edge function:', requestBody);

          const { data: response, error } = await supabase.functions.invoke('ai-assistant-process', {
            body: requestBody
          });

          if (error) {
            throw error;
          }

          console.log('✅ [IMAGE-LIBRARY] Edge function executada com sucesso:', response);
          
          toast({
            title: "🖼️ Comando de Imagem",
            description: "Comando processado com sucesso!",
            variant: "default"
          });

        } catch (error) {
          console.error('❌ [IMAGE-LIBRARY] Erro no bypass direto:', error);
          toast({
            title: "❌ Erro no Comando",
            description: "Falha ao processar comando de imagem",
            variant: "destructive"
          });
        }
        
        setIsSending(false);
        markActivity();
        return;
      }
      
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

      // 🧠 ENVIAR VIA SISTEMA INTELIGENTE (suporta blocos automaticamente)
      console.log('📤 [CHAT] Enviando mensagem via sendSmartMessage:', {
        messageLength: messageToSend.length,
        assistantId: ticket.assigned_assistant_id || 'none',
        willUseChunks: messageToSend.length > 350 && !!ticket.assigned_assistant_id
      });

      const response = await unifiedMessageService.sendSmartMessage(
        actualInstanceId,
        ticket.chat_id,
        messageToSend,
        clientId,
        ticket.assigned_assistant_id || undefined,
        {
          onProgress: (sent, total) => {
            console.log(`📊 Progresso: ${sent}/${total} blocos`);
          },
          onTypingStart: () => {
            console.log('🔄 Iniciando typing contínuo');
            startTyping(ticket.chat_id);
          },
          onTypingStop: () => {
            console.log('🛑 Finalizando typing contínuo');
            stopTyping(ticket.chat_id);
          }
        }
      );
      
      if (response.success) {
        console.log('⚡ [ULTRA-FAST] Enviado com SUCESSO, salvando no banco IMEDIATAMENTE...');

        // 🚀 SALVAR MENSAGEM CORRETAMENTE
        // Para blocos múltiplos, salvar apenas a mensagem original
        const finalMessageId = Array.isArray(response.messageIds) && response.messageIds.length > 0 
          ? response.messageIds[0] 
          : messageId;
          
        const savePromise = ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: finalMessageId,
          from_me: true,
          sender_name: 'Atendente',
          content: messageToSend,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          timestamp: timestamp
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
        const errorMessage = response.errors && response.errors.length > 0 ? response.errors[0] : "Erro desconhecido";
        console.error('❌ [ULTRA-FAST] FALHA no envio:', errorMessage);
        
        // ❌ FALHA IMEDIATA com feedback visual
        failOptimisticMessage(optimisticMessageId);
        
        toast({
          title: "❌ Falha no Envio",
          description: errorMessage,
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
      
      {/* Debug Panel - apenas em desenvolvimento */}
      {process.env.NODE_ENV === 'development' && (
        <div className="border-t p-2 bg-muted/10">
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
              🧪 Painel de Teste de Vídeo (Debug)
            </summary>
            <div className="mt-2">
              <VideoTestPanel />
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default TicketChatInterface;
