import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { audioService } from '@/services/audioService';
import { whatsappAudioService } from '@/services/whatsappAudioService';

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
   * Processar mensagem de áudio automaticamente
   */
  const processAudioMessage = async (message: any, ticket: any, clientId: string) => {
    try {
      console.log('🎵 [AUDIO-AUTO] ===== PROCESSANDO ÁUDIO AUTOMATICAMENTE =====');
      
      // 1. Verificar se precisa de descriptografia
      let needsDecryption = false;
      
      if (message.media_key || message.file_enc_sha256) {
        needsDecryption = true;
        console.log('🔐 [AUDIO-AUTO] Áudio criptografado detectado');
      }

      let transcription = '';

      if (needsDecryption) {
        // 2. Usar whatsappAudioService para descriptografar e transcrever
        const audioData = whatsappAudioService.extractAudioData({
          id: message.message_id,
          mediaKey: message.media_key,
          fileEncSha256: message.file_enc_sha256,
          mediaUrl: message.media_url,
          audioBase64: message.audio_base64
        });

        if (audioData) {
          const result = await whatsappAudioService.processCompleteAudio(audioData, clientId);
          transcription = result.transcription.text || '';
        }
      } else {
        // 3. Processar áudio não criptografado
        const result = await audioService.processWhatsAppAudio({
          id: message.message_id,
          type: 'audio',
          mediaUrl: message.media_url,
          audioBase64: message.audio_base64,
          hasMedia: true
        }, clientId);
        
        transcription = result.transcription || '';
      }

      // 4. Salvar transcrição no banco
      if (transcription) {
        await supabase
          .from('ticket_messages')
          .update({
            media_transcription: transcription,
            processing_status: 'completed',
            content: `${message.content} - Transcrição: ${transcription}`
          })
          .eq('message_id', message.message_id);

        console.log('✅ [AUDIO-AUTO] Transcrição salva:', transcription.substring(0, 100));

        // 5. Processar com assistente IA automaticamente
        const { error } = await supabase.functions.invoke('ai-assistant-process', {
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

        if (error) {
          console.error('❌ [AUDIO-AUTO] Erro ao processar com IA:', error);
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