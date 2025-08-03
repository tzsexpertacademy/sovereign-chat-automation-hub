
import { yumerApiV2 } from '@/services/yumerApiV2Service';
import { AudioConverter } from '@/utils/audioConverter';
import { AudioUploadService } from '@/services/audioUploadService';

export interface AudioSendResult {
  success: boolean;
  format?: string;
  error?: string;
  attempts?: number;
  isFallback?: boolean;
  message?: string;
}

export class AudioSender {
  static async sendWithIntelligentRetry(
    audioBlob: Blob,
    chatId: string,
    instanceId: string,
    messageId: string,
    duration?: number
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== INICIANDO ENVIO VIA sendAudioFile =====');
    console.log('🔧 Sistema direto: sendAudioFile (método comprovado)');
    console.log('📊 Dados do áudio:', {
      size: audioBlob.size,
      type: audioBlob.type,
      chatId,
      instanceId,
      duration
    });

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: sendAudioFile direto`);

      try {
        console.log('🎵 Enviando via sendAudioFile...');
        const response = await yumerApiV2.sendAudioFile(instanceId, chatId, audioBlob, {
          delay: 1200,
          messageId: messageId,
          duration: duration
        });

        console.log('✅ Sucesso via sendAudioFile:', response);
        
        return {
          success: true,
          format: 'ogg',
          attempts,
          message: 'Áudio enviado via sendAudioFile',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou:`, error.message);
        
        if (attempts === maxAttempts) {
          console.error('❌ Todas as tentativas falharam, tentando fallback sem duration...');
          
          // FALLBACK: Tentar sem duration
          try {
            console.log('🔄 FALLBACK: Tentando sendAudioFile sem duration...');
            const fallbackResponse = await yumerApiV2.sendAudioFile(instanceId, chatId, audioBlob, {
              delay: 1200,
              messageId: messageId + '_fallback'
            });

            console.log('✅ Sucesso via fallback (sem duration):', fallbackResponse);
            
            return {
              success: true,
              format: 'ogg',
              attempts: attempts + 1,
              message: 'Áudio enviado via fallback (sem duration)',
              isFallback: true
            };
          } catch (fallbackError: any) {
            console.error('❌ Fallback também falhou:', fallbackError);
            return {
              success: false,
              error: `Falha completa após ${attempts} tentativas + fallback: ${error.message}`,
              attempts: attempts + 1
            };
          }
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    return {
      success: false,
      error: 'Máximo de tentativas excedido',
      attempts
    };
  }

  // Método alternativo usando sendWhatsAppAudio (requer URL)
  static async sendViaWhatsAppAudio(
    audioUrl: string,
    chatId: string,
    instanceId: string,
    messageId: string
  ): Promise<AudioSendResult> {
    try {
      console.log('🎵 Enviando via sendWhatsAppAudio:', { audioUrl, chatId, instanceId });
      
      const response = await yumerApiV2.sendWhatsAppAudio(instanceId, chatId, audioUrl, {
        messageId: messageId
      });

      console.log('✅ Sucesso via sendWhatsAppAudio:', response);
      
      return {
        success: true,
        format: 'ogg',
        attempts: 1,
        message: 'Áudio enviado via sendWhatsAppAudio',
        isFallback: false
      };

    } catch (error: any) {
      console.error('❌ Erro via sendWhatsAppAudio:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido',
        attempts: 1
      };
    }
  }

  // Método mantido por compatibilidade (agora sem funcionalidade)
  static async getAudioStats(instanceId: string): Promise<any> {
    console.warn('⚠️ getAudioStats: Método descontinuado com Yumer API v2');
    return null;
  }
}
