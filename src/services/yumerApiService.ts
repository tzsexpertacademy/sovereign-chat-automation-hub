
import { serverConfigService } from './serverConfigService';

// ============ TIPOS CORRETOS BASEADOS NA DOCUMENTAÇÃO OFICIAL ============

// Admin Controller Types
export interface AdminBusinessCreateRequest {
  name: string;
  attributes?: any;
}

export interface AdminBusinessCreateResponse {
  businessId: string;
  name: string;
  businessToken: string;
  attributes: object;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface AdminBusinessFindResponse extends AdminBusinessCreateResponse {
  BusinessWebhook?: BusinessWebhook;
}

export interface BusinessWebhook {
  webhookId: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBusinessUpdateRequest {
  name?: string;
  attributes?: any;
}

export interface AdminOldTokenRequest {
  oldToken: string;
}

export interface AdminNewTokenResponse {
  newToken: string;
}

export interface AdminMoveInstanceRequest {
  sourceInstanceId: string;
  businessIdTarget: string;
}

// Business Controller Types
export interface BusinessInstanceCreateRequest {
  instanceName?: string;
  externalId?: string;
}

export interface BusinessAuth {
  authId: string;
  jwt: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BusinessInstanceCreateResponse {
  instanceId: string;
  name: string;
  state: 'active' | 'inactive';
  connection: 'open' | 'close' | 'refused';
  createdAt: string;
  deletedAt?: string;
  businessBusinessId: string;
  Auth: BusinessAuth;
}

export interface BusinessInstancesConnectedResponse {
  businessId: string;
  name: string;
  Instances: BusinessInstanceCreateResponse[];
}

// Instance Controller Types
export interface InstanceConnectResponse {
  base64: string;
  code: string;
}

export interface InstanceConnectionStateResponse {
  state: 'open' | 'connecting' | 'close' | 'refused';
  statusReason: number;
}

export interface InstanceFindResponse extends BusinessInstanceCreateResponse {
  WhatsApp?: WhatsAppResponse;
  Webhook?: WebhookResponse[];
  Business?: IBusinessResponse;
}

export interface WhatsAppResponse {
  whatsappId: string;
  remoteJid: string;
  pictureUrl: string;
  pushName: string;
  createdAt: string;
  instanceInstanceId: string;
}

export interface IBusinessResponse {
  businessId: string;
  name: string;
}

// Webhook Controller Types
export interface WebhookSetRequest {
  enabled: boolean;
  url: string;
  events: WebhookEvents;
  headers?: Record<string, string>;
}

export interface WebhookEvents {
  qrcodeUpdated?: boolean;
  messagesSet?: boolean;
  messagesUpsert?: boolean;
  messagesUpdated?: boolean;
  sendMessage?: boolean;
  contactsSet?: boolean;
  contactsUpsert?: boolean;
  contactsUpdated?: boolean;
  chatsSet?: boolean;
  chatsUpsert?: boolean;
  chatsUpdated?: boolean;
  chatsDeleted?: boolean;
  presenceUpdated?: boolean;
  groupsUpsert?: boolean;
  groupsUpdated?: boolean;
  groupsParticipantsUpdated?: boolean;
  connectionUpdated?: boolean;
  statusInstance?: boolean;
  refreshToken?: boolean;
}

export interface WebhookResponse {
  id: number;
  url: string;
  enabled: boolean;
  events: WebhookEvents;
  createdAt: string;
  updatedAt: string;
}

// Send Message Types
export interface SendTextMessageRequest {
  number: string;
  options?: {
    externalAttributes?: any;
    delay?: number;
    presence?: 'composing' | 'recording' | 'paused';
    quotedMessageId?: number;
  };
  textMessage: {
    text: string;
  };
}

export interface SendMediaMessageRequest {
  number: string;
  options?: {
    externalAttributes?: any;
    delay?: number;
    presence?: 'composing' | 'recording' | 'paused';
    quotedMessageId?: number;
  };
  mediaMessage: {
    mediatype: 'image' | 'document' | 'video' | 'audio';
    fileName?: string;
    caption?: string;
    media: string; // URL
  };
}

export interface MessageResponse {
  id: number;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  keyParticipant: string;
  pushName: string;
  messageType: string;
  content: any;
  messageTimestamp: number;
  instanceId: number;
  device: string;
  isGroup?: boolean;
}

// Chat Controller Types
export interface WhatsAppNumbersRequest {
  numbers: string[];
}

export interface WhatsAppNumbersResponse {
  jid: string;
  exists: boolean;
}

// Error Response Types
export interface ApiErrorResponse {
  message: string[] | object;
  error: string;
  statusCode: number;
}

// ============ SERVICE PRINCIPAL ============
class YumerApiService {
  private config = serverConfigService.getConfig();
  
  private getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.adminToken}`,
      'apikey': this.config.globalApiKey
    };
  }

  private getBusinessHeaders(businessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`,
      'apikey': this.config.globalApiKey
    };
  }

  private getInstanceHeaders(instanceJWT: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${instanceJWT}`,
      'apikey': this.config.globalApiKey
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.serverUrl}${endpoint}`;
    
    try {
      console.log(`🔥 [YUMER-API] ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.config.requestTimeout)
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json().catch(() => ({
          message: ['Request failed'],
          error: 'Unknown error',
          statusCode: response.status
        }));
        
        console.error(`❌ [YUMER-API] Error ${response.status}:`, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Request failed'}`);
      }

      const data = await response.json();
      console.log(`✅ [YUMER-API] Success:`, data);
      return data;

    } catch (error: any) {
      console.error(`❌ [YUMER-API] Request failed:`, error);
      throw error;
    }
  }

  // ============ ADMIN CONTROLLER ============
  async createBusiness(data: AdminBusinessCreateRequest): Promise<AdminBusinessCreateResponse> {
    return this.makeRequest('/api/v2/admin/business', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(data)
    });
  }

  async getAllBusinesses(): Promise<AdminBusinessFindResponse[]> {
    return this.makeRequest('/api/v2/admin/business', {
      headers: this.getAdminHeaders()
    });
  }

  async getBusinessById(businessId: string): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      headers: this.getAdminHeaders()
    });
  }

  async updateBusiness(businessId: string, data: AdminBusinessUpdateRequest): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      method: 'PUT',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(data)
    });
  }

  async refreshBusinessToken(businessId: string, data: AdminOldTokenRequest): Promise<AdminNewTokenResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}/refresh-token`, {
      method: 'PATCH',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(data)
    });
  }

  async moveInstance(data: AdminMoveInstanceRequest): Promise<AdminBusinessCreateResponse> {
    return this.makeRequest('/api/v2/admin/business/move-instance', {
      method: 'PATCH',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(data)
    });
  }

  async deleteBusiness(businessId: string, force?: boolean): Promise<AdminBusinessCreateResponse> {
    const params = force ? '?force=true' : '';
    return this.makeRequest(`/api/v2/admin/business/${businessId}${params}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders()
    });
  }

  // ============ BUSINESS CONTROLLER ============
  async getBusinessInfo(businessId: string, businessToken: string): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}`, {
      headers: this.getBusinessHeaders(businessToken)
    });
  }

  async updateBusinessInfo(businessId: string, data: AdminBusinessUpdateRequest, businessToken: string): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}`, {
      method: 'PUT',
      headers: this.getBusinessHeaders(businessToken),
      body: JSON.stringify(data)
    });
  }

  async createBusinessInstance(businessId: string, data: BusinessInstanceCreateRequest, businessToken: string): Promise<BusinessInstanceCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      headers: this.getBusinessHeaders(businessToken),
      body: JSON.stringify(data)
    });
  }

  async deleteBusinessInstance(businessId: string, businessToken: string): Promise<void> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance`, {
      method: 'DELETE',
      headers: this.getBusinessHeaders(businessToken)
    });
  }

  async getConnectedInstances(businessId: string, businessToken: string): Promise<BusinessInstancesConnectedResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/connected`, {
      headers: this.getBusinessHeaders(businessToken)
    });
  }

  // ============ INSTANCE CONTROLLER ============
  async getInstance(instanceId: string, instanceJWT: string): Promise<InstanceFindResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  async connectInstance(instanceId: string, instanceJWT: string): Promise<InstanceConnectResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/connect`, {
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  async getConnectionState(instanceId: string, instanceJWT: string): Promise<InstanceConnectionStateResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/connection-state`, {
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  async reloadInstance(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/reload`, {
      method: 'PATCH',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  async logoutInstance(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/logout`, {
      method: 'DELETE',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  async getQRCode(instanceId: string, instanceJWT: string): Promise<InstanceConnectResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/qrcode`, {
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // ============ WEBHOOK CONTROLLER ============ 
  async setWebhook(instanceId: string, data: WebhookSetRequest, instanceJWT: string): Promise<WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      method: 'PUT',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(data)
    });
  }

  async findWebhook(instanceId: string, instanceJWT: string): Promise<WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // ============ SEND MESSAGE CONTROLLER ============
  async sendTextMessage(instanceId: string, data: SendTextMessageRequest, instanceJWT: string): Promise<MessageResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(data)
    });
  }

  async sendMediaMessage(instanceId: string, data: SendMediaMessageRequest, instanceJWT: string): Promise<MessageResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/media`, {
      method: 'POST',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(data)
    });
  }

  // ============ CHAT CONTROLLER ============
  async validateWhatsAppNumbers(instanceId: string, data: WhatsAppNumbersRequest, instanceJWT: string): Promise<WhatsAppNumbersResponse[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/validate-numbers`, {
      method: 'POST',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(data)
    });
  }

  async markAsRead(instanceId: string, messageIds: string[], instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/mark-as-read`, {
      method: 'PATCH',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify({ messageIds })
    });
  }

  async archiveChat(instanceId: string, chatId: string, archive: boolean, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/${chatId}/archive`, {
      method: 'PATCH',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify({ archive })
    });
  }

  async deleteMessage(instanceId: string, messageId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/delete/message/${messageId}`, {
      method: 'DELETE',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // ============ MÉTODOS DE COMPATIBILIDADE ============
  // Manter compatibilidade com código existente
  async configureWebhook(instanceId: string, config?: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const webhookConfig: WebhookSetRequest = {
        enabled: true,
        url: this.config.adminWebhooks?.messageWebhook?.url || '',
        events: {
          qrcodeUpdated: true,
          messagesUpsert: true,
          messagesUpdated: true,
          sendMessage: true,
          contactsUpsert: true,
          chatsUpsert: true,
          chatsUpdated: true,
          connectionUpdated: true,
          statusInstance: true,
          refreshToken: true
        },
        ...config
      };

      // Usar instanceJWT padrão se disponível
      const instanceJWT = this.config.globalApiKey; // Temporário até implementar JWT correto
      const data = await this.setWebhook(instanceId, webhookConfig, instanceJWT);
      
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const instanceJWT = this.config.globalApiKey; // Temporário até implementar JWT correto
      const data = await this.findWebhook(instanceId, instanceJWT);
      
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const instanceJWT = this.config.globalApiKey; // Temporário até implementar JWT correto
      const messageData: SendTextMessageRequest = {
        number: chatId,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: message
        }
      };

      const data = await this.sendTextMessage(instanceId, messageData, instanceJWT);
      
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async testConnection(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const instanceJWT = this.config.globalApiKey; // Temporário até implementar JWT correto
      await this.getConnectionState(instanceId, instanceJWT);
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Métodos vazios para compatibilidade
  async ensureWebhookConfigured(instanceId: string): Promise<{ success: boolean; error?: string }> {
    return this.configureWebhook(instanceId);
  }

  async getChats(instanceId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return { success: false, error: 'Not implemented in v2 API' };
  }

  async getChatMessages(instanceId: string, chatId: string, options?: any): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return { success: false, error: 'Not implemented in v2 API' };
  }
}

// Instância única do service
export const yumerApiService = new YumerApiService();

// Export compatível com código existente
export const yumerWhatsappService = {
  configureWebhook: (instanceId: string, config?: any) => yumerApiService.configureWebhook(instanceId, config),
  getWebhookConfig: (instanceId: string) => yumerApiService.getWebhookConfig(instanceId),
  getChats: (instanceId: string) => yumerApiService.getChats(instanceId),
  getChatMessages: (instanceId: string, chatId: string, options?: any) => yumerApiService.getChatMessages(instanceId, chatId, options),
  sendMessage: (instanceId: string, chatId: string, message: string) => yumerApiService.sendMessage(instanceId, chatId, message),
  ensureWebhookConfigured: (instanceId: string) => yumerApiService.ensureWebhookConfigured(instanceId),
  testConnection: (instanceId: string) => yumerApiService.testConnection(instanceId)
};

export default yumerApiService;
