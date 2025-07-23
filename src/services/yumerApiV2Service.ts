
import { serverConfigService } from './serverConfigService';

// Tipos oficiais da API Yumer v2 baseados na documentação
export interface YumerV2Instance {
  instanceName: string;
  status: 'open' | 'connecting' | 'close';
  serverUrl: string;
  apikey: string;
  owner: string;
  profilePicUrl?: string;
}

export interface YumerV2Business {
  businessId: string;
  name: string;
  email: string;
  phone: string;
  description?: string;
  category?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface YumerV2Message {
  id: string;
  from: string;
  to: string;
  body: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  timestamp: number;
  fromMe: boolean;
}

export interface YumerV2Chat {
  id: string;
  name?: string;
  isGroup: boolean;
  participants?: string[];
  lastMessage?: YumerV2Message;
  unreadCount: number;
}

export interface YumerV2Webhook {
  enabled: boolean;
  url: string;
  events: string[];
  headers?: Record<string, string>;
}

export interface YumerV2SendMessageRequest {
  number: string;
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording';
  };
  textMessage?: {
    text: string;
  };
  mediaMessage?: {
    mediatype: 'image' | 'audio' | 'video' | 'document';
    media: string; // base64 ou URL
    caption?: string;
  };
}

export interface YumerV2ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Serviço oficial da API Yumer v2
 * Baseado na documentação: https://api.yumer.com.br/docs
 */
class YumerApiV2Service {
  private config = serverConfigService.getConfig();
  
  private getHeaders(requiresAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Yumer-Frontend/2.1.3'
    };

    if (requiresAuth) {
      headers['Authorization'] = `Bearer ${this.config.adminToken}`;
      headers['apikey'] = this.config.globalApiKey;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}, 
    requiresAuth: boolean = true
  ): Promise<YumerV2ApiResponse<T>> {
    const url = `${this.config.serverUrl}${this.config.basePath}${endpoint}`;
    
    try {
      console.log(`🌐 [YUMER-V2] ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(requiresAuth),
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.requestTimeout)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ [YUMER-V2] HTTP ${response.status}:`, errorText);
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json();
      console.log(`✅ [YUMER-V2] Response:`, data);
      
      return {
        success: true,
        data
      };
    } catch (error: any) {
      console.error(`❌ [YUMER-V2] Request failed for ${endpoint}:`, error);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  // ===== ADMIN ENDPOINTS =====
  async getHealth(): Promise<YumerV2ApiResponse> {
    return this.makeRequest('/health', { method: 'GET' }, false);
  }

  async getServerInfo(): Promise<YumerV2ApiResponse> {
    return this.makeRequest('/info', { method: 'GET' }, false);
  }

  // ===== BUSINESS ENDPOINTS =====
  async listBusinesses(): Promise<YumerV2ApiResponse<YumerV2Business[]>> {
    return this.makeRequest('/business', { method: 'GET' });
  }

  async createBusiness(business: Partial<YumerV2Business>): Promise<YumerV2ApiResponse<YumerV2Business>> {
    return this.makeRequest('/business', {
      method: 'POST',
      body: JSON.stringify(business)
    });
  }

  async getBusiness(businessId: string): Promise<YumerV2ApiResponse<YumerV2Business>> {
    return this.makeRequest(`/business/${businessId}`, { method: 'GET' });
  }

  async updateBusiness(businessId: string, updates: Partial<YumerV2Business>): Promise<YumerV2ApiResponse<YumerV2Business>> {
    return this.makeRequest(`/business/${businessId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteBusiness(businessId: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/business/${businessId}`, { method: 'DELETE' });
  }

  // ===== INSTANCE ENDPOINTS =====
  async listInstances(): Promise<YumerV2ApiResponse<YumerV2Instance[]>> {
    return this.makeRequest('/instance', { method: 'GET' });
  }

  async createInstance(instanceName: string): Promise<YumerV2ApiResponse<YumerV2Instance>> {
    return this.makeRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        token: this.config.adminToken
      })
    });
  }

  async connectInstance(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/instance/connect/${instanceName}`, { method: 'POST' });
  }

  async disconnectInstance(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/instance/logout/${instanceName}`, { method: 'DELETE' });
  }

  async deleteInstance(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/instance/delete/${instanceName}`, { method: 'DELETE' });
  }

  async getInstanceStatus(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/instance/connectionState/${instanceName}`, { method: 'GET' });
  }

  async fetchQRCode(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/instance/fetchInstances/${instanceName}`, { method: 'GET' });
  }

  // ===== WEBHOOK ENDPOINTS =====
  async getWebhookConfig(instanceName: string): Promise<YumerV2ApiResponse<YumerV2Webhook>> {
    return this.makeRequest(`/webhook/find/${instanceName}`, { method: 'GET' });
  }

  async setWebhook(instanceName: string, webhook: YumerV2Webhook): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/webhook/set/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify(webhook)
    });
  }

  // ===== MESSAGE ENDPOINTS =====
  async sendTextMessage(instanceName: string, request: YumerV2SendMessageRequest): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async sendMediaMessage(instanceName: string, request: YumerV2SendMessageRequest): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async sendAudioMessage(instanceName: string, request: YumerV2SendMessageRequest): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/message/sendWhatsAppAudio/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // ===== CHAT ENDPOINTS =====
  async findChats(instanceName: string): Promise<YumerV2ApiResponse<YumerV2Chat[]>> {
    return this.makeRequest(`/chat/findChats/${instanceName}`, { method: 'GET' });
  }

  async findMessages(instanceName: string, filters?: any): Promise<YumerV2ApiResponse<YumerV2Message[]>> {
    return this.makeRequest(`/chat/findMessages/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(filters || {})
    });
  }

  // ===== UTILITY METHODS =====
  async testConnection(): Promise<YumerV2ApiResponse> {
    console.log('🔍 [YUMER-V2] Testando conexão completa...');
    
    // Testar health primeiro
    const healthResult = await this.getHealth();
    if (!healthResult.success) {
      return {
        success: false,
        error: `Health check failed: ${healthResult.error}`
      };
    }

    // Testar autenticação com lista de businesses
    const businessResult = await this.listBusinesses();
    if (!businessResult.success) {
      return {
        success: false,
        error: `Authentication failed: ${businessResult.error}`
      };
    }

    return {
      success: true,
      data: {
        health: healthResult.data,
        businesses: businessResult.data
      }
    };
  }

  async configureWebhookForInstance(instanceName: string): Promise<YumerV2ApiResponse> {
    const webhookConfig: YumerV2Webhook = {
      enabled: true,
      url: this.config.adminWebhooks.messageWebhook.url,
      events: [
        'qrcodeUpdated',
        'messagesUpsert',
        'messagesUpdated', 
        'sendMessage',
        'contactsUpsert',
        'chatsUpsert',
        'connectionUpdated',
        'statusInstance'
      ],
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.supabaseAnonKey}`
      }
    };

    console.log(`🔧 [YUMER-V2] Configurando webhook para ${instanceName}:`, webhookConfig);
    
    return this.setWebhook(instanceName, webhookConfig);
  }

  // ===== INTEGRATION HELPERS =====
  async createAndConfigureInstance(instanceName: string): Promise<YumerV2ApiResponse> {
    console.log(`🚀 [YUMER-V2] Criando e configurando instância: ${instanceName}`);
    
    try {
      // 1. Criar instância
      const createResult = await this.createInstance(instanceName);
      if (!createResult.success) {
        return createResult;
      }

      // 2. Configurar webhook
      const webhookResult = await this.configureWebhookForInstance(instanceName);
      if (!webhookResult.success) {
        console.warn(`⚠️ [YUMER-V2] Webhook não configurado para ${instanceName}:`, webhookResult.error);
      }

      return {
        success: true,
        data: {
          instance: createResult.data,
          webhook: webhookResult.success
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getInstanceWithDetails(instanceName: string): Promise<YumerV2ApiResponse> {
    try {
      const [statusResult, webhookResult] = await Promise.all([
        this.getInstanceStatus(instanceName),
        this.getWebhookConfig(instanceName)
      ]);

      return {
        success: true,
        data: {
          status: statusResult.data,
          webhook: webhookResult.data
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Instância única
export const yumerApiV2Service = new YumerApiV2Service();
export default yumerApiV2Service;
