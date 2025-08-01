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
    console.log('🔧 Sistema corrigido: usando API oficial Yumer v2.2.1');
    console.log('📊 Dados do vídeo:', {
      size: videoBlob.size,
      type: videoBlob.type,
      chatId,
      instanceId,
      caption
    });

    let attempts = 0;
    const maxAttempts = 3;

    // Estratégia: Usar sendMediaFile com multipart/form-data (igual ao áudio)
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: sendMediaFile com multipart/form-data`);

      try {
        // Converter Blob para File
        const videoFile = new File([videoBlob], `video_${Date.now()}.mp4`, {
          type: videoBlob.type || 'video/mp4'
        });

        // Usar sendMediaFile para envio direto do arquivo
        const response = await yumerApiV2.sendMediaFile(instanceId, chatId, videoFile, {
          delay: 1200,
          messageId: messageId,
          caption: caption,
          mediatype: 'video'
        });

        console.log('✅ Sucesso via sendMediaFile:', response);
        
        return {
          success: true,
          format: 'video',
          attempts,
          message: 'Vídeo enviado via sendMediaFile',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou (sendMediaFile):`, error.message);
        
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