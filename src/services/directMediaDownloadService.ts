import unifiedYumerService from './unifiedYumerService';
import { unifiedMediaCache } from './unifiedMediaCache';
import { serverConfigService } from './serverConfigService';

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
   * Download direto de mídia usando APENAS o endpoint directly-download com FALLBACKS ROBUSTOS
   */
  async downloadMedia(
    instanceId: string,
    mediaUrl: string,
    mediaKey?: string,
    directPath?: string,
    mimetype?: string,
    contentType: 'image' | 'video' | 'audio' | 'document' = 'document'
  ): Promise<MediaDownloadResult> {
    const startTime = Date.now();
    console.log('🚀 DirectMedia: INICIANDO PROCESSAMENTO', {
      contentType,
      instanceId,
      mediaUrl: mediaUrl?.substring(0, 100) + '...',
      hasMediaKey: !!mediaKey,
      mediaKeyType: typeof mediaKey,
      mimetype,
      timestamp: new Date().toISOString()
    });

    try {
      // 1. Para mensagens manuais sem mediaKey - usar URL diretamente
      if (!mediaKey) {
        console.log('📁 DirectMedia: MENSAGEM MANUAL - usando URL direta');
        const result = {
          success: true,
          mediaUrl: mediaUrl,
          cached: false
        };
        console.log(`✅ DirectMedia: MANUAL completado em ${Date.now() - startTime}ms`);
        return result;
      }
      
      // 2. Verificar cache unificado para mensagens com mediaKey
      const messageId = `direct_${Date.now()}`;
      const cached = unifiedMediaCache.get(instanceId, messageId, mediaKey);
      if (cached) {
        console.log('📦 DirectMedia: CACHE HIT', {
          contentType,
          cacheKey: messageId,
          duration: Date.now() - startTime
        });
        return {
          success: true,
          mediaUrl: cached,
          cached: true
        };
      }
      
      console.log('🎯 DirectMedia: INICIANDO DESCRIPTOGRAFIA', {
        endpoint: 'directly-download',
        hasAuth: false // será verificado abaixo
      });
      
      // 3. Converter mediaKey se necessário - garantir que é Base64 string
      let base64MediaKey = mediaKey;
      if (typeof mediaKey === 'object' && mediaKey !== null) {
        console.log('🔄 DirectMedia: Convertendo mediaKey de objeto para Base64');
        base64MediaKey = this.convertToBase64(mediaKey);
        if (!base64MediaKey) {
          throw new Error('Falha na conversão do mediaKey para Base64');
        }
      }
      
      if (!base64MediaKey || typeof base64MediaKey !== 'string') {
        throw new Error(`MediaKey inválido: ${typeof mediaKey}`);
      }

      // 4. Buscar instanceId interno
      const internalInstanceId = await this.getInternalInstanceId(instanceId);
      if (!internalInstanceId) {
        throw new Error(`Instance ID não encontrado para: ${instanceId}`);
      }

      // 5. Buscar token do business para auth
      let authToken = '';
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: clientData } = await supabase
          .from('clients')
          .select('business_token')
          .eq('instance_id', instanceId)
          .single();
        authToken = clientData?.business_token || '';
        console.log('🔑 DirectMedia: Token obtido', { 
          hasToken: !!authToken,
          tokenLength: authToken.length 
        });
      } catch (error) {
        console.warn('⚠️ DirectMedia: Erro ao buscar token:', error);
        throw new Error('Token de autenticação não encontrado');
      }

      const requestBody: MediaDownloadRequest = {
        contentType,
        content: {
          url: mediaUrl,
          mimetype: mimetype || 'application/octet-stream',
          mediaKey: base64MediaKey,
          directPath: directPath || ''
        }
      };

      // 6. Fazer request com retry e timeout
      const apiEndpoint = `https://api.yumer.com.br/api/v2/instance/${internalInstanceId}/media/directly-download`;
      
      console.log('📡 DirectMedia: ENVIANDO REQUEST', {
        endpoint: apiEndpoint,
        contentType,
        bodySize: JSON.stringify(requestBody).length
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('📡 DirectMedia: RESPONSE RECEBIDA', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          duration: Date.now() - startTime
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ DirectMedia: ERRO DA API', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            headers: Object.fromEntries(response.headers.entries())
          });
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        // 7. Processar blob resultado
        const blob = await response.blob();
        console.log('📦 DirectMedia: BLOB PROCESSADO', {
          size: blob.size,
          type: blob.type
        });

        if (blob.size === 0) {
          throw new Error('Blob vazio recebido da API');
        }

        const blobUrl = URL.createObjectURL(blob);
        
        // 8. Cachear resultado no cache unificado
        unifiedMediaCache.set(instanceId, messageId, blobUrl, 'DirectMedia', mediaKey, mimetype);
        
        console.log('✅ DirectMedia: SUCESSO TOTAL', {
          duration: Date.now() - startTime,
          blobSize: blob.size,
          cached: true
        });

        return {
          success: true,
          mediaUrl: blobUrl,
          cached: false
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout na requisição (30s)');
        }
        
        throw fetchError;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ DirectMedia: FALHA TOTAL', {
        error: error instanceof Error ? error.message : String(error),
        duration,
        contentType,
        instanceId,
        stack: error instanceof Error ? error.stack : undefined
      });

      // FALLBACK EMERGENCIAL: Tentar usar URL original se disponível
      if (mediaUrl && !mediaUrl.includes('.enc')) {
        console.log('🚨 DirectMedia: FALLBACK EMERGENCIAL - usando URL original');
        return {
          success: true,
          mediaUrl: mediaUrl,
          cached: false,
          error: `Fallback usado após erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na descriptografia'
      };
    }
  }

  /**
   * Buscar mídia processada - SIMPLIFICADO para usar apenas directly-download
   */
  async processMedia(
    instanceId: string,
    messageId: string,
    mediaUrl: string,
    mediaKey?: string,
    directPath?: string,
    mimetype?: string,
    contentType: 'image' | 'video' | 'audio' | 'document' = 'document'
  ): Promise<MediaDownloadResult> {
    console.log('🎯 DirectMedia: Processando', contentType, 'para', messageId);

    // Verificar cache primeiro se temos mediaKey
    if (mediaKey) {
      const cached = unifiedMediaCache.get(instanceId, messageId, mediaKey);
      if (cached) {
        console.log('📦 DirectMedia: Cache HIT para processMedia');
        return {
          success: true,
          mediaUrl: cached,
          cached: true
        };
      }
    }

    // Usar downloadMedia único e simplificado
    const result = await this.downloadMedia(
      instanceId,
      mediaUrl,
      mediaKey,
      directPath,
      mimetype,
      contentType
    );

    // Salvar no cache se sucesso e temos mediaKey
    if (result.success && result.mediaUrl && mediaKey) {
      unifiedMediaCache.set(instanceId, messageId, result.mediaUrl, 'DirectMedia', mediaKey, mimetype);
    }

    return result;
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