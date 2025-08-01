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
    console.log('🔧 CORRIGIDO: Replicando exatamente a estrutura do sendAudioFile que funciona');
    console.log('📊 Dados da imagem:', {
      size: imageBlob.size,
      type: imageBlob.type,
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
        // 🔥 CORREÇÃO: Usar FormData manual igual ao sendAudioFile
        const formData = new FormData();
        formData.append('recipient', chatId);
        
        // Criar nome de arquivo adequado
        const imageType = imageBlob.type.toLowerCase();
        let fileName = `image_${Date.now()}`;
        
        if (imageType.includes('png')) {
          fileName += '.png';
        } else if (imageType.includes('gif')) {
          fileName += '.gif';
        } else if (imageType.includes('webp')) {
          fileName += '.webp';
        } else {
          fileName += '.jpg'; // Default para JPEG
        }
        
        formData.append('attachment', imageBlob, fileName);
        formData.append('mediatype', 'image');
        
        // Adicionar opções EXATAMENTE como no sendAudioFile
        if (caption) {
          formData.append('caption', caption);
          console.log(`📝 [ImageSender] Caption: ${caption}`);
        }
        
        formData.append('delay', '1200'); // Default igual ao sendAudioFile
        
        if (messageId) {
          formData.append('messageId', messageId);
          console.log(`🆔 [ImageSender] MessageId: ${messageId}`);
        }
        
        // ExternalAttributes para tracking (igual ao sendAudioFile)
        const externalAttributes = {
          source: 'ImageSender',
          mediaType: 'image',
          fileName: fileName,
          fileSize: imageBlob.size,
          timestamp: Date.now()
        };
        formData.append('externalAttributes', JSON.stringify(externalAttributes));

        console.log(`📤 [ImageSender] Enviando ${fileName} (${Math.round(imageBlob.size/1024)}KB) para ${chatId}`);
        
        // 🎯 USAR sendMediaFile mas criar FormData personalizado primeiro
        // Converter para File temporário para usar com sendMediaFile corrigido
        const imageFile = new File([imageBlob], fileName, {
          type: imageBlob.type || 'image/jpeg'
        });

        const response = await yumerApiV2.sendMediaFile(instanceId, chatId, imageFile, {
          delay: 1200,
          messageId: messageId,
          caption: caption,
          mediatype: 'image'
        });

        console.log('✅ Sucesso via FormData direto:', response);
        
        return {
          success: true,
          format: 'image',
          attempts,
          message: 'Imagem enviada via FormData direto',
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