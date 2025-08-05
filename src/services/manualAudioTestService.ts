import { supabase } from '@/integrations/supabase/client';
import { aiConfigService } from './aiConfigService';

/**
 * Serviço para testar manualmente o processamento de áudios
 * TEMPORARIAMENTE DESATIVADO para evitar múltiplos processadores
 */
export class ManualAudioTestService {
  
  /**
   * Processar manualmente o último áudio não transcrito
   * DESATIVADO: useAudioAutoProcessor centraliza processamento
   */
  static async processLatestAudio(clientId: string = '35f36a03-39b2-412c-bba6-01fdd45c2dd3') {
    try {
      console.log('🛑 [MANUAL-TEST] SERVIÇO DESATIVADO - useAudioAutoProcessor centraliza processamento');
      
      // Buscar áudio já processado para verificação apenas
      const { data: audioMessages, error: fetchError } = await supabase
        .from('ticket_messages')
        .select('message_id, processing_status, media_transcription, audio_base64')
        .eq('message_type', 'audio')
        .eq('ticket_id', 'abfb4cab-9823-4c00-ab42-a1640fc3cd96')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (fetchError || !audioMessages || audioMessages.length === 0) {
        return { 
          success: false, 
          error: 'Nenhum áudio encontrado',
          note: 'useAudioAutoProcessor deve processar automaticamente'
        };
      }

      const audioMessage = audioMessages[0];
      console.log('📋 [MANUAL-TEST] Status do último áudio:', {
        messageId: audioMessage.message_id,
        processingStatus: audioMessage.processing_status,
        hasTranscription: !!audioMessage.media_transcription,
        hasBase64: !!audioMessage.audio_base64
      });

      return {
        success: true,
        messageId: audioMessage.message_id,
        status: audioMessage.processing_status,
        transcription: audioMessage.media_transcription,
        note: 'useAudioAutoProcessor deve processar automaticamente todos os áudios'
      };

    } catch (error) {
      console.error('❌ [MANUAL-TEST] ERRO:', error);
      
      return {
        success: false,
        error: error.message,
        note: 'useAudioAutoProcessor centraliza todo processamento de áudio'
      };
    }
  }
}

// Manter exposição para desenvolvimento (modo somente leitura)
(window as any).testAudio = ManualAudioTestService.processLatestAudio;

export const manualAudioTestService = ManualAudioTestService;