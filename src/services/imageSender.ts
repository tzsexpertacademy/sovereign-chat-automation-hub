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
    console.log('🖼️ ===== INICIANDO ENVIO VIA ENDPOINT /send/image-file =====');
    console.log('🔧 REPLICANDO EXATAMENTE A LÓGICA DO sendAudioFile QUE FUNCIONA');
    console.log('📊 Dados da imagem:', {
      size: imageBlob.size,
      type: imageBlob.type,
      chatId,
      instanceId,
      caption
    });

    let attempts = 0;
    const maxAttempts = 2;

    // 🎯 ESTRUTURA IDÊNTICA AO sendAudioFile - FormData minimalista
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`📤 Tentativa ${attempts}/${maxAttempts}: Estrutura IGUAL ao sendAudioFile`);

      try {
        // 🔥 FORMDATA EXATAMENTE IGUAL AO sendAudioFile
        const formData = new FormData();
        formData.append('recipient', chatId);
        
        // Detectar formato da imagem e usar extensão correta (igual ao áudio)
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
        
        // APENAS OS CAMPOS QUE O sendAudioFile USA
        if (caption) {
          formData.append('caption', caption);
          console.log(`📝 [ImageSender] Caption: ${caption}`);
        }
        
        if (messageId) {
          formData.append('messageId', messageId);
          console.log(`🆔 [ImageSender] MessageId: ${messageId}`);
        }
        
        formData.append('delay', '1200'); // IGUAL ao sendAudioFile

        console.log(`📤 [ImageSender] Enviando ${fileName} (${Math.round(imageBlob.size/1024)}KB) para ${chatId}`);
        
        // 🎯 CRIAR imageFile PARA USAR COM sendMediaFile (estrutura igual ao áudio)
        const imageFile = new File([imageBlob], fileName, {
          type: imageBlob.type || 'image/jpeg'
        });

        // Usar sendMediaFile diretamente (replicando lógica do sendAudioFile)
        const response = await yumerApiV2.sendMediaFile(instanceId, chatId, imageFile, {
          delay: 1200,
          messageId: messageId,
          caption: caption,
          mediatype: 'image'
        });

        console.log('✅ Sucesso via sendMediaFile (estrutura igual ao sendAudioFile):', response);
        
        return {
          success: true,
          format: 'image',
          attempts,
          message: 'Imagem enviada via sendMediaFile',
          isFallback: false
        };

      } catch (error: any) {
        console.warn(`⚠️ Tentativa ${attempts} falhou:`, error.message);
        
        if (attempts === maxAttempts) {
          console.error('❌ Tentativas falharam, tentando fallback...');
          
          // FALLBACK: tentar sem caption como último recurso
          try {
            console.log('🔄 FALLBACK: Tentando sem caption...');
            const fileName = `image_${Date.now()}.jpg`;
            const imageFile = new File([imageBlob], fileName, {
              type: imageBlob.type || 'image/jpeg'
            });

            const fallbackResponse = await yumerApiV2.sendMediaFile(instanceId, chatId, imageFile, {
              delay: 1200,
              messageId: messageId + '_fallback',
              caption: caption,
              mediatype: 'image'
            });

            console.log('✅ Sucesso via fallback (sendMediaFile):', fallbackResponse);
            
            return {
              success: true,
              format: 'image',
              attempts: attempts + 1,
              message: 'Imagem enviada via fallback (sendMediaFile)',
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
}