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
    if (!clientId) return;

    console.log('🎵 [AUDIO-AUTO] Iniciando processamento automático de áudios para cliente:', clientId);

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
          
          // Verificar se é uma mensagem do cliente (não do assistente)
          if (newMessage.from_me || newMessage.is_ai_response) {
            console.log('🎵 [AUDIO-AUTO] Ignorando áudio do assistente');
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
            return;
          }

          console.log('🎵 [AUDIO-AUTO] NOVO ÁUDIO DETECTADO:', {
            messageId: newMessage.message_id,
            ticketId: newMessage.ticket_id,
            chatId: ticket.chat_id
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
      console.log('🎵 [AUDIO-AUTO] Dados da mensagem:', {
        messageId: message.message_id,
        hasMediaKey: !!message.media_key,
        hasMediaUrl: !!message.media_url,
        hasAudioBase64: !!message.audio_base64
      });

      let audioBase64 = '';

      // 1. Se tem mediaKey, usar directMediaDownloadService para descriptografar
      if (message.media_key) {
        console.log('🔐 [AUDIO-AUTO] Áudio criptografado - usando directMediaDownloadService');
        
        const downloadResult = await directMediaDownloadService.downloadMedia(
          ticket.instance_id,
          message.media_url,
          message.media_key,
          message.direct_path,
          message.mimetype || 'audio/ogg',
          'audio'
        );

        if (downloadResult.success && downloadResult.mediaUrl) {
          console.log('✅ [AUDIO-AUTO] Áudio descriptografado pelo servidor');
          
          // Converter blob URL para base64
          try {
            const response = await fetch(downloadResult.mediaUrl);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            console.log('✅ [AUDIO-AUTO] Convertido para base64:', audioBase64.length, 'chars');
          } catch (convertError) {
            console.error('❌ [AUDIO-AUTO] Erro ao converter blob para base64:', convertError);
            throw new Error('Falha na conversão do áudio descriptografado');
          }
        } else {
          console.error('❌ [AUDIO-AUTO] Falha na descriptografia:', downloadResult.error);
          throw new Error(downloadResult.error || 'Falha na descriptografia');
        }
      } else if (message.audio_base64) {
        console.log('📁 [AUDIO-AUTO] Usando áudio base64 da mensagem');
        audioBase64 = message.audio_base64;
      } else {
        console.error('❌ [AUDIO-AUTO] Nenhum dado de áudio disponível');
        throw new Error('Nenhum dado de áudio disponível para transcrição');
      }

      // 2. Buscar OpenAI API key do cliente
      console.log('🔑 [AUDIO-AUTO] Buscando API key do cliente...');
      const aiConfig = await aiConfigService.getClientConfig(clientId);

      if (!aiConfig?.openai_api_key) {
        console.error('❌ [AUDIO-AUTO] API key da OpenAI não encontrada');
        throw new Error('API key da OpenAI não configurada');
      }

      // 3. Chamar edge function speech-to-text diretamente
      console.log('🎤 [AUDIO-AUTO] Chamando speech-to-text...');
      const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey: aiConfig.openai_api_key,
          messageId: message.message_id
        }
      });

      if (transcriptionError) {
        console.error('❌ [AUDIO-AUTO] Erro na transcrição:', transcriptionError);
        throw new Error(`Erro na transcrição: ${transcriptionError.message}`);
      }

      const transcription = transcriptionResult?.text || '';
      console.log('✅ [AUDIO-AUTO] Transcrição recebida:', transcription.substring(0, 100) + '...');

      // 4. Salvar transcrição no banco
      if (transcription && transcription.trim()) {
        await supabase
          .from('ticket_messages')
          .update({
            media_transcription: transcription,
            processing_status: 'completed',
            content: `${message.content} - Transcrição: ${transcription}`
          })
          .eq('message_id', message.message_id);

        console.log('✅ [AUDIO-AUTO] Transcrição salva no banco');

        // 5. Processar com assistente IA automaticamente
        console.log('🤖 [AUDIO-AUTO] Enviando para IA processar...');
        const { error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
          body: {
            ticketId: message.ticket_id,
            message: `[Áudio transcrito]: "${transcription}"`,
            clientId: clientId,
            instanceId: ticket.instance_id,
            context: {
              chatId: ticket.chat_id,
              customerName: 'Cliente',
              phoneNumber: ticket.chat_id.split('@')[0]
            }
          }
        });

        if (aiError) {
          console.error('❌ [AUDIO-AUTO] Erro ao processar com IA:', aiError);
        } else {
          console.log('🤖 [AUDIO-AUTO] Áudio enviado para IA processar automaticamente');
        }
      } else {
        console.log('⚠️ [AUDIO-AUTO] Transcrição vazia');
        
        // Marcar como falha
        await supabase
          .from('ticket_messages')
          .update({
            processing_status: 'failed',
            content: `${message.content} - Falha na transcrição`
          })
          .eq('message_id', message.message_id);
      }

    } catch (error) {
      console.error('❌ [AUDIO-AUTO] Erro no processamento automático:', error);
      
      // Marcar como erro no banco
      await supabase
        .from('ticket_messages')
        .update({
          processing_status: 'failed',
          media_transcription: `[Erro]: ${error.message}`
        })
        .eq('message_id', message.message_id);
    }
  };

  return {};
};