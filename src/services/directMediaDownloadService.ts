import unifiedYumerService from './unifiedYumerService';
import { unifiedMediaCache } from './unifiedMediaCache';

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

  /**
   * Converter buffer/objeto para Base64 string
   */
  private convertToBase64(data: any): string | null {
    try {
      if (typeof data === 'string') {
        return data; // Já é string Base64
      }
      
      if (data instanceof Uint8Array) {
        return btoa(String.fromCharCode(...data));
      }
      
      if (typeof data === 'object' && data !== null) {
        // Converter objeto {0: 251, 1: 128, ...} para Uint8Array
        const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
        const bytes = new Uint8Array(keys.length);
        keys.forEach((key, index) => {
          bytes[index] = data[key];
        });
        return btoa(String.fromCharCode(...bytes));
      }
      
      return null;
    } catch (error) {
      console.error('❌ DirectMedia: Erro ao converter para Base64:', error);
      return null;
    }
  }

  /**
   * Buscar instanceId interno do Supabase
   */
  private async getInternalInstanceId(externalInstanceId: string): Promise<string | null> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('instance_id', externalInstanceId)
        .single();
        
      return data?.instance_id || null;
    } catch (error) {
      console.error('❌ DirectMedia: Erro ao buscar instance ID:', error);
      return null;
    }
  }

  /**
   * Download direto de mídia usando endpoint da API Yumer
   */
  async downloadMedia(
    instanceId: string,
    mediaUrl: string,
    mediaKey: string,
    directPath: string,
    mimetype: string,
    contentType: 'image' | 'video' | 'audio' | 'document'
  ): Promise<MediaDownloadResult> {
    // Verificar cache unificado primeiro
    const messageId = `direct_${Date.now()}`;
    const cached = unifiedMediaCache.get(instanceId, messageId, mediaKey);
    if (cached) {
      console.log('📦 DirectMedia: Cache HIT para', contentType);
      return {
        success: true,
        mediaUrl: cached,
        cached: true
      };
    }

    try {
      console.log('🔄 DirectMedia: Baixando', contentType, 'via API direta');
      
      // Converter mediaKey se necessário
      const base64MediaKey = this.convertToBase64(mediaKey);
      if (!base64MediaKey) {
        throw new Error('Falha na conversão do media key');
      }

      const requestBody: MediaDownloadRequest = {
        contentType,
        content: {
          url: mediaUrl,
          mimetype,
          mediaKey: base64MediaKey,
          directPath
        }
      };

      // Buscar instanceId interno
      const internalInstanceId = await this.getInternalInstanceId(instanceId);
      if (!internalInstanceId) {
        throw new Error('Instance ID não encontrado');
      }

      const response = await unifiedYumerService.makeRequest(
        `/api/v2/instance/${internalInstanceId}/media/directly-download`,
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
        
        // Cachear resultado no cache unificado
        unifiedMediaCache.set(instanceId, messageId, blobUrl, 'DirectMedia', mediaKey, mimetype);
        
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

    // Verificar cache primeiro
    const cached = unifiedMediaCache.get(instanceId, messageId, mediaKey);
    if (cached) {
      console.log('📦 DirectMedia: Cache HIT para processMedia');
      return {
        success: true,
        mediaUrl: cached,
        cached: true
      };
    }

    // Tentar download direto
    const directResult = await this.downloadMedia(
      instanceId,
      mediaUrl,
      mediaKey,
      directPath,
      mimetype,
      contentType
    );

    if (directResult.success && directResult.mediaUrl) {
      // Salvar no cache com o messageId real
      unifiedMediaCache.set(instanceId, messageId, directResult.mediaUrl, 'DirectMedia', mediaKey, mimetype);
      return directResult;
    }

    console.log('⚡ DirectMedia: Download direto falhou, tentando fallback');
    
    // Fallback: tentar MediaDisplayService
    try {
      const { mediaDisplayService } = await import('./mediaDisplayService');
      
      // Buscar dados do ticket para usar no fallback
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: ticketData } = await supabase
        .from('conversation_tickets')
        .select('chat_id')
        .eq('instance_id', instanceId)
        .limit(1)
        .single();
      
      if (ticketData?.chat_id) {
        const fallbackResult = await mediaDisplayService.displayMedia({
          instanceId,
          messageId,
          chatId: ticketData.chat_id,
          mediaUrl,
          mediaKey,
          directPath,
          mimetype,
          contentType
        });

        if (fallbackResult.success && fallbackResult.mediaUrl) {
          console.log('✅ DirectMedia: Fallback sucesso via', fallbackResult.strategy);
          unifiedMediaCache.set(instanceId, messageId, fallbackResult.mediaUrl, `Fallback-${fallbackResult.strategy}`, mediaKey, mimetype);
          return {
            success: true,
            mediaUrl: fallbackResult.mediaUrl,
            cached: false
          };
        }
      }
    } catch (error) {
      console.error('❌ DirectMedia: Erro no fallback:', error);
    }
    
    return {
      success: false,
      error: 'Todos os métodos de download falharam'
    };
  }

  /**
   * Limpar cache expirado (delega para cache unificado)
   */
  clearExpiredCache(): number {
    return unifiedMediaCache.cleanExpired();
  }

  /**
   * Estatísticas do cache (delega para cache unificado)
   */
  getCacheStats() {
    return unifiedMediaCache.getStats();
  }

  /**
   * Limpar todo o cache (delega para cache unificado)
   */
  clearCache(): void {
    unifiedMediaCache.clear();
  }

  /**
   * Log do status do cache
   */
  logCacheStatus(): void {
    unifiedMediaCache.logStatus();
  }
}

export const directMediaDownloadService = new DirectMediaDownloadService();