
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
  qrcode: {
    instance: string;
    code: string;
  };
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
      ...options.headers,
    };

    if (useInstanceAuth && instanceName) {
      headers['apikey'] = this.globalApiKey;
    } else if (!useInstanceAuth) {
      headers['apikey'] = this.globalApiKey;
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
   * Verifica se o servidor está online acessando a documentação
   */
  async checkServerHealth(): Promise<{ status: string; version: string; timestamp: string }> {
    try {
      // Usar endpoint /docs que sabemos que existe
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'GET',
        mode: 'no-cors'
      });
      
      return {
        status: 'online',
        version: 'v2.2.1',
        timestamp: new Date().toISOString()
      };
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
    return this.makeRequest<ApiKey>('/manager/createApikey', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  /**
   * Lista todas as API Keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    return this.makeRequest<ApiKey[]>('/manager/findApikey');
  }

  /**
   * Remove uma API Key
   */
  async deleteApiKey(apikey: string): Promise<{ message: string }> {
    return this.makeRequest(`/manager/deleteApikey/${apikey}`, {
      method: 'DELETE'
    });
  }

  // ==================== BUSINESS MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os businesses
   */
  async listBusinesses(): Promise<Business[]> {
    return this.makeRequest<Business[]>('/business');
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
    return this.makeRequest<Business>('/business', {
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
    return this.makeRequest<Business>(`/business/${businessId}`);
  }

  /**
   * Atualiza um business
   */
  async updateBusiness(businessId: string, updates: Partial<Business>): Promise<Business> {
    return this.makeRequest<Business>(`/business/${businessId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Remove um business
   */
  async deleteBusiness(businessId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/business/${businessId}`, {
      method: 'DELETE'
    });
  }

  // ==================== INSTANCE MANAGEMENT (v2.2.1) ====================

  /**
   * Lista instâncias de um business
   */
  async listBusinessInstances(businessId: string): Promise<Instance[]> {
    return this.makeRequest<Instance[]>(`/business/${businessId}/instance`, {}, true);
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
    return this.makeRequest<Instance>(`/business/${businessId}/instance`, {
      method: 'POST',
      body: JSON.stringify(instanceData)
    }, true);
  }

  /**
   * Obtém uma instância específica
   */
  async getInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/instance/${instanceId}`, {}, true, instanceId);
  }

  /**
   * Conecta uma instância
   */
  async connectInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/instance/${instanceId}/connect`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Reinicia uma instância
   */
  async restartInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/instance/${instanceId}/restart`, {
      method: 'PUT'
    }, true, instanceId);
  }

  /**
   * Desconecta uma instância
   */
  async logoutInstance(instanceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/instance/${instanceId}/logout`, {
      method: 'DELETE'
    }, true, instanceId);
  }

  /**
   * Remove uma instância
   */
  async deleteInstance(instanceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/instance/${instanceId}`, {
      method: 'DELETE'
    }, true, instanceId);
  }

  // ==================== CONNECTION STATUS (v2.2.1) ====================

  /**
   * Obtém status da conexão de uma instância
   */
  async getConnectionState(instanceId: string): Promise<ConnectionState> {
    return this.makeRequest<ConnectionState>(`/instance/${instanceId}/connection-state`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Obtém QR Code para conexão
   */
  async getQRCode(instanceId: string): Promise<QRCode> {
    return this.makeRequest<QRCode>(`/instance/${instanceId}/qrcode`, {
      method: 'GET'
    }, true, instanceId);
  }

  // ==================== WEBHOOK MANAGEMENT (v2.2.1) ====================

  /**
   * Configura webhook para instância
   */
  async setWebhook(instanceId: string, webhookData: WebhookData): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/webhook/set/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify(webhookData)
    }, true, instanceId);
  }

  /**
   * Obtém configuração do webhook
   */
  async getWebhook(instanceId: string): Promise<WebhookData> {
    return this.makeRequest<WebhookData>(`/webhook/find/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  // ==================== MESSAGE SENDING (v2.2.1) ====================

  /**
   * Envia mensagem de texto
   */
  async sendText(instanceId: string, number: string, text: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/message/sendText/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ number, text })
    }, true, instanceId);
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento)
   */
  async sendMedia(instanceId: string, data: SendMessageData): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/message/sendMedia/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    }, true, instanceId);
  }

  /**
   * Envia áudio
   */
  async sendWhatsAppAudio(instanceId: string, number: string, audioBase64: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/message/sendWhatsAppAudio/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({
        number,
        media: {
          mediatype: 'audio',
          media: audioBase64
        }
      })
    }, true, instanceId);
  }

  // ==================== CHAT MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os chats
   */
  async findChats(instanceId: string): Promise<ChatInfo[]> {
    return this.makeRequest<ChatInfo[]>(`/chat/findChats/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Busca mensagens de um chat
   */
  async findMessages(instanceId: string, remoteJid: string, limit = 20): Promise<MessageInfo[]> {
    return this.makeRequest<MessageInfo[]>(`/chat/findMessages/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ remoteJid, limit })
    }, true, instanceId);
  }

  // ==================== CONTACT MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os contatos
   */
  async findContacts(instanceId: string): Promise<ContactInfo[]> {
    return this.makeRequest<ContactInfo[]>(`/chat/findContacts/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Obtém foto do perfil de um contato
   */
  async getProfilePic(instanceId: string, number: string): Promise<{ profilePicUrl: string }> {
    return this.makeRequest<{ profilePicUrl: string }>(`/chat/getProfilePic/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ number })
    }, true, instanceId);
  }

  // ==================== INSTANCE SETTINGS (v2.2.1) ====================

  /**
   * Define foto do perfil da instância
   */
  async setProfilePic(instanceId: string, picture: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/chat/setProfilePic/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ picture })
    }, true, instanceId);
  }

  /**
   * Define nome do perfil da instância
   */
  async setProfileName(instanceId: string, name: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/chat/setProfileName/${instanceId}`, {
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

// Singleton instance
export const yumerApiV2 = new YumerApiV2Service();
export default yumerApiV2;
