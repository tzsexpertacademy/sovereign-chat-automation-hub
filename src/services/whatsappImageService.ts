/**
 * WhatsApp Image Service
 * Gerencia visualização e processamento de imagens do WhatsApp
 */

import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppImageData {
  messageId: string;
  encryptedData?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  imageUrl?: string;
}

export interface ProcessedImage {
  imageData?: string;
  imageUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  needsDecryption: boolean;
  isLoading: boolean;
  error?: string;
}

class WhatsAppImageService {
  private cache = new Map<string, string>();

  /**
   * Obtém dados de imagem seguros para visualização
   */
  getImageDisplayData(message: any): ProcessedImage {
    if (message.message_type !== 'image') {
      return { needsDecryption: false, isLoading: false };
    }

    const hasDirectUrl = message.media_url && !message.media_url.includes('.enc');
    const hasEncryptedUrl = message.media_url?.includes('.enc');
    const hasDecryptionKeys = !!(message.media_key && message.file_enc_sha256);
    
    console.log('🖼️ [IMAGE-SERVICE] Analisando imagem:', {
      messageId: message.message_id,
      hasDirectUrl,
      hasEncryptedUrl,
      hasDecryptionKeys,
      url: message.media_url?.substring(0, 100) + '...'
    });

    // 1. Imagem com URL direta (não criptografada)
    if (hasDirectUrl) {
      return {
        imageUrl: message.media_url,
        needsDecryption: false,
        isLoading: false
      };
    }

    // 2. Imagem criptografada com chaves
    if (hasEncryptedUrl && hasDecryptionKeys) {
      return {
        imageUrl: message.media_url,
        messageId: message.message_id || message.id,
        mediaKey: message.media_key,
        fileEncSha256: message.file_enc_sha256,
        needsDecryption: true,
        isLoading: false
      };
    }

    // 3. Erro: imagem criptografada sem chaves
    if (hasEncryptedUrl && !hasDecryptionKeys) {
      return {
        needsDecryption: false,
        isLoading: false,
        error: 'Imagem criptografada sem chaves de descriptografia'
      };
    }

    // 4. Erro: sem dados de imagem
    return {
      needsDecryption: false,
      isLoading: false,
      error: 'Nenhum dado de imagem disponível'
    };
  }

  /**
   * Descriptografa imagem do WhatsApp usando edge function
   */
  async decryptImage(imageData: WhatsAppImageData): Promise<string | null> {
    console.log('🔐 [IMAGE-SERVICE] Iniciando descriptografia:', {
      messageId: imageData.messageId,
      hasImageUrl: !!imageData.imageUrl,
      hasMediaKey: !!imageData.mediaKey
    });

    // Verificar cache local primeiro
    if (this.cache.has(imageData.messageId)) {
      console.log('⚡ [IMAGE-SERVICE] Imagem encontrada no cache local');
      return this.cache.get(imageData.messageId)!;
    }

    try {
      // TODO: Implementar edge function para descriptografia de imagem
      // Por enquanto, usar a mesma estrutura do áudio
      const { data, error } = await supabase.functions.invoke('whatsapp-decrypt-image', {
        body: {
          mediaUrl: imageData.imageUrl,
          mediaKey: imageData.mediaKey,
          fileEncSha256: imageData.fileEncSha256,
          messageId: imageData.messageId
        }
      });

      if (error) {
        console.error('❌ [IMAGE-SERVICE] Erro na descriptografia:', error);
        throw new Error(`Falha na descriptografia: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(`Descriptografia falhou: ${data.error}`);
      }

      const decryptedImageData = data.decryptedImage;

      // Salvar no cache local
      this.cache.set(imageData.messageId, decryptedImageData);

      console.log('✅ [IMAGE-SERVICE] Descriptografia concluída');
      return decryptedImageData;

    } catch (error) {
      console.error('❌ [IMAGE-SERVICE] Erro na descriptografia:', error);
      
      // FALLBACK: Tentar URL direta (alguns casos funcionam)
      if (imageData.imageUrl && !imageData.imageUrl.includes('.enc')) {
        console.log('🔄 [IMAGE-SERVICE] Tentando fallback para URL direta');
        return imageData.imageUrl;
      }
      
      return null;
    }
  }

  /**
   * Detecta se mensagem tem imagem
   */
  hasImage(message: any): boolean {
    return !!(
      message.message_type === 'image' && 
      message.media_url
    );
  }

  /**
   * Detecta se imagem precisa de descriptografia
   */
  needsDecryption(message: any): boolean {
    return !!(
      message.message_type === 'image' && 
      message.media_url?.includes('.enc') &&
      message.media_key &&
      message.file_enc_sha256
    );
  }

  /**
   * Extrai dados de imagem da mensagem
   */
  extractImageData(message: any): WhatsAppImageData | null {
    if (!this.hasImage(message)) {
      return null;
    }

    return {
      messageId: message.message_id || message.id,
      mediaKey: message.media_key,
      fileEncSha256: message.file_enc_sha256,
      directPath: message.direct_path,
      imageUrl: message.media_url
    };
  }

  /**
   * Limpa cache local
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 [IMAGE-SERVICE] Cache local limpo');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats() {
    return {
      localCacheSize: this.cache.size,
      cachedImages: Array.from(this.cache.keys())
    };
  }
}

export const whatsappImageService = new WhatsAppImageService();
export default whatsappImageService;