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

    // 2. Verificar cache no Supabase
    const cachedMedia = await this.getCachedMedia(mediaData.messageId);
    if (cachedMedia) {
      console.log('💾 [UNIFIED-MEDIA] Mídia encontrada no cache do Supabase');
      const result: ProcessedMedia = {
        success: true,
        mediaUrl: cachedMedia.media_url,
        mimeType: cachedMedia.mime_type,
        format: this.extractFormat(cachedMedia.mime_type),
        cached: true
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // 3. Processar via API nativa
    try {
      const result = await this.downloadMediaDirectly(mediaData);
      
      if (result.success && result.mediaUrl) {
        // Salvar no cache do Supabase
        await this.saveCachedMedia({
          message_id: mediaData.messageId,
          media_type: mediaData.contentType,
          media_url: result.mediaUrl,
          mime_type: result.mimeType || 'application/octet-stream'
        });
        
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

  /**
   * Buscar mídia do cache no Supabase
   */
  private async getCachedMedia(messageId: string): Promise<MediaCacheEntry | null> {
    try {
      const { data, error } = await supabase
        .from('media_cache')
        .select('*')
        .eq('message_id', messageId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return data as MediaCacheEntry;
    } catch (error) {
      console.warn('⚠️ [UNIFIED-MEDIA] Erro ao buscar cache:', error);
      return null;
    }
  }

  /**
   * Salvar mídia no cache do Supabase
   */
  private async saveCachedMedia(mediaInfo: {
    message_id: string;
    media_type: string;
    media_url: string;
    mime_type: string;
  }): Promise<void> {
    try {
      // TTL baseado no tipo de mídia
      const ttlHours = this.getTTLByType(mediaInfo.media_type);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      const { error } = await supabase
        .from('media_cache')
        .upsert({
          ...mediaInfo,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.warn('⚠️ [UNIFIED-MEDIA] Erro ao salvar cache:', error);
      } else {
        console.log('💾 [UNIFIED-MEDIA] Mídia salva no cache');
      }
    } catch (error) {
      console.warn('⚠️ [UNIFIED-MEDIA] Erro ao salvar cache:', error);
    }
  }

  /**
   * TTL baseado no tipo de mídia
   */
  private getTTLByType(mediaType: string): number {
    switch (mediaType) {
      case 'audio': return 4; // 4 horas - áudios são menores
      case 'image': return 12; // 12 horas - imagens são médias
      case 'document': return 24; // 24 horas - documentos são importantes
      case 'video': return 6; // 6 horas - vídeos são pesados
      default: return 8; // 8 horas - padrão
    }
  }

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
   * Limpar cache expirado
   */
  async cleanExpiredCache(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('media_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('❌ [UNIFIED-MEDIA] Erro ao limpar cache:', error);
        return 0;
      }

      const cleanedCount = data?.length || 0;
      console.log(`🧹 [UNIFIED-MEDIA] Cache limpo: ${cleanedCount} itens removidos`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ [UNIFIED-MEDIA] Erro ao limpar cache:', error);
      return 0;
    }
  }

  /**
   * Estatísticas do cache
   */
  async getCacheStats(): Promise<{
    localCacheSize: number;
    dbCacheSize: number;
    totalExpired: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('media_cache')
        .select('id, expires_at')
        .order('created_at', { ascending: false });

      if (error) {
        return {
          localCacheSize: this.cache.size,
          dbCacheSize: 0,
          totalExpired: 0
        };
      }

      const now = new Date();
      const expired = data.filter(item => new Date(item.expires_at) < now).length;

      return {
        localCacheSize: this.cache.size,
        dbCacheSize: data.length,
        totalExpired: expired
      };
    } catch (error) {
      return {
        localCacheSize: this.cache.size,
        dbCacheSize: 0,
        totalExpired: 0
      };
    }
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