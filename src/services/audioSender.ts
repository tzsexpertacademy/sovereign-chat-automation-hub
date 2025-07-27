
import { yumerApiV2 } from '@/services/yumerApiV2Service';
import { AudioConverter } from '@/utils/audioConverter';

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
    messageId: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== INICIANDO ENVIO VIA YUMER API V2 =====');
    console.log('🔧 Sistema corrigido: usando API oficial Yumer v2.2.1');
    console.log('📊 Dados do áudio:', {
      size: audioBlob.size,
      type: audioBlob.type,
      chatId,
      instanceId
    });

    let attempts = 0;
    const maxAttempts = 3;

    // Estratégia 1: Tentar com sendMedia usando base64
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: sendMedia com base64`);

      try {
        // Converter para base64
        const base64Audio = await AudioConverter.blobToBase64(audioBlob);
        
        // Usar sendMedia para áudio com base64
        const response = await yumerApiV2.sendMedia(instanceId, {
          number: chatId,
          media: {
            mediatype: 'audio',
            media: base64Audio, // Base64 diretamente
            filename: `audio_${messageId}.ogg`,
            caption: ''
          },
          options: {
            presence: 'recording',
            messageId: messageId
          }
        });

        console.log('✅ Sucesso via sendMedia:', response);
        
        return {
          success: true,
          format: 'ogg',
          attempts,
          message: 'Áudio enviado via sendMedia',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou (sendMedia):`, error.message);
        
        if (attempts === maxAttempts) {
          console.error('❌ Todas as tentativas falharam');
          return {
            success: false,
            error: `Falha após ${attempts} tentativas: ${error.message}`,
            attempts
          };
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
