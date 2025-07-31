import unifiedYumerService from './unifiedYumerService';

interface MediaDownloadRequest {
  contentType: 'image' | 'video' | 'audio' | 'document';
  content: {
    url: string;
    mimetype: string;
    mediaKey: string;
    directPath: string;
  };
}

interface MediaDownloadResult {
  success: boolean;
  mediaUrl?: string;
  cached?: boolean;
  error?: string;
}

class DirectMediaDownloadService {
  private cache = new Map<string, { url: string; timestamp: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutos

  /**
   * Download direto de mídia usando endpoint da API Yumer (CORRIGIDO)
   */
  async downloadMedia(
    instanceId: string,
    mediaUrl: string,
    mediaKey: string,
    directPath: string,
    mimetype: string,
    contentType: 'image' | 'video' | 'audio' | 'document'
  ): Promise<MediaDownloadResult> {
    const cacheKey = `${instanceId}-${mediaKey}`;
    
    // Verificar cache primeiro
    const cached = this.getCachedMedia(cacheKey);
    if (cached) {
      console.log('📦 DirectMedia: Usando cache para', contentType);
      return {
        success: true,
        mediaUrl: cached,
        cached: true
      };
    }

    try {
      console.log('🔄 DirectMedia: Baixando', contentType, 'via API direta');
      
      const requestBody: MediaDownloadRequest = {
        contentType,
        content: {
          url: mediaUrl,
          mimetype,
          mediaKey,
          directPath
        }
      };

      // 🔥 CORREÇÃO: Usar instanceId correto (internal instance ID)
      const response = await unifiedYumerService.makeRequest(
        `/api/v2/instance/${instanceId}/media/directly-download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.success && response.data) {
        // Verificar se é ArrayBuffer ou outro tipo de dados binários
        let blob: Blob;
        
        if (response.data instanceof ArrayBuffer) {
          blob = new Blob([response.data], { type: mimetype });
        } else if (typeof response.data === 'string') {
          // Se é base64, converter
          const binaryString = atob(response.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mimetype });
        } else {
          // Fallback para outros tipos
          blob = new Blob([response.data as BlobPart], { type: mimetype });
        }
        
        const blobUrl = URL.createObjectURL(blob);
        
        // Cachear resultado
        this.setCachedMedia(cacheKey, blobUrl);
        
        console.log('✅ DirectMedia: Download bem-sucedido para', contentType);
        return {
          success: true,
          mediaUrl: blobUrl,
          cached: false
        };
      }

      console.error('❌ DirectMedia: Falha no download:', response.error);
      return {
        success: false,
        error: response.error || 'Falha no download direto'
      };

    } catch (error) {
      console.error('❌ DirectMedia: Erro no download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Buscar mídia processada (com fallback para descriptografia)
   */
  async processMedia(
    instanceId: string,
    messageId: string,
    mediaUrl: string,
    mediaKey: string,
    directPath: string,
    mimetype: string,
    contentType: 'image' | 'video' | 'audio' | 'document'
  ): Promise<MediaDownloadResult> {
    console.log('🎯 DirectMedia: Processando', contentType, 'para', messageId);

    // Tentar download direto primeiro
    const directResult = await this.downloadMedia(
      instanceId,
      mediaUrl,
      mediaKey,
      directPath,
      mimetype,
      contentType
    );

    if (directResult.success) {
      return directResult;
    }

    console.log('⚡ DirectMedia: Download direto falhou, tentando fallback para descriptografia');
    
    // TODO: Implementar fallback para sistema de descriptografia existente
    // Por enquanto retornamos erro
    return {
      success: false,
      error: 'Download direto falhou e fallback não implementado ainda'
    };
  }

  private getCachedMedia(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Verificar se não expirou
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      URL.revokeObjectURL(cached.url); // Limpar blob URL
      return null;
    }

    return cached.url;
  }

  private setCachedMedia(cacheKey: string, url: string): void {
    this.cache.set(cacheKey, {
      url,
      timestamp: Date.now()
    });
  }

  /**
   * Limpar cache expirado
   */
  clearExpiredCache(): number {
    let cleared = 0;
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        URL.revokeObjectURL(value.url);
        this.cache.delete(key);
        cleared++;
      }
    }
    
    console.log(`🧹 DirectMedia: Limpou ${cleared} itens do cache`);
    return cleared;
  }

  /**
   * Estatísticas do cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Limpar todo o cache
   */
  clearCache(): void {
    for (const value of this.cache.values()) {
      URL.revokeObjectURL(value.url);
    }
    this.cache.clear();
    console.log('🗑️ DirectMedia: Cache completamente limpo');
  }
}

export const directMediaDownloadService = new DirectMediaDownloadService();