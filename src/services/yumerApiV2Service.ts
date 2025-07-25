
/**
 * CodeChat API v2.2.1 - Serviço Unificado
 * Baseado na documentação oficial: https://docs.codechat.dev/api/v2.2.1
 */

export interface ApiKey {
  name: string;
  key: string;
}

export interface Business {
  businessId: string;
  name: string;
  email: string;
  phone: string;
  slug: string;
  country: string;
  timezone: string;
  language: string;
  active: boolean;
  businessToken: string;
}

export interface Instance {
  instanceName: string;
  owner: string;
  profileName?: string;
  profilePicUrl?: string;
  status?: string;
  serverUrl?: string;
  apikey?: string;
  businessId?: string;
}

export interface ConnectionState {
  instance: string;
  state: 'open' | 'close' | 'connecting';
}

export interface QRCode {
  code: string;
  base64: string;
}

export interface SendMessageOptions {
  delay?: number;
  presence?: 'composing' | 'recording' | 'available' | 'unavailable';
  quoteMessageById?: string;
  groupMention?: {
    hidden?: boolean;
    everyone?: boolean;
  };
  externalAttributes?: string | object;
  messageId?: string;
}

export interface SendMessageData {
  number: string;
  text?: string;
  media?: {
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string; // base64 or URL
    caption?: string;
    filename?: string;
  };
  options?: SendMessageOptions;
}

export interface WebhookData {
  enabled: boolean;
  url: string;
  events: string[];
  webhook_by_events: boolean;
  webhook_base64: boolean;
}

export interface ContactInfo {
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
}

export interface ChatInfo {
  remoteJid: string;
  name?: string;
  isGroup: boolean;
  isWaContact: boolean;
}

export interface MessageInfo {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message: any;
  messageTimestamp: number;
  status: string;
}

class YumerApiV2Service {
  private baseUrl: string;
  private globalApiKey: string;

  constructor(baseUrl = 'https://api.yumer.com.br', globalApiKey?: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.globalApiKey = globalApiKey || '';
    
    // Se não foi fornecida uma API key, tentar buscar do environment
    if (!this.globalApiKey && typeof window !== 'undefined') {
      this.globalApiKey = localStorage.getItem('yumer_global_api_key') || '';
    }
    
    console.log(`[YumerApiV2.2.1] Inicializado com API Key: ${this.globalApiKey ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useInstanceAuth = false,
    instanceName?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // AUTENTICAÇÃO CORRIGIDA - API v2.2.1
    if (this.globalApiKey) {
      // Para API v2.2.1, usar apikey no header conforme documentação
      headers['apikey'] = this.globalApiKey;
      // Manter Authorization Bearer para compatibilidade
      headers['authorization'] = `Bearer ${this.globalApiKey}`;
    } else {
      console.warn('[YumerApiV2.2.1] ⚠️ API Key não configurada!');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    console.log(`[YumerApiV2.2.1] ${options.method || 'GET'} ${url}`, {
      headers: { ...headers, apikey: (headers as any).apikey ? '***' : undefined },
      body: options.body
    });

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[YumerApiV2.2.1] Error ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[YumerApiV2.2.1] Response:`, data);
    return data;
  }

  // ==================== SERVER HEALTH CHECK ====================
  
  /**
   * Verifica se o servidor está online usando endpoint /docs
   */
  async checkServerHealth(): Promise<{ status: string; version: string; timestamp: string }> {
    try {
      // Usar endpoint /docs que sabemos que existe e retorna 200
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      });
      
      if (response.ok) {
        return {
          status: 'online',
          version: 'v2.2.1',
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[YumerApiV2.2.1] Health check failed:', error);
      throw new Error('Server offline or unreachable');
    }
  }

  // ==================== AUTHENTICATION ====================
  
  /**
   * Cria uma nova API Key
   */
  async createApiKey(name: string): Promise<ApiKey> {
    return this.makeRequest<ApiKey>('/api/v2/manager/createApikey', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  /**
   * Lista todas as API Keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    return this.makeRequest<ApiKey[]>('/api/v2/manager/findApikey');
  }

  /**
   * Remove uma API Key
   */
  async deleteApiKey(apikey: string): Promise<{ message: string }> {
    return this.makeRequest(`/api/v2/manager/deleteApikey/${apikey}`, {
      method: 'DELETE'
    });
  }

  // ==================== BUSINESS MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os businesses
   */
  async listBusinesses(): Promise<Business[]> {
    return this.makeRequest<Business[]>('/api/v2/admin/business');
  }

  /**
   * Cria um novo business
   */
  async createBusiness(businessData: {
    name: string;
    email: string;
    phone: string;
    slug: string;
    country?: string;
    timezone?: string;
    language?: string;
  }): Promise<Business> {
    return this.makeRequest<Business>('/api/v2/admin/business', {
      method: 'POST',
      body: JSON.stringify({
        ...businessData,
        country: businessData.country || 'BR',
        timezone: businessData.timezone || 'America/Sao_Paulo',
        language: businessData.language || 'pt-BR'
      })
    });
  }

  /**
   * Obtém um business específico
   */
  async getBusiness(businessId: string): Promise<Business> {
    return this.makeRequest<Business>(`/api/v2/admin/business/${businessId}`);
  }

  /**
   * Atualiza um business
   */
  async updateBusiness(businessId: string, updates: Partial<Business>): Promise<Business> {
    return this.makeRequest<Business>(`/api/v2/admin/business/${businessId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Remove um business
   */
  async deleteBusiness(businessId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/admin/business/${businessId}`, {
      method: 'DELETE'
    });
  }

  // ==================== INSTANCE MANAGEMENT (v2.2.1) ====================

  /**
   * Lista instâncias de um business
   */
  async listBusinessInstances(businessId: string): Promise<Instance[]> {
    return this.makeRequest<Instance[]>(`/api/v2/business/${businessId}/instance`, {}, true);
  }

  /**
   * Cria uma nova instância em um business
   */
  async createBusinessInstance(businessId: string, instanceData: {
    instanceName: string;
    token?: string;
    qrcode?: boolean;
    number?: string;
  }): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      body: JSON.stringify(instanceData)
    }, true);
  }

  /**
   * Obtém uma instância específica
   */
  async getInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/instance/${instanceId}`, {}, true, instanceId);
  }

  /**
   * Conecta uma instância
   */
  async connectInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/instance/${instanceId}/connect`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Reinicia uma instância
   */
  async restartInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/instance/${instanceId}/restart`, {
      method: 'PUT'
    }, true, instanceId);
  }

  /**
   * Desconecta uma instância
   */
  async logoutInstance(instanceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/instance/${instanceId}/logout`, {
      method: 'DELETE'
    }, true, instanceId);
  }

  /**
   * Remove uma instância
   */
  async deleteInstance(instanceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/instance/${instanceId}`, {
      method: 'DELETE'
    }, true, instanceId);
  }

  // ==================== CONNECTION STATUS (v2.2.1) ====================

  /**
   * Obtém status da conexão de uma instância
   */
  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    return this.makeRequest<ConnectionState>(`/api/v2/instance/${instanceId}/connection-state`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Obtém QR Code para conexão via endpoint /connect
   */
  async getQRCode(instanceId: string): Promise<{ code: string; base64: string }> {
    console.log('🔍 [YUMER-QR] Buscando QR code para instância:', instanceId);
    const result = await this.makeRequest<{ code: string; base64: string }>(`/api/v2/instance/${instanceId}/connect`, {
      method: 'GET'
    }, true, instanceId);
    
    console.log('🔍 [YUMER-QR] Resposta da API:', {
      result,
      hasBase64: !!result?.base64,
      base64Length: result?.base64?.length,
      base64Start: result?.base64?.substring(0, 50),
      hasCode: !!result?.code,
    });
    
    return result;
  }

  // ==================== WEBHOOK MANAGEMENT (v2.2.1) ====================

  /**
   * Configura webhook para instância
   */
  async setWebhook(instanceId: string, webhookData: WebhookData): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/webhook/set/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify(webhookData)
    }, true, instanceId);
  }

  /**
   * Obtém configuração do webhook
   */
  async getWebhook(instanceId: string): Promise<WebhookData> {
    return this.makeRequest<WebhookData>(`/api/v2/webhook/find/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  // ==================== MESSAGE SENDING (v2.2.1) ====================

  /**
   * Helper para preparar opções de mensagem
   */
  private prepareMessageOptions(customOptions?: Partial<SendMessageOptions>): SendMessageOptions {
    const defaultOptions: SendMessageOptions = {
      delay: 1200,
      presence: "composing"
    };

    const mergedOptions = { ...defaultOptions, ...customOptions };

    // Converter externalAttributes para string se for objeto
    if (mergedOptions.externalAttributes && typeof mergedOptions.externalAttributes === 'object') {
      mergedOptions.externalAttributes = JSON.stringify(mergedOptions.externalAttributes);
    }

    return mergedOptions;
  }

  /**
   * Envia mensagem de texto com suporte completo a opções
   */
  async sendText(instanceId: string, number: string, text: string, options?: Partial<SendMessageOptions>): Promise<MessageInfo> {
    const messageOptions = this.prepareMessageOptions(options);
    
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        textMessage: {
          text: text
        },
        options: messageOptions
      })
    }, true, instanceId);
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento) com suporte completo a opções
   */
  async sendMedia(instanceId: string, data: SendMessageData): Promise<MessageInfo> {
    const messageOptions = this.prepareMessageOptions(data.options);
    
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/media`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: data.number,
        mediaMessage: {
          mediatype: data.media?.mediatype,
          url: data.media?.media,
          caption: data.media?.caption,
          fileName: data.media?.filename
        },
        options: messageOptions
      })
    }, true, instanceId);
  }

  /**
   * Envia áudio WhatsApp (formato .ogg ou .oga) com suporte completo a opções
   */
  async sendWhatsAppAudio(instanceId: string, number: string, audioUrl: string, options?: Partial<SendMessageOptions>): Promise<MessageInfo> {
    const messageOptions = this.prepareMessageOptions({
      ...options,
      presence: "recording" // Força presence de recording para áudios
    });
    
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/audio`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        audioMessage: {
          url: audioUrl
        },
        options: messageOptions
      })
    }, true, instanceId);
  }

  /**
   * Envia localização
   */
  async sendLocation(instanceId: string, number: string, latitude: number, longitude: number, name?: string, address?: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/location`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        locationMessage: {
          latitude,
          longitude,
          name: name || 'Localização',
          address: address || ''
        },
        options: {
          delay: 1200,
          presence: "composing"
        }
      })
    }, true, instanceId);
  }

  /**
   * Envia botões interativos
   */
  async sendButtons(instanceId: string, number: string, title: string, description: string, buttons: Array<{type: string, displayText: string, id: string}>): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/buttons`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        buttonsMessage: {
          title,
          description,
          buttons
        },
        options: {
          delay: 1200,
          presence: "composing"
        }
      })
    }, true, instanceId);
  }

  /**
   * Envia lista interativa
   */
  async sendList(instanceId: string, number: string, title: string, description: string, sections: Array<{buttonText: string, list: Array<{title: string, rows: Array<{title: string, description?: string, id?: string}>}>}>): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/list`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        listMessage: {
          title,
          description,
          sections
        },
        options: {
          delay: 1200,
          presence: "composing"
        }
      })
    }, true, instanceId);
  }

  /**
   * Envia reação a mensagem
   */
  async sendReaction(instanceId: string, messageId: string, emoji: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/reaction?message=${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        reactionMessage: {
          reaction: emoji
        }
      })
    }, true, instanceId);
  }

  // ==================== CHAT MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os chats
   */
  async findChats(instanceId: string): Promise<ChatInfo[]> {
    return this.makeRequest<ChatInfo[]>(`/api/v2/chat/findChats/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Busca mensagens de um chat
   */
  async findMessages(instanceId: string, remoteJid: string, limit = 20): Promise<MessageInfo[]> {
    return this.makeRequest<MessageInfo[]>(`/api/v2/chat/findMessages/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ remoteJid, limit })
    }, true, instanceId);
  }

  // ==================== CONTACT MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os contatos
   */
  async findContacts(instanceId: string): Promise<ContactInfo[]> {
    return this.makeRequest<ContactInfo[]>(`/api/v2/chat/findContacts/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Obtém foto do perfil de um contato
   */
  async getProfilePic(instanceId: string, number: string): Promise<{ profilePicUrl: string }> {
    return this.makeRequest<{ profilePicUrl: string }>(`/api/v2/chat/getProfilePic/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ number })
    }, true, instanceId);
  }

  // ==================== INSTANCE SETTINGS (v2.2.1) ====================

  /**
   * Define foto do perfil da instância
   */
  async setProfilePic(instanceId: string, picture: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/chat/setProfilePic/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ picture })
    }, true, instanceId);
  }

  /**
   * Define nome do perfil da instância
   */
  async setProfileName(instanceId: string, name: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/chat/setProfileName/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    }, true, instanceId);
  }

  // ==================== LEGACY COMPATIBILITY METHODS ====================

  /**
   * @deprecated Use listBusinessInstances instead - Este método não funciona na v2.2.1
   */
  async listInstances(): Promise<Instance[]> {
    console.warn('[YumerApiV2.2.1] listInstances() is deprecated and not available in v2.2.1');
    console.warn('[YumerApiV2.2.1] Use listBusinessInstances(businessId) instead');
    // Retornar array vazio para manter compatibilidade
    return [];
  }

  /**
   * @deprecated Use createBusinessInstance instead - Este método não funciona na v2.2.1
   */
  async createInstance(instanceName: string, token?: string, qrcode = true, number?: string): Promise<Instance> {
    console.warn('[YumerApiV2.2.1] createInstance() is deprecated and not available in v2.2.1');
    console.warn('[YumerApiV2.2.1] Use createBusinessInstance(businessId, instanceData) instead');
    throw new Error('createInstance is deprecated in v2.2.1. Use createBusinessInstance(businessId, instanceData) instead');
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Configura a API Key global
   */
  setGlobalApiKey(apiKey: string): void {
    this.globalApiKey = apiKey;
    console.log(`[YumerApiV2.2.1] ✅ API Key configurada: ${apiKey ? 'Sim' : 'Não'}`);
    
    // Salvar no localStorage para persistência
    if (typeof window !== 'undefined' && apiKey) {
      localStorage.setItem('yumer_global_api_key', apiKey);
    }
  }

  /**
   * Configura a URL base da API
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  /**
   * Obtém configurações atuais
   */
  getConfig(): { baseUrl: string; hasApiKey: boolean; version: string } {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.globalApiKey,
      version: 'v2.2.1'
    };
  }
}

// Singleton instance com configuração automática da API key
export const yumerApiV2 = new YumerApiV2Service();

// Configurar API key padrão na inicialização
if (typeof window !== 'undefined') {
  // Tentar pegar API key do localStorage primeiro
  const storedApiKey = localStorage.getItem('yumer_global_api_key');
  if (storedApiKey) {
    yumerApiV2.setGlobalApiKey(storedApiKey);
  } else {
    // Se não houver API key salva, usar a padrão do environment
    import('@/config/environment').then(({ auth }) => {
      if (auth.adminToken) {
        yumerApiV2.setGlobalApiKey(auth.adminToken);
        console.log('[YumerApiV2.2.1] 🔑 Usando API Key padrão do environment');
      }
    });
  }
}

export default yumerApiV2;
