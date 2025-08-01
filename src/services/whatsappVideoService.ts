/**
 * WhatsApp Video Service
 * Gerencia visualização e processamento de vídeos do WhatsApp
 */

import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppVideoData {
  messageId: string;
  encryptedData?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  videoUrl?: string;
}

export interface ProcessedVideo {
  videoData?: string;
  videoUrl?: string;
  messageId?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  needsDecryption: boolean;
  isLoading: boolean;
  error?: string;
}

class WhatsAppVideoService {
  private cache = new Map<string, string>();

  /**
   * Obtém dados de vídeo seguros para visualização
   */
  getVideoDisplayData(message: any): ProcessedVideo {
    if (message.message_type !== 'video') {
      return { needsDecryption: false, isLoading: false };
    }

    const hasMediaUrl = !!message.media_url;
    const hasDecryptionKeys = !!(message.media_key && message.file_enc_sha256);
    
    console.log('🎥 [VIDEO-SERVICE] Analisando vídeo:', {
      messageId: message.message_id,
      hasMediaUrl,
      hasDecryptionKeys,
      mediaKey: message.media_key ? 'presente' : 'ausente',
      fileEncSha256: message.file_enc_sha256 ? 'presente' : 'ausente',
      url: message.media_url?.substring(0, 100) + '...'
    });

    if (!hasMediaUrl) {
      return {
        needsDecryption: false,
        isLoading: false,
        error: 'URL do vídeo não encontrada'
      };
    }

    // 1. Vídeo criptografado (tem chaves de descriptografia)
    if (hasDecryptionKeys) {
      return {
        videoUrl: message.media_url,
        messageId: message.message_id || message.id,
        mediaKey: message.media_key,
        fileEncSha256: message.file_enc_sha256,
        needsDecryption: true,
        isLoading: false
      };
    }

    // 2. Vídeo com URL direta (sem chaves = não criptografado)
    return {
      videoUrl: message.media_url,
      needsDecryption: false,
      isLoading: false
    };
  }

  /**
   * Descriptografa um vídeo usando a edge function
   */
  async decryptVideo(videoData: WhatsAppVideoData): Promise<string | null> {
    const { messageId, videoUrl, mediaKey, fileEncSha256 } = videoData;

    if (!messageId || !mediaKey || !fileEncSha256) {
      console.error('❌ [VIDEO-SERVICE] Dados insuficientes para descriptografia');
      return null;
    }

    // Verificar cache primeiro
    const cacheKey = `video_${messageId}`;
    if (this.cache.has(cacheKey)) {
      console.log('📹 [VIDEO-SERVICE] Vídeo encontrado no cache');
      return this.cache.get(cacheKey) || null;
    }

    try {
      console.log('🔐 [VIDEO-SERVICE] Iniciando descriptografia via edge function');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-decrypt-video', {
        body: {
          messageId,
          mediaUrl: videoUrl,
          mediaKey,
          fileEncSha256
        }
      });

      if (error) {
        console.error('❌ [VIDEO-SERVICE] Erro na edge function:', error);
        return null;
      }

      if (data?.decryptedData && data?.videoFormat) {
        const videoBase64 = data.decryptedData;
        const format = data.videoFormat;
        
        // Criar URL blob a partir do base64
        const binaryString = atob(videoBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const mimeType = this.getMimeType(format);
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        
        // Cachear resultado
        this.cache.set(cacheKey, blobUrl);
        
        console.log('✅ [VIDEO-SERVICE] Vídeo descriptografado com sucesso');
        return blobUrl;
      }

      console.error('❌ [VIDEO-SERVICE] Resposta inválida da edge function');
      return null;

    } catch (error) {
      console.error('❌ [VIDEO-SERVICE] Erro ao descriptografar vídeo:', error);
      return null;
    }
  }

  /**
   * Determina o MIME type baseado no formato do vídeo
   */
  private getMimeType(format: string): string {
    const formatLower = format.toLowerCase();
    
    switch (formatLower) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
        return 'video/ogg';
      case 'avi':
        return 'video/x-msvideo';
      case 'mov':
        return 'video/quicktime';
      case '3gp':
        return 'video/3gpp';
      default:
        return 'video/mp4'; // Fallback para MP4
    }
  }

  /**
   * Verifica se uma mensagem tem vídeo
   */
  hasVideo(message: any): boolean {
    return message.message_type === 'video' && !!message.media_url;
  }

  /**
   * Verifica se um vídeo precisa de descriptografia
   */
  needsDecryption(message: any): boolean {
    return !!(
      message.message_type === 'video' && 
      message.media_key &&
      message.file_enc_sha256
    );
  }

  /**
   * Extrai dados do vídeo de uma mensagem
   */
  extractVideoData(message: any): WhatsAppVideoData | null {
    if (!this.hasVideo(message)) {
      return null;
    }

    return {
      messageId: message.message_id || message.id,
      videoUrl: message.media_url,
      mediaKey: message.media_key,
      fileEncSha256: message.file_enc_sha256
    };
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    // Revogar URLs blob para liberar memória
    this.cache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.cache.clear();
    console.log('🗑️ [VIDEO-SERVICE] Cache limpo');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Exportar instância singleton
export const whatsappVideoService = new WhatsAppVideoService();
export default whatsappVideoService;