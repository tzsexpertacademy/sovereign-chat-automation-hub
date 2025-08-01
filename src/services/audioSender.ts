
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
    console.log('🎵 ===== INICIANDO ENVIO VIA ENDPOINT ESPECÍFICO /send/audio =====');
    console.log('🔧 Sistema otimizado: upload → URL → endpoint WhatsApp específico');
    console.log('📊 Dados do áudio:', {
      size: audioBlob.size,
      type: audioBlob.type,
      chatId,
      instanceId,
      duration
    });

    let attempts = 0;
    const maxAttempts = 2;
    let uploadFileName: string | undefined;

    // ESTRATÉGIA OTIMIZADA: Upload para obter URL → Usar endpoint específico
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: Upload + /send/audio`);

      try {
        // ETAPA 1: Upload do áudio para obter URL pública
        console.log('📤 ETAPA 1: Fazendo upload do áudio...');
        const uploadResult = await AudioUploadService.uploadAudioBlob(audioBlob, messageId);
        
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(`Falha no upload: ${uploadResult.error}`);
        }

        uploadFileName = uploadResult.fileName;
        console.log(`✅ Upload realizado: ${uploadResult.url}`);

        // ETAPA 2: Enviar via endpoint específico /send/audio
        console.log('🎵 ETAPA 2: Enviando via /send/audio (endpoint específico do WhatsApp)...');
        const response = await yumerApiV2.sendWhatsAppAudio(instanceId, chatId, uploadResult.url, {
          delay: 800, // Delay menor pois não há processamento de arquivo
          messageId: messageId,
          presence: 'recording' // Aparece como gravação no WhatsApp
        });

        console.log('✅ Sucesso via endpoint específico /send/audio:', response);
        
        // ETAPA 3: Limpeza do arquivo temporário (não crítico)
        if (uploadFileName) {
          AudioUploadService.cleanupTempAudio(uploadFileName).catch(err => {
            console.warn('⚠️ Erro na limpeza (não crítico):', err);
          });
        }
        
        return {
          success: true,
          format: 'ogg',
          attempts,
          message: 'Áudio enviado via endpoint específico /send/audio',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou:`, error.message);
        
        // Limpar arquivo em caso de erro
        if (uploadFileName) {
          AudioUploadService.cleanupTempAudio(uploadFileName).catch(() => {});
        }
        
        if (attempts === maxAttempts) {
          console.error('❌ Todas as tentativas falharam, tentando fallback...');
          
          // FALLBACK: Tentar método anterior como último recurso
          try {
            console.log('🔄 FALLBACK: Tentando sendAudioFile...');
            const fallbackResponse = await yumerApiV2.sendAudioFile(instanceId, chatId, audioBlob, {
              delay: 1200,
              messageId: messageId + '_fallback',
              duration: duration
            });

            console.log('✅ Sucesso via fallback (sendAudioFile):', fallbackResponse);
            
            return {
              success: true,
              format: 'ogg',
              attempts: attempts + 1,
              message: 'Áudio enviado via fallback (sendAudioFile)',
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
