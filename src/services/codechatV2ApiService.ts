
import { serverConfigService } from './serverConfigService';

// Tipos completos para CodeChat API v2.2.1
export interface WebhookConfig {
  enabled: boolean;
  url: string;
  events: string[];
  headers?: Record<string, string>;
}

export interface ChatInfo {
  id: string;
  name?: string;
  isGroup: boolean;
  participants?: number;
  lastMessage?: {
    id: string;
    content: string;
    timestamp: string;
    fromMe: boolean;
  };
  unreadCount: number;
  archived: boolean;
}

export interface ContactInfo {
  id: string;
  name: string;
  pushName?: string;
  profilePicUrl?: string;
  isMyContact: boolean;
  isWAContact: boolean;
  status?: string;
}

export interface MessageInfo {
  id: string;
  chatId: string;
  fromMe: boolean;
  content: any;
  messageType: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  quotedMessage?: MessageInfo;
}

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  participants: Array<{
    id: string;
    name: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
  createdAt: string;
  profilePicUrl?: string;
}

export interface InstanceProfile {
  name: string;
  status?: string;
  profilePicUrl?: string;
  pushName?: string;
}

class CodeChatV2ApiService {
  private config = serverConfigService.getConfig();

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.serverUrl}/${endpoint.replace(/^\//, '')}`;
    
    try {
      console.log(`🔥 [CODECHAT-V2.2.1] ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.requestTimeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        console.error(`❌ [CODECHAT-V2.2.1] Error ${response.status}:`, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Request failed'}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-V2.2.1] Success:`, data);
      return data;

    } catch (error: any) {
      console.error(`❌ [CODECHAT-V2.2.1] Request failed:`, error);
      throw error;
    }
  }

  // ============ WEBHOOK MANAGEMENT ============
  async setWebhook(businessToken: string, instanceId: string, config: WebhookConfig) {
    return this.makeRequest(`api/v2/instance/${instanceId}/webhook`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(config)
    });
  }

  async getWebhook(businessToken: string, instanceId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/webhook`, {
      headers: { 'Authorization': `Bearer ${businessToken}` }
    });
  }

  async removeWebhook(businessToken: string, instanceId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/webhook`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${businessToken}` }
    });
  }

  // ============ CHAT MANAGEMENT ============
  async getChats(instanceJWT: string, instanceId: string, limit?: number, offset?: number): Promise<ChatInfo[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const endpoint = `api/v2/instance/${instanceId}/chat${params.toString() ? '?' + params.toString() : ''}`;
    return this.makeRequest(endpoint, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getChatById(instanceJWT: string, instanceId: string, chatId: string): Promise<ChatInfo> {
    return this.makeRequest(`api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async archiveChat(instanceJWT: string, instanceId: string, chatId: string, archive: boolean = true) {
    return this.makeRequest(`api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}/archive`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ archive })
    });
  }

  async deleteChat(instanceJWT: string, instanceId: string, chatId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async markChatAsRead(instanceJWT: string, instanceId: string, chatId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ CONTACT MANAGEMENT ============
  async getContacts(instanceJWT: string, instanceId: string): Promise<ContactInfo[]> {
    return this.makeRequest(`api/v2/instance/${instanceId}/contact`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getContactById(instanceJWT: string, instanceId: string, contactId: string): Promise<ContactInfo> {
    return this.makeRequest(`api/v2/instance/${instanceId}/contact/${encodeURIComponent(contactId)}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateContact(instanceJWT: string, instanceId: string, contactId: string, updates: Partial<ContactInfo>) {
    return this.makeRequest(`api/v2/instance/${instanceId}/contact/${encodeURIComponent(contactId)}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(updates)
    });
  }

  async blockContact(instanceJWT: string, instanceId: string, contactId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/contact/${encodeURIComponent(contactId)}/block`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async unblockContact(instanceJWT: string, instanceId: string, contactId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/contact/${encodeURIComponent(contactId)}/unblock`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ MESSAGE MANAGEMENT ============
  async getMessages(instanceJWT: string, instanceId: string, chatId: string, limit?: number, offset?: number): Promise<MessageInfo[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const endpoint = `api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}/message${params.toString() ? '?' + params.toString() : ''}`;
    return this.makeRequest(endpoint, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getMessageById(instanceJWT: string, instanceId: string, messageId: string): Promise<MessageInfo> {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/${encodeURIComponent(messageId)}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async deleteMessage(instanceJWT: string, instanceId: string, messageId: string, deleteForEveryone: boolean = false) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ deleteForEveryone })
    });
  }

  async forwardMessage(instanceJWT: string, instanceId: string, messageId: string, chatIds: string[]) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/${encodeURIComponent(messageId)}/forward`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ chatIds })
    });
  }

  async reactToMessage(instanceJWT: string, instanceId: string, messageId: string, reaction: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/${encodeURIComponent(messageId)}/react`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ reaction })
    });
  }

  // ============ BASIC MESSAGING ============
  async sendTextMessage(instanceJWT: string, instanceId: string, data: { number: string; text: string; delay?: number; presence?: string; }) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/text`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({
        number: data.number,
        textMessage: { text: data.text },
        options: { 
          delay: data.delay || 1200, 
          presence: data.presence || 'composing' 
        }
      })
    });
  }

  // ============ ADVANCED MESSAGING ============
  async sendAudioMessage(instanceJWT: string, instanceId: string, chatId: string, audioUrl: string, caption?: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({
        chatId,
        audio: audioUrl,
        caption,
        options: { delay: 1200, presence: 'recording' }
      })
    });
  }

  async sendDocumentMessage(instanceJWT: string, instanceId: string, chatId: string, documentUrl: string, filename: string, caption?: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/document`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({
        chatId,
        document: documentUrl,
        filename,
        caption,
        options: { delay: 1200, presence: 'composing' }
      })
    });
  }

  async sendLocationMessage(instanceJWT: string, instanceId: string, chatId: string, latitude: number, longitude: number, name?: string, address?: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/location`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({
        chatId,
        latitude,
        longitude,
        name,
        address,
        options: { delay: 1200, presence: 'composing' }
      })
    });
  }

  async sendContactMessage(instanceJWT: string, instanceId: string, chatId: string, contacts: Array<{ name: string; number: string; }>) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/contact`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({
        chatId,
        contacts,
        options: { delay: 1200, presence: 'composing' }
      })
    });
  }

  // ============ PRESENCE MANAGEMENT ============
  async updatePresence(instanceJWT: string, instanceId: string, chatId: string, presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused') {
    return this.makeRequest(`api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}/presence`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ presence })
    });
  }

  async getPresence(instanceJWT: string, instanceId: string, chatId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/chat/${encodeURIComponent(chatId)}/presence`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ PROFILE MANAGEMENT ============
  async getProfile(instanceJWT: string, instanceId: string): Promise<InstanceProfile> {
    return this.makeRequest(`api/v2/instance/${instanceId}/profile`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateProfile(instanceJWT: string, instanceId: string, updates: Partial<InstanceProfile>) {
    return this.makeRequest(`api/v2/instance/${instanceId}/profile`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(updates)
    });
  }

  async updateProfilePicture(instanceJWT: string, instanceId: string, imageUrl: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/profile/picture`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ image: imageUrl })
    });
  }

  async getProfilePicture(instanceJWT: string, instanceId: string, contactId?: string) {
    const endpoint = contactId 
      ? `api/v2/instance/${instanceId}/contact/${encodeURIComponent(contactId)}/picture`
      : `api/v2/instance/${instanceId}/profile/picture`;
    
    return this.makeRequest(endpoint, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ GROUP MANAGEMENT ============
  async createGroup(instanceJWT: string, instanceId: string, name: string, participants: string[], description?: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ name, participants, description })
    });
  }

  async getGroupInfo(instanceJWT: string, instanceId: string, groupId: string): Promise<GroupInfo> {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateGroupInfo(instanceJWT: string, instanceId: string, groupId: string, updates: { name?: string; description?: string }) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(updates)
    });
  }

  async addGroupParticipants(instanceJWT: string, instanceId: string, groupId: string, participants: string[]) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/participants`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ participants })
    });
  }

  async removeGroupParticipants(instanceJWT: string, instanceId: string, groupId: string, participants: string[]) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/participants`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ participants })
    });
  }

  async promoteGroupParticipants(instanceJWT: string, instanceId: string, groupId: string, participants: string[]) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/participants/promote`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ participants })
    });
  }

  async demoteGroupParticipants(instanceJWT: string, instanceId: string, groupId: string, participants: string[]) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/participants/demote`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ participants })
    });
  }

  async leaveGroup(instanceJWT: string, instanceId: string, groupId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/leave`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getGroupInviteCode(instanceJWT: string, instanceId: string, groupId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/invite`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async revokeGroupInviteCode(instanceJWT: string, instanceId: string, groupId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/group/${encodeURIComponent(groupId)}/invite`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ SETTINGS & PRIVACY ============
  async getPrivacySettings(instanceJWT: string, instanceId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/settings/privacy`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updatePrivacySettings(instanceJWT: string, instanceId: string, settings: any) {
    return this.makeRequest(`api/v2/instance/${instanceId}/settings/privacy`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(settings)
    });
  }

  async getBusinessProfile(instanceJWT: string, instanceId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/business/profile`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateBusinessProfile(instanceJWT: string, instanceId: string, profile: any) {
    return this.makeRequest(`api/v2/instance/${instanceId}/business/profile`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(profile)
    });
  }

  // ============ UTILITIES ============
  async checkWhatsAppNumber(instanceJWT: string, instanceId: string, numbers: string[]) {
    return this.makeRequest(`api/v2/instance/${instanceId}/check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify({ numbers })
    });
  }

  async downloadMedia(instanceJWT: string, instanceId: string, messageId: string) {
    return this.makeRequest(`api/v2/instance/${instanceId}/message/${encodeURIComponent(messageId)}/media`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }
}

export const codechatV2ApiService = new CodeChatV2ApiService();
