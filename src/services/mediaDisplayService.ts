import { supabase } from '@/integrations/supabase/client';

interface MediaDisplayRequest {
  instanceId: string;
  messageId: string;
  chatId: string;
  mediaUrl?: string;
  mediaKey?: string;
  directPath?: string;
  mimetype?: string;
  contentType: 'image' | 'video' | 'audio' | 'document';
}

interface MediaDisplayResult {
  success: boolean;
  mediaUrl?: string;
  strategy?: 'prepare-file' | 'directly-download' | 'list-media' | 'cached';
  error?: string;
}

class MediaDisplayService {
  private cache = new Map<string, { url: string; timestamp: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutos

  /**
   * Converter dados JSON/objeto para Base64 string
   */
  private convertToBase64(data: any): string | null {
    if (!data) return null;
    
    if (typeof data === 'string') return data;
    
    if (data && typeof data === 'object') {
      // Se for um Uint8Array object serializado como JSON
      if (data.constructor === Object && typeof data['0'] === 'number') {
        const bytes = Object.keys(data).map(key => data[key]);
        return Buffer.from(bytes).toString('base64');
      }
      
      // Se for um array
      if (Array.isArray(data)) {
        return Buffer.from(data).toString('base64');
      }
      
      // Se for um objeto serializado, tentar JSON.stringify e converter
      try {
        const jsonString = JSON.stringify(data);
        return Buffer.from(jsonString, 'utf8').toString('base64');
      } catch (e) {
        console.warn('Falha ao converter objeto para base64:', e);
      }
    }
    
    return null;
  }

  /**
   * Buscar business_token da instância
   */
  private async getBusinessToken(instanceId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();

      if (!data?.business_business_id) {
        console.error('❌ MediaDisplay: business_business_id não encontrado');
        return null;
      }

      // Buscar business_token
      const { data: businessData } = await supabase
        .from('codechat_businesses')
        .select('business_token')
        .eq('business_id', data.business_business_id)
        .single();

      return businessData?.business_token || null;
    } catch (error) {
      console.error('❌ MediaDisplay: Erro ao buscar business_token:', error);
      return null;
    }
  }

  /**
   * Fazer requisição para API CodeChat V2
   */
  private async makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const baseUrl = 'https://api.yumer.com.br';
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Se é resposta binária (imagem/vídeo/áudio)
      if (response.headers.get('content-type')?.includes('application/octet-stream')) {
        return await response.arrayBuffer();
      }

      // Se é JSON
      return await response.json();
    } catch (error) {
      console.error('❌ MediaDisplay: Erro na requisição API:', error);
      throw error;
    }
  }

  /**
   * ESTRATÉGIA 1: Preparar mídia e buscar arquivo
   * POST /api/v2/instance/{instanceId}/media/message/{messageId}/prepare
   * GET /api/v2/instance/{instanceId}/media/{mediaId}/file
   */
  private async strategyPrepareFile(request: MediaDisplayRequest, businessToken: string): Promise<MediaDisplayResult> {
    try {
      console.log('🎯 MediaDisplay: Tentando Estratégia 1 - Prepare + File');

      // Passo 1: Preparar mídia
      const prepareResponse = await this.makeApiRequest(
        `/api/v2/instance/${request.instanceId}/media/message/${request.messageId}/prepare`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
          },
        }
      );

      if (!prepareResponse?.mediaId) {
        throw new Error('MediaId não retornado na preparação');
      }

      console.log('✅ MediaDisplay: Mídia preparada, mediaId:', prepareResponse.mediaId);

      // Passo 2: Buscar arquivo binário
      const fileData = await this.makeApiRequest(
        `/api/v2/instance/${request.instanceId}/media/${prepareResponse.mediaId}/file`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
          },
        }
      );

      // Converter ArrayBuffer para Blob
      const blob = new Blob([fileData], { type: request.mimetype || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      // Cachear
      const cacheKey = `${request.instanceId}-${request.messageId}`;
      this.setCachedMedia(cacheKey, blobUrl);

      return {
        success: true,
        mediaUrl: blobUrl,
        strategy: 'prepare-file'
      };

    } catch (error) {
      console.error('❌ MediaDisplay: Estratégia 1 falhou:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro na estratégia prepare-file'
      };
    }
  }

  /**
   * ESTRATÉGIA 2: Download direto
   * POST /api/v2/instance/{instanceId}/media/directly-download
   */
  private async strategyDirectlyDownload(request: MediaDisplayRequest, businessToken: string): Promise<MediaDisplayResult> {
    try {
      console.log('🎯 MediaDisplay: Tentando Estratégia 2 - Directly Download');

      if (!request.mediaUrl || !request.mediaKey) {
        throw new Error('MediaUrl ou MediaKey ausentes para download direto');
      }

      // Converter mediaKey se necessário
      const base64MediaKey = this.convertToBase64(request.mediaKey);
      if (!base64MediaKey) {
        throw new Error('Falha na conversão do media key');
      }

      const requestBody = {
        contentType: request.contentType,
        content: {
          url: request.mediaUrl,
          mimetype: request.mimetype || 'application/octet-stream',
          mediaKey: base64MediaKey,
          directPath: request.directPath || ''
        }
      };

      const fileData = await this.makeApiRequest(
        `/api/v2/instance/${request.instanceId}/media/directly-download`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      // Converter ArrayBuffer para Blob
      const blob = new Blob([fileData], { type: request.mimetype || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      // Cachear
      const cacheKey = `${request.instanceId}-${request.messageId}`;
      this.setCachedMedia(cacheKey, blobUrl);

      return {
        success: true,
        mediaUrl: blobUrl,
        strategy: 'directly-download'
      };

    } catch (error) {
      console.error('❌ MediaDisplay: Estratégia 2 falhou:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no download direto'
      };
    }
  }

  /**
   * ESTRATÉGIA 3: Listar mídias por tipo e chat
   * GET /api/v2/instance/{instanceId}/media?type={type}&keyRemoteJid={chatId}
   */
  private async strategyListMedia(request: MediaDisplayRequest, businessToken: string): Promise<MediaDisplayResult> {
    try {
      console.log('🎯 MediaDisplay: Tentando Estratégia 3 - List Media');

      const mediaList = await this.makeApiRequest(
        `/api/v2/instance/${request.instanceId}/media?type=${request.contentType}&keyRemoteJid=${request.chatId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
          },
        }
      );

      if (!Array.isArray(mediaList) || mediaList.length === 0) {
        throw new Error('Nenhuma mídia encontrada na listagem');
      }

      // Buscar mídia correspondente ao messageId
      const targetMedia = mediaList.find(media => 
        media.Message?.messageId === request.messageId
      );

      if (!targetMedia?.mediaId) {
        throw new Error('Mídia não encontrada na listagem');
      }

      console.log('✅ MediaDisplay: Mídia encontrada na listagem, mediaId:', targetMedia.mediaId);

      // Buscar arquivo binário usando mediaId encontrado
      const fileData = await this.makeApiRequest(
        `/api/v2/instance/${request.instanceId}/media/${targetMedia.mediaId}/file`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${businessToken}`,
          },
        }
      );

      // Converter ArrayBuffer para Blob
      const blob = new Blob([fileData], { type: request.mimetype || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      // Cachear
      const cacheKey = `${request.instanceId}-${request.messageId}`;
      this.setCachedMedia(cacheKey, blobUrl);

      return {
        success: true,
        mediaUrl: blobUrl,
        strategy: 'list-media'
      };

    } catch (error) {
      console.error('❌ MediaDisplay: Estratégia 3 falhou:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro na listagem de mídia'
      };
    }
  }

  /**
   * Método principal: tentar todas as estratégias em sequência
   */
  async displayMedia(request: MediaDisplayRequest): Promise<MediaDisplayResult> {
    const cacheKey = `${request.instanceId}-${request.messageId}`;
    
    // Verificar cache primeiro
    const cached = this.getCachedMedia(cacheKey);
    if (cached) {
      console.log('📦 MediaDisplay: Usando cache para', request.messageId);
      return {
        success: true,
        mediaUrl: cached,
        strategy: 'cached'
      };
    }

    // Buscar business_token
    const businessToken = await this.getBusinessToken(request.instanceId);
    if (!businessToken) {
      return {
        success: false,
        error: 'Business token não encontrado para a instância'
      };
    }

    console.log('🚀 MediaDisplay: Iniciando display de mídia para:', request.messageId);

    // Tentar estratégias em ordem
    const strategies = [
      () => this.strategyPrepareFile(request, businessToken),
      () => this.strategyDirectlyDownload(request, businessToken),
      () => this.strategyListMedia(request, businessToken),
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]();
        if (result.success) {
          console.log(`✅ MediaDisplay: Sucesso na estratégia ${i + 1} (${result.strategy})`);
          return result;
        }
      } catch (error) {
        console.error(`❌ MediaDisplay: Estratégia ${i + 1} falhou:`, error);
      }
    }

    return {
      success: false,
      error: 'Todas as estratégias de display falharam'
    };
  }

  private getCachedMedia(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Verificar se não expirou
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      URL.revokeObjectURL(cached.url);
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
    
    return cleared;
  }

  clearCache(): void {
    for (const value of this.cache.values()) {
      URL.revokeObjectURL(value.url);
    }
    this.cache.clear();
  }
}

export const mediaDisplayService = new MediaDisplayService();