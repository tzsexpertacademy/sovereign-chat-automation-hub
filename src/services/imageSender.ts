import { yumerApiV2 } from '@/services/yumerApiV2Service';

export interface ImageSendResult {
  success: boolean;
  format?: string;
  error?: string;
  attempts?: number;
  isFallback?: boolean;
  message?: string;
}

export class ImageSender {
  static async sendWithIntelligentRetry(
    imageBlob: Blob,
    chatId: string,
    instanceId: string,
    messageId: string,
    caption?: string
  ): Promise<ImageSendResult> {
    console.log('🖼️ ===== INICIANDO ENVIO VIA YUMER API V2 =====');
    console.log('🔧 Sistema corrigido: usando API oficial Yumer v2.2.1');
    console.log('📊 Dados da imagem:', {
      size: imageBlob.size,
      type: imageBlob.type,
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
        const imageFile = new File([imageBlob], `image_${Date.now()}.jpg`, {
          type: imageBlob.type || 'image/jpeg'
        });

        // Usar sendMediaFile para envio direto do arquivo
        const response = await yumerApiV2.sendMediaFile(instanceId, chatId, imageFile, {
          delay: 1200,
          messageId: messageId,
          caption: caption,
          mediatype: 'image'
        });

        console.log('✅ Sucesso via sendMediaFile:', response);
        
        return {
          success: true,
          format: 'image',
          attempts,
          message: 'Imagem enviada via sendMediaFile',
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