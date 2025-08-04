import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { aiConfigService } from '@/services/aiConfigService';

/**
 * Hook para processar áudios automaticamente quando recebidos
 */
export const useAudioAutoProcessor = (clientId: string) => {
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!clientId) {
      console.log('🎵 [AUDIO-AUTO] ❌ ClientId não fornecido - hook não ativo');
      return;
    }

    console.log('🎵 [AUDIO-AUTO] ✅ INICIANDO processamento automático de áudios para cliente:', clientId);
    console.log('🎵 [AUDIO-AUTO] 🔧 Hook ativo e configurado corretamente');

    // Listener para novas mensagens de áudio
    const channel = supabase
      .channel('audio_auto_processor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `message_type=in.(audio,ptt)`
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          console.log('🎵 [AUDIO-AUTO] 📨 NOVA MENSAGEM DETECTADA:', {
            messageId: newMessage.message_id,
            messageType: newMessage.message_type,
            fromMe: newMessage.from_me,
            isAiResponse: newMessage.is_ai_response,
            hasMediaKey: !!newMessage.media_key,
            processingStatus: newMessage.processing_status
          });
          
          // Verificar se é uma mensagem do cliente (NÃO from_me e NÃO is_ai_response)
          if (newMessage.from_me === true || newMessage.is_ai_response === true) {
            console.log('🎵 [AUDIO-AUTO] ⏭️ Ignorando áudio do assistente ou enviado pelo sistema');
            return;
          }

          // Verificar se já está sendo processado
          if (processingRef.current.has(newMessage.message_id)) {
            console.log('🎵 [AUDIO-AUTO] Áudio já em processamento:', newMessage.message_id);
            return;
          }

          // Buscar ticket para verificar se é do cliente correto
          const { data: ticket } = await supabase
            .from('conversation_tickets')
            .select('client_id, chat_id, instance_id')
            .eq('id', newMessage.ticket_id)
            .single();

          if (!ticket || ticket.client_id !== clientId) {
            console.log('🎵 [AUDIO-AUTO] ⚠️ Ticket não pertence ao cliente atual:', {
              ticketClientId: ticket?.client_id,
              currentClientId: clientId
            });
            return;
          }

          // Verificar se já foi processado
          if (newMessage.processing_status === 'completed' || newMessage.processing_status === 'failed') {
            console.log('🎵 [AUDIO-AUTO] ⏭️ Áudio já processado:', newMessage.processing_status);
            return;
          }

          console.log('🎵 [AUDIO-AUTO] 🎯 NOVO ÁUDIO VÁLIDO PARA PROCESSAMENTO:', {
            messageId: newMessage.message_id,
            ticketId: newMessage.ticket_id,
            chatId: ticket.chat_id,
            processingStatus: newMessage.processing_status
          });

          // Marcar como em processamento
          processingRef.current.add(newMessage.message_id);

          try {
            await processAudioMessage(newMessage, ticket, clientId);
          } finally {
            // Remover do set de processamento
            processingRef.current.delete(newMessage.message_id);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🎵 [AUDIO-AUTO] Parando processamento automático de áudios');
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  /**
   * Processar mensagem de áudio automaticamente - VERSÃO SIMPLIFICADA
   */
  const processAudioMessage = async (message: any, ticket: any, clientId: string) => {
    try {
      console.log('🎵 [AUDIO-AUTO] ===== PROCESSANDO ÁUDIO AUTOMATICAMENTE =====');
      console.log('🎵 [AUDIO-AUTO] 📋 Dados completos da mensagem:', {
        messageId: message.message_id,
        hasMediaKey: !!message.media_key,
        hasMediaUrl: !!message.media_url,
        hasAudioBase64: !!message.audio_base64,
        mediaKeyType: typeof message.media_key,
        mediaUrlPreview: message.media_url?.substring(0, 100),
        mimetype: message.media_mime_type,
        directPath: message.direct_path,
        processingStatus: message.processing_status
      });

      // Marcar como "processing" imediatamente
      await supabase
        .from('ticket_messages')
        .update({ processing_status: 'processing' })
        .eq('message_id', message.message_id);

      console.log('🔄 [AUDIO-AUTO] Status atualizado para "processing"');

      let audioBase64 = '';

      // 1. ESTRATÉGIA SIMPLIFICADA: Priorizar media_key para descriptografia
      if (message.media_key && message.media_url) {
        console.log('🔐 [AUDIO-AUTO] 🔑 Áudio criptografado detectado - iniciando descriptografia');
        console.log('🔐 [AUDIO-AUTO] 📊 Parâmetros de descriptografia:', {
          instanceId: ticket.instance_id,
          mediaKeyLength: typeof message.media_key === 'string' ? message.media_key.length : 'object',
          mediaUrlDomain: new URL(message.media_url).hostname,
          directPath: message.direct_path,
          mimetype: message.media_mime_type || 'audio/ogg'
        });
        
        const downloadResult = await directMediaDownloadService.downloadMedia(
          ticket.instance_id,
          message.media_url,
          message.media_key,
          message.direct_path,
          message.media_mime_type || 'audio/ogg',
          'audio'
        );

        if (downloadResult.success && downloadResult.mediaUrl) {
          console.log('✅ [AUDIO-AUTO] 🎉 Áudio descriptografado com sucesso pelo servidor');
          console.log('✅ [AUDIO-AUTO] 📁 URL descriptografada:', downloadResult.mediaUrl.substring(0, 50) + '...');
          
          // Converter blob URL para base64 com tratamento robusto
          try {
            console.log('🔄 [AUDIO-AUTO] Convertendo blob URL para base64...');
            const response = await fetch(downloadResult.mediaUrl);
            
            if (!response.ok) {
              throw new Error(`Falha ao fetch blob: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log('📦 [AUDIO-AUTO] Blob obtido:', {
              size: blob.size,
              type: blob.type
            });
            
            if (blob.size === 0) {
              throw new Error('Blob vazio recebido');
            }
            
            const arrayBuffer = await blob.arrayBuffer();
            audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            console.log('✅ [AUDIO-AUTO] 🎯 Base64 gerado:', {
              length: audioBase64.length,
              preview: audioBase64.substring(0, 50) + '...'
            });
          } catch (convertError) {
            console.error('❌ [AUDIO-AUTO] Erro na conversão blob->base64:', convertError);
            throw new Error(`Falha na conversão: ${convertError.message}`);
          }
        } else {
          console.error('❌ [AUDIO-AUTO] 💥 Falha na descriptografia:', downloadResult.error);
          throw new Error(downloadResult.error || 'Serviço de descriptografia falhou');
        }
      } else if (message.audio_base64) {
        console.log('📁 [AUDIO-AUTO] Usando áudio base64 da mensagem');
        audioBase64 = message.audio_base64;
      } else {
        console.error('❌ [AUDIO-AUTO] Nenhum dado de áudio disponível');
        throw new Error('Nenhum dado de áudio disponível para transcrição');
      }

      // 2. Validar se temos áudio para processar
      if (!audioBase64 || audioBase64.length < 100) {
        console.error('❌ [AUDIO-AUTO] Dados de áudio inválidos:', {
          hasAudioBase64: !!audioBase64,
          length: audioBase64?.length || 0
        });
        throw new Error('Dados de áudio inválidos ou muito pequenos');
      }

      // 3. Buscar OpenAI API key do cliente
      console.log('🔑 [AUDIO-AUTO] Buscando configuração IA do cliente...');
      const aiConfig = await aiConfigService.getClientConfig(clientId);

      if (!aiConfig?.openai_api_key) {
        console.error('❌ [AUDIO-AUTO] API key da OpenAI não encontrada para cliente:', clientId);
        throw new Error('API key da OpenAI não configurada para este cliente');
      }

      console.log('✅ [AUDIO-AUTO] API key encontrada, length:', aiConfig.openai_api_key.length);

      // 4. Chamar edge function speech-to-text com logs detalhados
      console.log('🎤 [AUDIO-AUTO] 🚀 Invocando speech-to-text edge function...');
      console.log('🎤 [AUDIO-AUTO] 📋 Parâmetros da chamada:', {
        hasAudio: !!audioBase64,
        audioLength: audioBase64.length,
        hasApiKey: !!aiConfig.openai_api_key,
        messageId: message.message_id,
        audioPreview: audioBase64.substring(0, 50) + '...'
      });

      const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey: aiConfig.openai_api_key,
          messageId: message.message_id
        }
      });

      console.log('🎤 [AUDIO-AUTO] 📥 Resposta da edge function:', {
        hasData: !!transcriptionResult,
        hasError: !!transcriptionError,
        dataPreview: transcriptionResult ? Object.keys(transcriptionResult) : 'N/A'
      });

      if (transcriptionError) {
        console.error('❌ [AUDIO-AUTO] 💥 Erro na edge function speech-to-text:', transcriptionError);
        throw new Error(`Edge function falhou: ${transcriptionError.message || 'Erro desconhecido'}`);
      }

      if (!transcriptionResult) {
        console.error('❌ [AUDIO-AUTO] Edge function retornou dados vazios');
        throw new Error('Edge function speech-to-text retornou resposta vazia');
      }

      const transcription = transcriptionResult?.text || '';
      console.log('✅ [AUDIO-AUTO] 🎯 Transcrição recebida:', {
        hasText: !!transcription,
        length: transcription.length,
        preview: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
        language: transcriptionResult?.language,
        success: transcriptionResult?.success
      });

      // 5. Salvar transcrição no banco com validação
      if (transcription && transcription.trim().length > 0) {
        console.log('💾 [AUDIO-AUTO] Salvando transcrição no banco...');
        
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({
            media_transcription: transcription.trim(),
            processing_status: 'completed',
            content: `🎵 Áudio - Transcrição: ${transcription.trim()}`
          })
          .eq('message_id', message.message_id);

        if (updateError) {
          console.error('❌ [AUDIO-AUTO] Erro ao salvar transcrição:', updateError);
          throw new Error(`Falha ao salvar transcrição: ${updateError.message}`);
        }

        console.log('✅ [AUDIO-AUTO] 💾 Transcrição salva com sucesso no banco');

        // 6. Processar com assistente IA automaticamente
        console.log('🤖 [AUDIO-AUTO] 🚀 Enviando transcrição para processamento IA...');
        
        const { error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
          body: {
            ticketId: message.ticket_id,
            messages: [{
              content: transcription.trim(),
              messageId: message.message_id,
              timestamp: new Date().toISOString(),
              customerName: message.sender_name || 'Cliente',
              phoneNumber: ticket.chat_id.split('@')[0]
            }],
            context: {
              chatId: ticket.chat_id,
              customerName: message.sender_name || 'Cliente',
              phoneNumber: ticket.chat_id.split('@')[0],
              clientMessage: true
            }
          }
        });

        if (aiError) {
          console.error('❌ [AUDIO-AUTO] Erro ao processar com IA:', aiError);
          // Não falhar o processo por erro na IA - transcrição já foi salva
        } else {
          console.log('✅ [AUDIO-AUTO] 🤖 Transcrição enviada para IA com sucesso');
        }
      } else {
        console.log('⚠️ [AUDIO-AUTO] ❌ Transcrição vazia ou inválida');
        
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({
            processing_status: 'failed',
            media_transcription: '[Transcrição vazia - áudio não pôde ser processado]',
            content: `🎵 Áudio - [Falha na transcrição]`
          })
          .eq('message_id', message.message_id);

        if (updateError) {
          console.error('❌ [AUDIO-AUTO] Erro ao marcar falha:', updateError);
        }
        
        throw new Error('Transcrição resultou em texto vazio');
      }

    } catch (error) {
      console.error('❌ [AUDIO-AUTO] 💥 ERRO CRÍTICO no processamento automático:', error);
      console.error('❌ [AUDIO-AUTO] Stack trace:', error.stack);
      
      // Marcar como erro no banco com detalhes
      const { error: updateError } = await supabase
        .from('ticket_messages')
        .update({
          processing_status: 'failed',
          media_transcription: `[Erro no processamento]: ${error.message}`,
          content: `🎵 Áudio - [Erro: ${error.message}]`
        })
        .eq('message_id', message.message_id);

      if (updateError) {
        console.error('❌ [AUDIO-AUTO] Erro ao salvar status de falha:', updateError);
      }
      
      // Re-throw para debugging se necessário
      console.error('❌ [AUDIO-AUTO] Processamento falhou para mensagem:', message.message_id);
    }
  };

  return {};
};