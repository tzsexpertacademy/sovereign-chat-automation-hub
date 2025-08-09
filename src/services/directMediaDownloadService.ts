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
  private businessToken: string | null = null;
  
  /**
   * 🔒 SISTEMA DE LOCK GLOBAL: Evita chamadas duplicadas à API
   * Map de locks por chave única (instanceId:mediaKey)
   */
  private processingLocks = new Map<string, Promise<MediaDownloadResult>>();

  /**
   * Converter buffer/objeto para Base64 string de forma robusta
   */
  private convertToBase64(data: any): string | null {
    try {
      if (!data) return null;
      
      // Se já é string Base64, retornar como está
      if (typeof data === 'string') {
        return data;
      }
      
      // Se é Uint8Array
      if (data instanceof Uint8Array) {
        return btoa(String.fromCharCode(...data));
      }
      
      // Se é objeto {0: 251, 1: 128, ...} (Uint8Array serializado)
      if (typeof data === 'object' && !Array.isArray(data)) {
        const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
        if (keys.length > 0 && keys.every(k => !isNaN(k) && k >= 0)) {
          const bytes = new Uint8Array(keys.length);
          keys.forEach((key, index) => {
            bytes[index] = data[key];
          });
          return btoa(String.fromCharCode(...bytes));
        }
      }
      
      // Se é array de bytes
      if (Array.isArray(data)) {
        const bytes = new Uint8Array(data);
        return btoa(String.fromCharCode(...bytes));
      }
      
      console.warn('🔧 [CONVERT-TO-BASE64] Tipo não reconhecido:', typeof data, data);
      return null;
    } catch (error) {
      console.error('❌ DirectMedia: Erro ao converter para Base64:', error);
      return null;
    }
  }


  /**
   * Buscar instanceId e business_token com estratégia híbrida
   */
  private async getInternalInstanceId(externalInstanceId: string): Promise<string | null> {
    try {
      console.log('🔍 [MEDIA-DOWNLOAD] Buscando dados da instância para:', externalInstanceId);
      const { supabase } = await import('@/integrations/supabase/client');
      
      // ESTRATÉGIA 1: Busca direta por instance_id
      let { data: instanceData, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, business_business_id')
        .eq('instance_id', externalInstanceId)
        .single();

      // ESTRATÉGIA 2: Se não encontrou, tentar buscar por business_business_id
      if (instanceError || !instanceData) {
        console.log('🔄 [MEDIA-DOWNLOAD] Busca direta falhou, tentando por business_business_id...');
        
        const { data: businessInstances, error: businessError } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, client_id, business_business_id')
          .eq('business_business_id', externalInstanceId);

        if (!businessError && businessInstances && businessInstances.length > 0) {
          instanceData = businessInstances[0]; // Usar primeira instância encontrada
          console.log('✅ [MEDIA-DOWNLOAD] Instância encontrada via business_business_id');
        }
      }

      // ESTRATÉGIA 3: Se ainda não encontrou, decodificar JWT do business_token para mapear
      if (!instanceData) {
        console.log('🔄 [MEDIA-DOWNLOAD] Tentando mapear via JWT dos business_tokens...');
        
        const { data: allClients } = await supabase
          .from('clients')
          .select('id, business_token');

        for (const client of allClients || []) {
          if (client.business_token) {
            try {
              // Decodificar JWT para extrair I_ID
              const payload = JSON.parse(atob(client.business_token.split('.')[1]));
              if (payload.I_ID === externalInstanceId) {
                // Encontrou! Buscar instância deste cliente
                const { data: clientInstances } = await supabase
                  .from('whatsapp_instances')
                  .select('instance_id, client_id, business_business_id')
                  .eq('client_id', client.id);

                if (clientInstances && clientInstances.length > 0) {
                  instanceData = clientInstances[0];
                  console.log('✅ [MEDIA-DOWNLOAD] Instância encontrada via JWT mapping');
                  break;
                }
              }
            } catch (jwtError) {
              // Ignorar erros de JWT inválido
            }
          }
        }
      }

      if (!instanceData) {
        console.error('❌ [MEDIA-DOWNLOAD] Instância não encontrada após todas as estratégias:', externalInstanceId);
        return null;
      }

      console.log('✅ [MEDIA-DOWNLOAD] Instância encontrada:', {
        instance_id: instanceData.instance_id,
        client_id: instanceData.client_id,
        business_business_id: instanceData.business_business_id
      });

      // Buscar business_token do cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('business_token')
        .eq('id', instanceData.client_id)
        .single();

      if (clientError || !clientData?.business_token) {
        console.error('❌ [MEDIA-DOWNLOAD] Erro ao buscar business_token:', clientError);
        return null;
      }

      console.log('✅ [MEDIA-DOWNLOAD] Business token encontrado para cliente');
      
      // Armazenar business_token para uso posterior
      this.businessToken = clientData.business_token;
      
      return instanceData.instance_id;
    } catch (error) {
      console.error('❌ [MEDIA-DOWNLOAD] Erro na busca dos dados:', error);
      return null;
    }
  }

  /**
   * Domínios do WhatsApp que sempre usam mídia criptografada
   */
  private isWhatsAppEncryptedDomain(url: string): boolean {
    const encryptedDomains = [
      'mmg.whatsapp.net',
      'pps.whatsapp.net',
      'media-iad1-1.cdn.whatsapp.net',
      'media-lga3-1.cdn.whatsapp.net'
    ];
    
    return encryptedDomains.some(domain => url.includes(domain));
  }

  /**
   * 🔒 SISTEMA DE LOCK CENTRALIZADO
   * Método unificado para evitar chamadas duplicadas à API
   */
  private async downloadWithLock(
    lockKey: string,
    contentType: string,
    downloadFn: () => Promise<MediaDownloadResult>
  ): Promise<MediaDownloadResult> {
    // ⏳ Se já está sendo processado, aguardar resultado da operação em andamento
    if (this.processingLocks.has(lockKey)) {
      console.log(`🔒 [LOCK-${contentType.toUpperCase()}] Mídia já sendo processada, aguardando conclusão...`);
      console.log(`🔑 [LOCK-${contentType.toUpperCase()}] LockKey:`, lockKey.substring(0, 100) + '...');
      
      try {
        const existingResult = await this.processingLocks.get(lockKey);
        console.log(`✅ [LOCK-${contentType.toUpperCase()}] Resultado obtido da operação em andamento`);
        return existingResult!;
      } catch (error) {
        console.error(`❌ [LOCK-${contentType.toUpperCase()}] Erro na operação em andamento:`, error);
        // Remover lock problemático e tentar novamente
        this.processingLocks.delete(lockKey);
      }
    }
    
    // 🚀 Criar nova operação e armazenar no sistema de locks
    console.log(`🔓 [LOCK-${contentType.toUpperCase()}] Iniciando nova operação de download`);
    console.log(`🔑 [LOCK-${contentType.toUpperCase()}] LockKey:`, lockKey.substring(0, 100) + '...');
    
    const processingPromise = downloadFn();
    
    // Armazenar promise no sistema de locks
    this.processingLocks.set(lockKey, processingPromise);
    
    try {
      const result = await processingPromise;
      console.log(`✅ [LOCK-${contentType.toUpperCase()}] Download concluído com sucesso`);
      return result;
    } catch (error) {
      console.error(`❌ [LOCK-${contentType.toUpperCase()}] Erro no download:`, error);
      throw error;
    } finally {
      // 🧹 SEMPRE limpar lock após processamento (sucesso ou erro)
      this.processingLocks.delete(lockKey);
      console.log(`🧹 [LOCK-${contentType.toUpperCase()}] Lock removido do sistema`);
    }
  }

  /**
   * Download direto de mídia com SISTEMA DE LOCK GLOBAL
   * Evita chamadas duplicadas para a mesma mídia
   */
  async downloadMedia(
    instanceId: string,
    mediaUrl: string,
    mediaKey?: string,
    directPath?: string,
    mimetype?: string,
    contentType: 'image' | 'video' | 'audio' | 'document' = 'document'
  ): Promise<MediaDownloadResult> {
    // 🔒 SISTEMA DE LOCK: Gerar chave única para esta mídia
    const lockKey = `${instanceId}:${mediaKey || mediaUrl}:${contentType}`;
    
    return this.downloadWithLock(lockKey, contentType, () =>
      this.performMediaDownload(instanceId, mediaUrl, mediaKey, directPath, mimetype, contentType)
    );
  }

  /**
   * Operação real de download - extraída para permitir sistema de locks
   */
  private async performMediaDownload(
    instanceId: string,
    mediaUrl: string,
    mediaKey?: string,
    directPath?: string,
    mimetype?: string,
    contentType: 'image' | 'video' | 'audio' | 'document' = 'document'
  ): Promise<MediaDownloadResult> {
    try {
      console.log(`🔄 [MEDIA-${contentType.toUpperCase()}] Processando - URL:`, mediaUrl?.substring(0, 100));
      console.log(`🔍 [MEDIA-${contentType.toUpperCase()}] MediaKey presente:`, !!mediaKey);
      console.log(`🌐 [MEDIA-${contentType.toUpperCase()}] Domínio WhatsApp detectado:`, this.isWhatsAppEncryptedDomain(mediaUrl || ''));
      
      // NOVA LÓGICA: Se não tem mediaKey válido, assumir que é mensagem manual/não-criptografada
      if (!mediaKey || typeof mediaKey !== 'string' && typeof mediaKey !== 'object') {
        console.log(`📁 [MEDIA-${contentType.toUpperCase()}] Sem mediaKey válido - usando URL direta`);
        return {
          success: true,
          mediaUrl: mediaUrl,
          cached: false
        };
      }

      // Se tem mediaKey OU é domínio do WhatsApp, sempre usar directly-download
      if (mediaKey || this.isWhatsAppEncryptedDomain(mediaUrl || '')) {
        console.log(`🔐 [MEDIA-${contentType.toUpperCase()}] Mídia criptografada detectada - usando directly-download`);
        console.log(`📋 [MEDIA-${contentType.toUpperCase()}] Razão: ${mediaKey ? 'MediaKey presente' : 'Domínio WhatsApp'}`);
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
      console.log(`🎯 [MEDIA-${contentType.toUpperCase()}] Usando directly-download`);
      console.log(`📋 [MEDIA-${contentType.toUpperCase()}] Dados de entrada:`, {
        contentType,
        mediaUrl: mediaUrl.substring(0, 100) + '...',
        mediaKey: typeof mediaKey,
        mediaKeyLength: typeof mediaKey === 'string' ? mediaKey.length : 'N/A',
        directPath,
        mimetype
      });
      
      // Converter mediaKey se necessário - garantir que é Base64 string
      let base64MediaKey: any = mediaKey;
      // Caso mediaKey tenha vindo serializado como string JSON de bytes: "{\"0\":227,...}"
      if (typeof base64MediaKey === 'string' && base64MediaKey.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(base64MediaKey);
          console.log(`🔄 [MEDIA-${contentType.toUpperCase()}] Convertendo mediaKey string JSON -> Base64`);
          base64MediaKey = this.convertToBase64(parsed);
        } catch (e) {
          console.warn(`⚠️ [MEDIA-${contentType.toUpperCase()}] Falha ao parsear mediaKey JSON string`);
        }
      }
      if (typeof base64MediaKey === 'object' && base64MediaKey !== null) {
        console.log(`🔄 [MEDIA-${contentType.toUpperCase()}] Convertendo mediaKey de objeto para Base64`);
        base64MediaKey = this.convertToBase64(base64MediaKey);
      }
      
      if (!base64MediaKey || typeof base64MediaKey !== 'string') {
        console.error(`❌ [MEDIA-${contentType.toUpperCase()}] MediaKey inválido:`, typeof mediaKey);
        throw new Error(`MediaKey inválido para ${contentType}: ${typeof mediaKey}`);
      }
      
      console.log(`✅ [MEDIA-${contentType.toUpperCase()}] MediaKey validado - Length: ${base64MediaKey.length}`);

      const requestBody: MediaDownloadRequest = {
        contentType,
        content: {
          url: mediaUrl,
          mimetype: mimetype || 'application/octet-stream',
          mediaKey: base64MediaKey,
          directPath: directPath || ''
        }
      };
      
      console.log(`📤 [MEDIA-${contentType.toUpperCase()}] Request body preparado:`, {
        contentType: requestBody.contentType,
        url: requestBody.content.url.substring(0, 100) + '...',
        mimetype: requestBody.content.mimetype,
        mediaKeyLength: requestBody.content.mediaKey.length,
        directPath: requestBody.content.directPath
      });

      // Buscar instanceId interno
      console.log(`🔍 [MEDIA-${contentType.toUpperCase()}] Buscando instanceId interno para:`, instanceId);
      const internalInstanceId = await this.getInternalInstanceId(instanceId);
      console.log(`📋 [MEDIA-${contentType.toUpperCase()}] InstanceId interno obtido:`, internalInstanceId);
      
      if (!internalInstanceId) {
        throw new Error('Instance ID não encontrado no banco de dados');
      }

        // Usar o business_token já obtido
        if (!this.businessToken) {
          console.error('❌ [MEDIA-DOWNLOAD] Business token não encontrado');
          throw new Error('Business token não disponível');
        }
        
        console.log('✅ [MEDIA-DOWNLOAD] Usando business token armazenado');
        
        // Fazer request com fetch direto para handle binário
        const config = serverConfigService.getConfig();
        const apiEndpoint = `https://api.yumer.com.br/api/v2/instance/${internalInstanceId}/media/directly-download`;
        
        console.log('📡 [MEDIA-DOWNLOAD] Chamando endpoint:', apiEndpoint);
        console.log('📤 [MEDIA-DOWNLOAD] Request body:', JSON.stringify(requestBody, null, 2));
        console.log('🔑 [MEDIA-DOWNLOAD] Headers:', {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.businessToken.substring(0, 20)}...`
        });
        
        const response = await Promise.race([
          fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/octet-stream',
              'Authorization': `Bearer ${this.businessToken}`
            },
            body: JSON.stringify(requestBody)
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: API não respondeu em 60s')), 60000)
          )
        ]);

        console.log(`📥 [MEDIA-${contentType.toUpperCase()}] Response status:`, response.status);
        console.log(`📥 [MEDIA-${contentType.toUpperCase()}] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [MEDIA-${contentType.toUpperCase()}] Erro da API:`, response.status, errorText);
          console.error(`❌ [MEDIA-${contentType.toUpperCase()}] Request que falhou:`, {
            endpoint: apiEndpoint,
            contentType: requestBody.contentType,
            mimetype: requestBody.content.mimetype
          });
          
          // REMOVIDO FALLBACK PROBLEMÁTICO - não retornar URL criptografada
          throw new Error(`API directly-download falhou para ${contentType}: ${response.status} ${errorText}`);
        }

        const rawBlob = await response.blob();
        // Reempacotar com mimetype correto quando vier genérico
        const finalBlob = (rawBlob.type && rawBlob.type !== 'application/octet-stream')
          ? rawBlob
          : new Blob([await rawBlob.arrayBuffer()], { type: requestBody.content.mimetype || (contentType === 'audio' ? 'audio/ogg' : 'application/octet-stream') });
        
        console.log(`📦 [MEDIA-${contentType.toUpperCase()}] Blob recebido:`, {
          size: finalBlob.size,
          type: finalBlob.type,
          serverType: rawBlob.type,
          contentType: requestBody.contentType
        });
        
        if (finalBlob.size === 0) {
          console.error(`❌ [MEDIA-${contentType.toUpperCase()}] Blob vazio recebido da API`);
          throw new Error(`Blob vazio recebido para ${contentType}`);
        }
        
        // Verificar se o tipo MIME está correto para imagens
        if (contentType === 'image' && finalBlob.type && !finalBlob.type.startsWith('image/')) {
          console.warn(`⚠️ [MEDIA-${contentType.toUpperCase()}] Tipo MIME inesperado:`, finalBlob.type, 'esperado image/*');
        }
        
        const blobUrl = URL.createObjectURL(finalBlob);
        
        console.log(`✅ [MEDIA-${contentType.toUpperCase()}] Download direto bem-sucedido:`, {
          blobSize: finalBlob.size,
          blobType: finalBlob.type,
          mediaUrl: blobUrl.substring(0, 50) + '...'
        });
        
        // Cachear resultado no cache unificado
        unifiedMediaCache.set(instanceId, messageId, blobUrl, 'DirectMedia', mediaKey, mimetype);
        
        console.log(`✅ [MEDIA-${contentType.toUpperCase()}] Mídia descriptografada pelo servidor e pronta para uso`);
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
      console.error(`❌ [MEDIA-${contentType.toUpperCase()}] Erro no download:`, error);
      
      // REMOVIDO FALLBACK PARA URL CRIPTOGRAFADA - nunca retornar .enc
      // Se a API falhar, melhor retornar erro do que baixar arquivo criptografado
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Buscar mídia processada - SIMPLIFICADO para usar apenas directly-download
   * Agora com SISTEMA DE LOCK aplicado também
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
    // 🔒 SISTEMA DE LOCK: Usar mesma chave que downloadMedia
    const lockKey = `${instanceId}:${mediaKey || mediaUrl}:${contentType}`;
    
    return this.downloadWithLock(lockKey, contentType, async () => {
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

      // Fazer download direto (sem usar downloadMedia para evitar duplo lock)
      const result = await this.performMediaDownload(
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
    });
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