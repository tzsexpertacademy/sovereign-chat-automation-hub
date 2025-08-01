import { yumerApiV2 } from '@/services/yumerApiV2Service';

export interface VideoSendResult {
  success: boolean;
  format?: string;
  error?: string;
  attempts?: number;
  isFallback?: boolean;
  message?: string;
}

export class VideoSender {
  static async sendWithIntelligentRetry(
    videoBlob: Blob,
    chatId: string,
    instanceId: string,
    messageId: string,
    caption?: string
  ): Promise<VideoSendResult> {
    console.log('🎬 ===== INICIANDO ENVIO VIA YUMER API V2 =====');
    console.log('🔧 CORRIGIDO: Replicando exatamente a estrutura do sendAudioFile que funciona');
    console.log('📊 Dados do vídeo:', {
      size: videoBlob.size,
      type: videoBlob.type,
      chatId,
      instanceId,
      caption
    });

    let attempts = 0;
    const maxAttempts = 3;

    // 🎯 ESTRATÉGIA CORRIGIDA: FormData IDÊNTICO ao sendAudioFile
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: FormData idêntico ao sendAudioFile`);

      try {
        // Criar nome de arquivo adequado
        const videoType = videoBlob.type.toLowerCase();
        let fileName = `video_${Date.now()}`;
        
        if (videoType.includes('webm')) {
          fileName += '.webm';
        } else if (videoType.includes('avi')) {
          fileName += '.avi';
        } else if (videoType.includes('mov')) {
          fileName += '.mov';
        } else {
          fileName += '.mp4'; // Default para MP4
        }
        
        // 🎯 USAR sendMediaFile com a correção aplicada
        const videoFile = new File([videoBlob], fileName, {
          type: videoBlob.type || 'video/mp4'
        });

        const response = await yumerApiV2.sendMediaFile(instanceId, chatId, videoFile, {
          delay: 1200,
          messageId: messageId,
          caption: caption,
          mediatype: 'video'
        });

        console.log('✅ Sucesso via sendMediaFile corrigido:', response);
        
        return {
          success: true,
          format: 'video',
          attempts,
          message: 'Vídeo enviado via sendMediaFile corrigido',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou:`, error.message);
        
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
}