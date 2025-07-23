/**
 * CodeChat API v2.2.1 - Serviço Unificado
 * Baseado na documentação oficial: https://docs.codechat.dev/api/v2.2.1
 */

export interface ApiKey {
  name: string;
  key: string;
}

export interface Instance {
  instanceName: string;
  owner: string;
  profileName?: string;
  profilePicUrl?: string;
  status?: string;
  serverUrl?: string;
  apikey?: string;
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

    console.log(`[YumerApiV2] ${options.method || 'GET'} ${url}`, {
      headers: { ...headers, apikey: (headers as any).apikey ? '***' : undefined },
      body: options.body
    });

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[YumerApiV2] Error ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[YumerApiV2] Response:`, data);
    return data;
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

  // ==================== INSTANCE MANAGEMENT ====================

  /**
   * Cria uma nova instância
   */
  async createInstance(instanceName: string, token?: string, qrcode = true, number?: string): Promise<Instance> {
    const body: any = {
      instanceName,
      qrcode
    };
    
    if (token) body.token = token;
    if (number) body.number = number;

    return this.makeRequest<Instance>('/instance/create', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Lista todas as instâncias
   */
  async listInstances(): Promise<Instance[]> {
    return this.makeRequest<Instance[]>('/instance/fetchInstances');
  }

  /**
   * Conecta uma instância
   */
  async connectInstance(instanceName: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/instance/connect/${instanceName}`, {
      method: 'GET'
    }, true, instanceName);
  }

  /**
   * Reinicia uma instância
   */
  async restartInstance(instanceName: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/instance/restart/${instanceName}`, {
      method: 'PUT'
    }, true, instanceName);
  }

  /**
   * Desconecta uma instância
   */
  async logoutInstance(instanceName: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/instance/logout/${instanceName}`, {
      method: 'DELETE'
    }, true, instanceName);
  }

  /**
   * Remove uma instância
   */
  async deleteInstance(instanceName: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    }, true, instanceName);
  }

  // ==================== CONNECTION STATUS ====================

  /**
   * Obtém status da conexão
   */
  async getConnectionState(instanceName: string): Promise<ConnectionState> {
    return this.makeRequest<ConnectionState>(`/instance/connectionState/${instanceName}`, {
      method: 'GET'
    }, true, instanceName);
  }

  /**
   * Obtém QR Code para conexão
   */
  async getQRCode(instanceName: string): Promise<QRCode> {
    return this.makeRequest<QRCode>(`/instance/qrcode/${instanceName}`, {
      method: 'GET'
    }, true, instanceName);
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Configura webhook para instância
   */
  async setWebhook(instanceName: string, webhookData: WebhookData): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(webhookData)
    }, true, instanceName);
  }

  /**
   * Obtém configuração do webhook
   */
  async getWebhook(instanceName: string): Promise<WebhookData> {
    return this.makeRequest<WebhookData>(`/webhook/find/${instanceName}`, {
      method: 'GET'
    }, true, instanceName);
  }

  // ==================== MESSAGE SENDING ====================

  /**
   * Envia mensagem de texto
   */
  async sendText(instanceName: string, number: string, text: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number, text })
    }, true, instanceName);
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento)
   */
  async sendMedia(instanceName: string, data: SendMessageData): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(data)
    }, true, instanceName);
  }

  /**
   * Envia áudio
   */
  async sendWhatsAppAudio(instanceName: string, number: string, audioBase64: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/message/sendWhatsAppAudio/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number,
        media: {
          mediatype: 'audio',
          media: audioBase64
        }
      })
    }, true, instanceName);
  }

  // ==================== CHAT MANAGEMENT ====================

  /**
   * Lista todos os chats
   */
  async findChats(instanceName: string): Promise<ChatInfo[]> {
    return this.makeRequest<ChatInfo[]>(`/chat/findChats/${instanceName}`, {
      method: 'GET'
    }, true, instanceName);
  }

  /**
   * Busca mensagens de um chat
   */
  async findMessages(instanceName: string, remoteJid: string, limit = 20): Promise<MessageInfo[]> {
    return this.makeRequest<MessageInfo[]>(`/chat/findMessages/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ remoteJid, limit })
    }, true, instanceName);
  }

  // ==================== CONTACT MANAGEMENT ====================

  /**
   * Lista todos os contatos
   */
  async findContacts(instanceName: string): Promise<ContactInfo[]> {
    return this.makeRequest<ContactInfo[]>(`/chat/findContacts/${instanceName}`, {
      method: 'GET'
    }, true, instanceName);
  }

  /**
   * Obtém foto do perfil de um contato
   */
  async getProfilePic(instanceName: string, number: string): Promise<{ profilePicUrl: string }> {
    return this.makeRequest<{ profilePicUrl: string }>(`/chat/getProfilePic/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number })
    }, true, instanceName);
  }

  // ==================== INSTANCE SETTINGS ====================

  /**
   * Define foto do perfil da instância
   */
  async setProfilePic(instanceName: string, picture: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/chat/setProfilePic/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ picture })
    }, true, instanceName);
  }

  /**
   * Define nome do perfil da instância
   */
  async setProfileName(instanceName: string, name: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/chat/setProfileName/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    }, true, instanceName);
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
  getConfig(): { baseUrl: string; hasApiKey: boolean } {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.globalApiKey
    };
  }
}

// Singleton instance
export const yumerApiV2 = new YumerApiV2Service();
export default yumerApiV2;