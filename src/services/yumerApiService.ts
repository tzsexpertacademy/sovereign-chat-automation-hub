
import { YUMER_CONFIG, getEnvironmentConfig } from '@/config/yumerConfig';

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
  private config = getEnvironmentConfig();
  
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${YUMER_CONFIG.baseUrl}${endpoint}`;
    
    try {
      console.log(`🔥 [YUMER-API] ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(YUMER_CONFIG.timeout)
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
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async getAllBusinesses(): Promise<AdminBusinessFindResponse[]> {
    return this.makeRequest('/api/v2/admin/business', {
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey)
    });
  }

  async getBusinessById(businessId: string): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey)
    });
  }

  async updateBusiness(businessId: string, data: AdminBusinessUpdateRequest): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      method: 'PUT',
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async refreshBusinessToken(businessId: string, data: AdminOldTokenRequest): Promise<AdminNewTokenResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}/refresh-token`, {
      method: 'PATCH',
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async moveInstance(data: AdminMoveInstanceRequest): Promise<AdminBusinessCreateResponse> {
    return this.makeRequest('/api/v2/admin/business/move-instance', {
      method: 'PATCH',
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async deleteBusiness(businessId: string, force?: boolean): Promise<AdminBusinessCreateResponse> {
    const params = force ? '?force=true' : '';
    return this.makeRequest(`/api/v2/admin/business/${businessId}${params}`, {
      method: 'DELETE',
      headers: YUMER_CONFIG.getAdminHeaders(this.config.adminToken, this.config.globalApiKey)
    });
  }

  // ============ BUSINESS CONTROLLER ============
  async getBusinessInfo(businessId: string, businessToken: string): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}`, {
      headers: YUMER_CONFIG.getBusinessHeaders(businessToken, this.config.globalApiKey)
    });
  }

  async updateBusinessInfo(businessId: string, data: AdminBusinessUpdateRequest, businessToken: string): Promise<AdminBusinessFindResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}`, {
      method: 'PUT',
      headers: YUMER_CONFIG.getBusinessHeaders(businessToken, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async createBusinessInstance(businessId: string, data: BusinessInstanceCreateRequest, businessToken: string): Promise<BusinessInstanceCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      headers: YUMER_CONFIG.getBusinessHeaders(businessToken, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async deleteBusinessInstance(businessId: string, businessToken: string): Promise<void> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance`, {
      method: 'DELETE',
      headers: YUMER_CONFIG.getBusinessHeaders(businessToken, this.config.globalApiKey)
    });
  }

  async getConnectedInstances(businessId: string, businessToken: string): Promise<BusinessInstancesConnectedResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/connected`, {
      headers: YUMER_CONFIG.getBusinessHeaders(businessToken, this.config.globalApiKey)
    });
  }

  // ============ INSTANCE CONTROLLER ============
  async getInstance(instanceId: string, instanceJWT: string): Promise<InstanceFindResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  async connectInstance(instanceId: string, instanceJWT: string): Promise<InstanceConnectResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/connect`, {
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  async getConnectionState(instanceId: string, instanceJWT: string): Promise<InstanceConnectionStateResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/connection-state`, {
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  async reloadInstance(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/reload`, {
      method: 'PATCH',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  async logoutInstance(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/logout`, {
      method: 'DELETE',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  async getQRCode(instanceId: string, instanceJWT: string): Promise<InstanceConnectResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/qrcode`, {
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  // ============ WEBHOOK CONTROLLER ============ 
  async setWebhook(instanceId: string, data: WebhookSetRequest, instanceJWT: string): Promise<WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      method: 'PUT',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async findWebhook(instanceId: string, instanceJWT: string): Promise<WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }

  // ============ SEND MESSAGE CONTROLLER ============
  async sendTextMessage(instanceId: string, data: SendTextMessageRequest, instanceJWT: string): Promise<MessageResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async sendMediaMessage(instanceId: string, data: SendMediaMessageRequest, instanceJWT: string): Promise<MessageResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/media`, {
      method: 'POST',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  // ============ CHAT CONTROLLER ============
  async validateWhatsAppNumbers(instanceId: string, data: WhatsAppNumbersRequest, instanceJWT: string): Promise<WhatsAppNumbersResponse[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/validate-numbers`, {
      method: 'POST',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey),
      body: JSON.stringify(data)
    });
  }

  async markAsRead(instanceId: string, messageIds: string[], instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/mark-as-read`, {
      method: 'PATCH',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey),
      body: JSON.stringify({ messageIds })
    });
  }

  async archiveChat(instanceId: string, chatId: string, archive: boolean, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/${chatId}/archive`, {
      method: 'PATCH',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey),
      body: JSON.stringify({ archive })
    });
  }

  async deleteMessage(instanceId: string, messageId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/delete/message/${messageId}`, {
      method: 'DELETE',
      headers: YUMER_CONFIG.getInstanceHeaders(instanceJWT, this.config.globalApiKey)
    });
  }
}

// Instância única do service
export const yumerApiService = new YumerApiService();
export default yumerApiService;
