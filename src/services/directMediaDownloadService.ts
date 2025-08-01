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
   * Download direto de mídia usando APENAS o endpoint directly-download
   */
  async downloadMedia(
    instanceId: string,
    mediaUrl: string,
    mediaKey?: string,
    directPath?: string,
    mimetype?: string,
    contentType: 'image' | 'video' | 'audio' | 'document' = 'document'
  ): Promise<MediaDownloadResult> {
    try {
      console.log('🔄 DirectMedia: Processando', contentType);
      
      // FALLBACK 1: Para mensagens manuais sem mediaKey - usar URL diretamente
      if (!mediaKey || !directPath) {
        console.log('📁 DirectMedia: Fallback - usando URL direta (sem descriptografia)');
        const response = await fetch(mediaUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        return {
          success: true,
          mediaUrl: blobUrl,
          cached: false
        };
      }
      
      // Verificar cache unificado para mensagens com mediaKey
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
      
      // PRINCIPAL: usar endpoint directly-download
      console.log('🎯 DirectMedia: Usando directly-download');
      
      // Converter mediaKey se necessário
      const base64MediaKey = this.convertToBase64(mediaKey);
      if (!base64MediaKey) {
        throw new Error('Falha na conversão do media key');
      }

      const requestBody: MediaDownloadRequest = {
        contentType,
        content: {
          url: mediaUrl,
          mimetype: mimetype || 'application/octet-stream',
          mediaKey: base64MediaKey,
          directPath: directPath
        }
      };

      // Buscar instanceId interno
      const internalInstanceId = await this.getInternalInstanceId(instanceId);
      if (!internalInstanceId) {
        throw new Error('Instance ID não encontrado');
      }

        // Fazer request com fetch direto para handle binário
        const config = serverConfigService.getConfig();
        const apiEndpoint = `https://api.yumer.com.br/api/v2/instance/${internalInstanceId}/media/directly-download`;
        
        console.log('🔄 DirectMedia: Chamando endpoint:', apiEndpoint);
        console.log('📦 DirectMedia: Body:', requestBody);
        
        // Buscar token do business para auth
        let authToken = '';
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: clientData } = await supabase
            .from('clients')
            .select('business_token')
            .eq('instance_id', instanceId)
            .single();
          authToken = clientData?.business_token || '';
        } catch (error) {
          console.warn('⚠️ DirectMedia: Erro ao buscar token:', error);
        }
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        // Response é binário direto
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: mimetype });
        const blobUrl = URL.createObjectURL(blob);
        
        // Cachear resultado no cache unificado
        unifiedMediaCache.set(instanceId, messageId, blobUrl, 'DirectMedia', mediaKey, mimetype);
        
        console.log('✅ DirectMedia: Download bem-sucedido para', contentType);
        return {
          success: true,
          mediaUrl: blobUrl,
          cached: false
        };

      // Este código nunca será alcançado devido ao return acima
      return {
        success: false,
        error: 'Falha no download direto'
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