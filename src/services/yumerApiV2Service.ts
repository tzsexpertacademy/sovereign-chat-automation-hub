
import { serverConfigService } from './serverConfigService';

// ===== TIPOS OFICIAIS DA API YUMER V2 =====
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

export interface YumerV2Contact {
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  isGroup: boolean;
  isWAContact: boolean;
  verifiedName?: string;
}

export interface YumerV2Group {
  id: string;
  subject: string;
  subjectOwner?: string;
  subjectTime?: number;
  creation?: number;
  owner?: string;
  desc?: string;
  descId?: string;
  restrict?: boolean;
  announce?: boolean;
  size?: number;
  participants: YumerV2GroupParticipant[];
}

export interface YumerV2GroupParticipant {
  id: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface YumerV2Media {
  mediatype: 'image' | 'audio' | 'video' | 'document';
  media: string; // base64 ou URL
  caption?: string;
  fileName?: string;
}

export interface YumerV2Profile {
  name?: string;
  status?: string;
  profilePicUrl?: string;
}

export interface YumerV2Settings {
  readreceipts?: boolean;
  profile?: YumerV2Profile;
  privacy?: {
    readreceipts?: 'all' | 'contacts' | 'none';
    profile?: 'all' | 'contacts' | 'none';
    status?: 'all' | 'contacts' | 'none';
    online?: 'all' | 'match_last_seen';
    last?: 'all' | 'contacts' | 'none';
    groupadd?: 'all' | 'contacts' | 'contact_blacklist';
  };
}

export interface YumerV2Label {
  id: string;
  name: string;
  color: number;
  predefinedId?: string;
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
  mediaMessage?: YumerV2Media;
}

export interface YumerV2ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Serviço completo da API Yumer v2.1.3
 * Implementa TODOS os endpoints da documentação oficial
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

  async restartInstance(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/instance/restart/${instanceName}`, { method: 'PUT' });
  }

  // ===== CONTACT ENDPOINTS =====
  async findContacts(instanceName: string, filters?: any): Promise<YumerV2ApiResponse<YumerV2Contact[]>> {
    return this.makeRequest(`/chat/findContacts/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(filters || {})
    });
  }

  async createContact(instanceName: string, contact: Partial<YumerV2Contact>): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/upsertContact/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(contact)
    });
  }

  async updateContactProfilePic(instanceName: string, remoteJid: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/updateContactProfilePicture/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ remoteJid })
    });
  }

  async fetchContactProfilePic(instanceName: string, remoteJid: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number: remoteJid })
    });
  }

  async blockContact(instanceName: string, remoteJid: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/blockContact/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ remoteJid })
    });
  }

  async unblockContact(instanceName: string, remoteJid: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/unblockContact/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ remoteJid })
    });
  }

  // ===== GROUP ENDPOINTS =====
  async findGroups(instanceName: string, filters?: any): Promise<YumerV2ApiResponse<YumerV2Group[]>> {
    return this.makeRequest(`/group/findGroupByJid/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(filters || {})
    });
  }

  async createGroup(instanceName: string, groupData: {
    subject: string;
    participants: string[];
  }): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/create/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(groupData)
    });
  }

  async updateGroupInfo(instanceName: string, groupJid: string, updates: {
    subject?: string;
    description?: string;
  }): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/updateGroupInfo/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupJid,
        ...updates
      })
    });
  }

  async addParticipants(instanceName: string, groupJid: string, participants: string[]): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/updateGParticipant/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupJid,
        action: 'add',
        participants
      })
    });
  }

  async removeParticipants(instanceName: string, groupJid: string, participants: string[]): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/updateGParticipant/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupJid,
        action: 'remove',
        participants
      })
    });
  }

  async promoteParticipants(instanceName: string, groupJid: string, participants: string[]): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/updateGParticipant/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupJid,
        action: 'promote',
        participants
      })
    });
  }

  async demoteParticipants(instanceName: string, groupJid: string, participants: string[]): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/updateGParticipant/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupJid,
        action: 'demote',
        participants
      })
    });
  }

  async updateGroupSetting(instanceName: string, groupJid: string, setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/updateGSetting/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupJid,
        action: setting
      })
    });
  }

  async leaveGroup(instanceName: string, groupJid: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/group/leaveGroup/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ groupJid })
    });
  }

  // ===== MEDIA ENDPOINTS =====
  async uploadMedia(instanceName: string, media: YumerV2Media): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/media/upload/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(media)
    });
  }

  async downloadMedia(instanceName: string, messageId: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/media/download/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ messageId })
    });
  }

  // ===== PROFILE ENDPOINTS =====
  async getProfile(instanceName: string): Promise<YumerV2ApiResponse<YumerV2Profile>> {
    return this.makeRequest(`/chat/fetchProfile/${instanceName}`, { method: 'GET' });
  }

  async updateProfile(instanceName: string, profile: YumerV2Profile): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/updateProfile/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
  }

  async updateProfilePicture(instanceName: string, pictureBase64: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/updateProfilePicture/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ picture: pictureBase64 })
    });
  }

  async removeProfilePicture(instanceName: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/removeProfilePicture/${instanceName}`, {
      method: 'DELETE'
    });
  }

  // ===== SETTINGS ENDPOINTS =====
  async getSettings(instanceName: string): Promise<YumerV2ApiResponse<YumerV2Settings>> {
    return this.makeRequest(`/chat/fetchPrivacySettings/${instanceName}`, { method: 'GET' });
  }

  async updateSettings(instanceName: string, settings: YumerV2Settings): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/updatePrivacySettings/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // ===== PRESENCE ENDPOINTS =====
  async updatePresence(instanceName: string, remoteJid: string, presence: 'available' | 'composing' | 'recording' | 'paused'): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/sendPresence/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        number: remoteJid,
        presence
      })
    });
  }

  // ===== LABELS ENDPOINTS =====
  async getLabels(instanceName: string): Promise<YumerV2ApiResponse<YumerV2Label[]>> {
    return this.makeRequest(`/chat/getLabels/${instanceName}`, { method: 'GET' });
  }

  async createLabel(instanceName: string, label: Omit<YumerV2Label, 'id'>): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/handleLabel/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        action: 'add',
        labelName: label.name,
        labelColor: label.color
      })
    });
  }

  async updateLabel(instanceName: string, labelId: string, updates: Partial<YumerV2Label>): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/handleLabel/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        action: 'update',
        labelId,
        ...updates
      })
    });
  }

  async deleteLabel(instanceName: string, labelId: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/handleLabel/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        action: 'remove',
        labelId
      })
    });
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

  async sendReaction(instanceName: string, data: {
    reactionMessage: {
      react: {
        text: string;
        key: {
          remoteJid: string;
          fromMe: boolean;
          id: string;
        };
      };
    };
  }): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/message/sendReaction/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(data)
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

  async readMessages(instanceName: string, remoteJid: string): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/readMessages/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ remoteJid })
    });
  }

  async archiveChat(instanceName: string, remoteJid: string, archive: boolean = true): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/archiveChat/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({
        remoteJid,
        archive
      })
    });
  }

  async deleteMessage(instanceName: string, remoteJid: string, messageId: string, deleteForEveryone: boolean = false): Promise<YumerV2ApiResponse> {
    return this.makeRequest(`/chat/deleteMessage/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({
        remoteJid,
        messageId,
        deleteForEveryone
      })
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
