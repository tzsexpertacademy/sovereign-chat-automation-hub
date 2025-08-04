import { supabase } from '@/integrations/supabase/client';
import { directMediaDownloadService } from './directMediaDownloadService';
import { aiConfigService } from './aiConfigService';

/**
 * Serviço para testar manualmente o processamento de áudios
 */
export class ManualAudioTestService {
  
  /**
   * Processar manualmente o último áudio não transcrito
   */
  static async processLatestAudio(clientId: string = '35f36a03-39b2-412c-bba6-01fdd45c2dd3') {
    try {
      console.log('🧪 [MANUAL-TEST] ===== INICIANDO TESTE MANUAL =====');
      
      // 1. Buscar o último áudio não transcrito
      const { data: audioMessages, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('message_type', 'audio')
        .eq('ticket_id', 'abfb4cab-9823-4c00-ab42-a1640fc3cd96')
        .is('media_transcription', null)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (fetchError || !audioMessages || audioMessages.length === 0) {
        console.error('❌ [MANUAL-TEST] Nenhum áudio encontrado para teste:', fetchError);
        return { success: false, error: 'Nenhum áudio não transcrito encontrado' };
      }

      const audioMessage = audioMessages[0];
      console.log('🎯 [MANUAL-TEST] Áudio selecionado:', {
        messageId: audioMessage.message_id,
        hasMediaKey: !!audioMessage.media_key,
        mediaUrl: audioMessage.media_url?.substring(0, 100),
        processingStatus: audioMessage.processing_status
      });

      // 2. Buscar dados do ticket
      const { data: ticket } = await supabase
        .from('conversation_tickets')
        .select('client_id, chat_id, instance_id')
        .eq('id', audioMessage.ticket_id)
        .single();

      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      console.log('🎫 [MANUAL-TEST] Ticket encontrado:', {
        clientId: ticket.client_id,
        instanceId: ticket.instance_id,
        chatId: ticket.chat_id
      });

      // 3. Marcar como "processing"
      await supabase
        .from('ticket_messages')
        .update({ processing_status: 'processing' })
        .eq('message_id', audioMessage.message_id);

      console.log('🔄 [MANUAL-TEST] Status atualizado para "processing"');

      // 4. Descriptografar áudio se necessário
      let audioBase64 = '';
      
      if (audioMessage.media_key && audioMessage.media_url) {
        console.log('🔐 [MANUAL-TEST] Descriptografando áudio...');
        
        const downloadResult = await directMediaDownloadService.downloadMedia(
          ticket.instance_id,
          audioMessage.media_url,
          audioMessage.media_key,
          audioMessage.direct_path,
          audioMessage.media_mime_type || 'audio/ogg',
          'audio'
        );

        if (downloadResult.success && downloadResult.mediaUrl) {
          console.log('✅ [MANUAL-TEST] Áudio descriptografado');
          
          const response = await fetch(downloadResult.mediaUrl);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          console.log('📦 [MANUAL-TEST] Base64 gerado:', audioBase64.length, 'chars');
        } else {
          throw new Error('Falha na descriptografia: ' + downloadResult.error);
        }
      } else if (audioMessage.audio_base64) {
        audioBase64 = audioMessage.audio_base64;
        console.log('📁 [MANUAL-TEST] Usando base64 da mensagem');
      } else {
        throw new Error('Nenhum dado de áudio disponível');
      }

      // 5. Buscar API key
      console.log('🔑 [MANUAL-TEST] Buscando API key...');
      const aiConfig = await aiConfigService.getClientConfig(clientId);
      
      if (!aiConfig?.openai_api_key) {
        throw new Error('API key não configurada');
      }

      // 6. Chamar speech-to-text
      console.log('🎤 [MANUAL-TEST] Chamando speech-to-text...');
      const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey: aiConfig.openai_api_key,
          messageId: audioMessage.message_id
        }
      });

      console.log('📥 [MANUAL-TEST] Resposta speech-to-text:', {
        hasData: !!transcriptionResult,
        hasError: !!transcriptionError,
        data: transcriptionResult
      });

      if (transcriptionError) {
        throw new Error('Erro na transcrição: ' + transcriptionError.message);
      }

      const transcription = transcriptionResult?.text || '';
      
      if (!transcription.trim()) {
        throw new Error('Transcrição vazia recebida');
      }

      // 7. Salvar resultado
      console.log('💾 [MANUAL-TEST] Salvando transcrição:', transcription.substring(0, 100));
      
      const { error: updateError } = await supabase
        .from('ticket_messages')
        .update({
          media_transcription: transcription.trim(),
          processing_status: 'completed',
          content: `🎵 Áudio - Transcrição: ${transcription.trim()}`
        })
        .eq('message_id', audioMessage.message_id);

      if (updateError) {
        throw new Error('Falha ao salvar: ' + updateError.message);
      }

      console.log('✅ [MANUAL-TEST] SUCESSO COMPLETO!');
      
      return {
        success: true,
        messageId: audioMessage.message_id,
        transcription: transcription.trim(),
        audioFormat: transcriptionResult?.audioFormat
      };

    } catch (error) {
      console.error('❌ [MANUAL-TEST] ERRO:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Exportar para uso em desenvolvimento
(window as any).testAudio = ManualAudioTestService.processLatestAudio;

export const manualAudioTestService = ManualAudioTestService;