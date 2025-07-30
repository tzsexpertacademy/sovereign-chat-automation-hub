/**
 * Serviço Unificado de Mídia - CodeChat API v2.2.1
 * Usa o endpoint /media/directly-download para todas as mídias
 */

import { supabase } from '@/integrations/supabase/client';

// ==================== TIPOS ====================

export interface MediaData {
  messageId: string;
  contentType: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  content: {
    url: string;
    mimetype: string;
    mediaKey: string;
    directPath: string;
  };
  instanceId: string;
}

export interface ProcessedMedia {
  success: boolean;
  mediaUrl?: string;
  mimeType?: string;
  format?: string;
  size?: number;
  cached: boolean;
  error?: string;
}

// MediaCacheEntry será adicionado após migração do banco
export interface MediaCacheEntry {
  id: string;
  message_id: string;
  media_type: string;
  media_url: string;
  mime_type: string;
  expires_at: string;
  created_at: string;
}

// ==================== SERVIÇO UNIFICADO ====================

class UnifiedMediaService {
  private static instance: UnifiedMediaService;
  private cache = new Map<string, ProcessedMedia>();
  private readonly baseUrl = 'https://api.yumer.com.br';

  private constructor() {}

  static getInstance(): UnifiedMediaService {
    if (!UnifiedMediaService.instance) {
      UnifiedMediaService.instance = new UnifiedMediaService();
    }
    return UnifiedMediaService.instance;
  }

  /**
   * Processa qualquer tipo de mídia usando o endpoint nativo
   */
  async processMedia(mediaData: MediaData): Promise<ProcessedMedia> {
    const cacheKey = `${mediaData.instanceId}:${mediaData.messageId}`;
    
    console.log('🎬 [UNIFIED-MEDIA] Processando mídia:', {
      messageId: mediaData.messageId,
      type: mediaData.contentType,
      hasUrl: !!mediaData.content.url,
      hasMediaKey: !!mediaData.content.mediaKey
    });

    // 1. Verificar cache local
    if (this.cache.has(cacheKey)) {
      console.log('⚡ [UNIFIED-MEDIA] Mídia encontrada no cache local');
      return this.cache.get(cacheKey)!;
    }

    // 2. TODO: Adicionar cache do Supabase após migração aprovada
    
    // 3. Processar via API nativa
    try {
      const result = await this.downloadMediaDirectly(mediaData);
      
      if (result.success && result.mediaUrl) {
        // Salvar no cache local
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [UNIFIED-MEDIA] Erro ao processar mídia:', error);
      return {
        success: false,
        cached: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Download direto usando endpoint nativo /media/directly-download
   */
  private async downloadMediaDirectly(mediaData: MediaData): Promise<ProcessedMedia> {
    try {
      // Buscar business_token da instância
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          instance_id,
          clients:client_id (
            business_token
          )
        `)
        .eq('instance_id', mediaData.instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        throw new Error('Business token não encontrado');
      }

      console.log('🌐 [UNIFIED-MEDIA] Fazendo download direto via API nativa...');

      const response = await fetch(
        `${this.baseUrl}/api/v2/instance/${mediaData.instanceId}/media/directly-download`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${instanceData.clients.business_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contentType: mediaData.contentType,
            content: mediaData.content
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Response é um blob binário
      const blob = await response.blob();
      const mediaUrl = URL.createObjectURL(blob);

      console.log('✅ [UNIFIED-MEDIA] Download concluído:', {
        size: blob.size,
        type: blob.type
      });

      return {
        success: true,
        mediaUrl,
        mimeType: blob.type,
        format: this.extractFormat(blob.type),
        size: blob.size,
        cached: false
      };

    } catch (error) {
      console.error('❌ [UNIFIED-MEDIA] Erro no download direto:', error);
      throw error;
    }
  }

  // TODO: Métodos de cache do Supabase serão adicionados após aprovação da migração

  /**
   * Extrair formato do MIME type
   */
  private extractFormat(mimeType: string): string {
    if (!mimeType) return 'unknown';
    
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('jpeg')) return 'jpeg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('pdf')) return 'pdf';
    
    return mimeType.split('/').pop() || 'unknown';
  }

  /**
   * Limpar cache expirado (apenas cache local por enquanto)
   */
  async cleanExpiredCache(): Promise<number> {
    // TODO: Implementar após migração do banco
    console.log('🧹 [UNIFIED-MEDIA] Limpeza de cache será implementada após migração');
    return 0;
  }

  /**
   * Estatísticas do cache (apenas cache local por enquanto)
   */
  async getCacheStats(): Promise<{
    localCacheSize: number;
    dbCacheSize: number;
    totalExpired: number;
  }> {
    return {
      localCacheSize: this.cache.size,
      dbCacheSize: 0, // TODO: Implementar após migração
      totalExpired: 0 // TODO: Implementar após migração
    };
  }

  /**
   * Limpar cache local
   */
  clearLocalCache(): void {
    this.cache.clear();
    console.log('🧹 [UNIFIED-MEDIA] Cache local limpo');
  }

  // ==================== MÉTODOS PÚBLICOS POR TIPO ====================

  /**
   * Processar áudio
   */
  async processAudio(messageId: string, instanceId: string, audioData: {
    url: string;
    mimetype: string;
    mediaKey: string;
    directPath: string;
  }): Promise<ProcessedMedia> {
    return this.processMedia({
      messageId,
      instanceId,
      contentType: 'audio',
      content: audioData
    });
  }

  /**
   * Processar imagem
   */
  async processImage(messageId: string, instanceId: string, imageData: {
    url: string;
    mimetype: string;
    mediaKey: string;
    directPath: string;
  }): Promise<ProcessedMedia> {
    return this.processMedia({
      messageId,
      instanceId,
      contentType: 'image',
      content: imageData
    });
  }

  /**
   * Processar vídeo
   */
  async processVideo(messageId: string, instanceId: string, videoData: {
    url: string;
    mimetype: string;
    mediaKey: string;
    directPath: string;
  }): Promise<ProcessedMedia> {
    return this.processMedia({
      messageId,
      instanceId,
      contentType: 'video',
      content: videoData
    });
  }

  /**
   * Processar documento
   */
  async processDocument(messageId: string, instanceId: string, documentData: {
    url: string;
    mimetype: string;
    mediaKey: string;
    directPath: string;
  }): Promise<ProcessedMedia> {
    return this.processMedia({
      messageId,
      instanceId,
      contentType: 'document',
      content: documentData
    });
  }
}

// ==================== EXPORT ====================

export const unifiedMediaService = UnifiedMediaService.getInstance();
export default unifiedMediaService;