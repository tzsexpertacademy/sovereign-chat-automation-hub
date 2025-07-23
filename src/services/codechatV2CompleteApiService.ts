
import { serverConfigService } from './serverConfigService';
import * as Types from '../types/codechatV2Types';

class CodeChatV2CompleteApiService {
  private config = serverConfigService.getConfig();

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.serverUrl}${endpoint}`;
    
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

  // ============ ADMIN CONTROLLER ============
  async createBusiness(data: Types.BusinessCreateRequest, adminToken: string): Promise<Types.BusinessCreateResponse> {
    return this.makeRequest('/api/v2/admin/business', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(data)
    });
  }

  async getAllBusinesses(adminToken: string): Promise<Types.BusinessFindResponse[]> {
    return this.makeRequest('/api/v2/admin/business', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
  }

  async refreshBusinessToken(businessId: string, data: Types.BusinessOldToken, adminToken: string): Promise<Types.NewTokenResponse> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}/refresh-token`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(data)
    });
  }

  async moveInstance(data: Types.MoveInstanceRequest, adminToken: string): Promise<Types.AdminMoveInstanceResponse> {
    return this.makeRequest('/api/v2/admin/business/move-instance', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(data)
    });
  }

  async deleteBusiness(businessId: string, adminToken: string, force?: boolean): Promise<Types.BusinessCreateResponse> {
    const params = force ? '?force=true' : '';
    return this.makeRequest(`/api/v2/admin/business/${businessId}${params}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
  }

  // ============ BUSINESS CONTROLLER ============
  async getBusiness(businessId: string, businessToken: string): Promise<Types.BusinessFindResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}`, {
      headers: { 'Authorization': `Bearer ${businessToken}` }
    });
  }

  async updateBusiness(businessId: string, data: Types.BusinessUpdateRequest, businessToken: string): Promise<Types.BusinessFindResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  async createBusinessInstance(businessId: string, data: Types.InstanceCreateRequest, businessToken: string): Promise<Types.InstanceCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  async deleteBusinessInstance(businessId: string, businessToken: string): Promise<void> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${businessToken}` }
    });
  }

  async refreshInstanceToken(businessId: string, instanceId: string, data: Types.BusinessOldToken, businessToken: string): Promise<Types.NewTokenResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/${instanceId}/refresh-token`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  async toggleInstanceActivation(businessId: string, instanceId: string, data: Types.ToggleActionDTO, businessToken: string): Promise<Types.InstanceCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/${instanceId}/toggle-activate`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  async getConnectedInstances(businessId: string, businessToken: string): Promise<Types.BusinessInstancesConnectedResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/connected`, {
      headers: { 'Authorization': `Bearer ${businessToken}` }
    });
  }

  async searchInstances(businessId: string, data: Types.SearchInstanceDTO, businessToken: string): Promise<Types.BusinessPageResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  async moveWhatsApp(businessId: string, data: Types.MoveWhatsAppRequest, businessToken: string): Promise<Types.BusinessMoveWAResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/instance/move-whatsapp`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  // ============ BUSINESS WEBHOOK CONTROLLER ============
  async createBusinessWebhook(businessId: string, data: Types.WebhookCreateRequest, businessToken: string): Promise<Types.BusinessWebhookCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/webhook`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  async getBusinessWebhook(businessId: string, businessToken: string): Promise<Types.BusinessWebhookCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/webhook`, {
      headers: { 'Authorization': `Bearer ${businessToken}` }
    });
  }

  async updateBusinessWebhook(businessId: string, data: Types.WebhookUpdateRequest, businessToken: string): Promise<Types.BusinessWebhookCreateResponse> {
    return this.makeRequest(`/api/v2/business/${businessId}/webhook`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${businessToken}` },
      body: JSON.stringify(data)
    });
  }

  // ============ INSTANCE CONTROLLER ============
  async getInstance(instanceId: string, instanceJWT: string): Promise<Types.InstanceFindResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async setProxy(instanceId: string, data: Types.ProxyRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/proxy`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async connectInstance(instanceId: string, instanceJWT: string): Promise<Types.InstanceConnectResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/connect`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async reloadInstance(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/reload`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getConnectionState(instanceId: string, instanceJWT: string): Promise<Types.InstanceConnectionStateResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/connection-state`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async logoutInstance(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/logout`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateProfileName(instanceId: string, data: Types.ProfileNameRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/whatsapp/update/profile-name`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async updateProfilePicture(instanceId: string, data: Types.PictureUrlRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/whatsapp/update/profile-picture`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async updateProfileStatus(instanceId: string, data: Types.ProfileStatusRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/whatsapp/update/profile-status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async updateSeenPrivacy(instanceId: string, data: Types.ProfilePrivacyRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/whatsapp/update/profile-seen-privacy`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async updateOnlinePrivacy(instanceId: string, data: Types.ProfilePrivacyRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/whatsapp/update/profile-online-privacy`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  // ============ INSTANCE VIEWS CONTROLLER ============
  async getQRCode(instanceId: string, instanceJWT: string): Promise<Types.InstanceConnectResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/qrcode`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ INSTANCE WEBHOOK CONTROLLER ============
  async createWebhook(instanceId: string, data: Types.WebhookCreateRequest, instanceJWT: string): Promise<Types.WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getWebhooks(instanceId: string, instanceJWT: string): Promise<Types.WebhookResponse[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getWebhookById(instanceId: string, webhookId: string, instanceJWT: string): Promise<Types.WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook/${webhookId}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateWebhook(instanceId: string, webhookId: string, data: Types.WebhookUpdateRequest, instanceJWT: string): Promise<Types.WebhookResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook/${webhookId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async deleteWebhook(instanceId: string, webhookId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook/${webhookId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateWebhookEvents(instanceId: string, webhookId: string, data: Types.WebhookEventsRequest, instanceJWT: string): Promise<Types.WebhookEventsResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook/${webhookId}/events`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  // ============ WEBSOCKET CONTROLLER ============
  async createSocket(instanceId: string, data: Types.SocketRequest, instanceJWT: string): Promise<Types.SocketResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/socket`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getSocket(instanceId: string, instanceJWT: string): Promise<Types.SocketResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/socket`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateSocket(instanceId: string, data: Types.SocketRequest, instanceJWT: string): Promise<Types.SocketResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/socket`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async deleteSocket(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/socket`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ SEND MESSAGE CONTROLLER ============
  async sendTextMessage(instanceId: string, data: Types.TextMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendLinkPreview(instanceId: string, data: Types.LinkPreviewRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/link-preview`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendMedia(instanceId: string, data: Types.MediaMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendAudio(instanceId: string, data: Types.AudioMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendLocation(instanceId: string, data: Types.LocationMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/location`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendContact(instanceId: string, data: Types.ContactMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/contact`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendButtons(instanceId: string, data: Types.ButtonMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/buttons`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendList(instanceId: string, data: Types.ListMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/list`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendForward(instanceId: string, data: Types.ForwardsMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/forward`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async sendReaction(instanceId: string, data: Types.ReactionRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/reaction`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async editMessage(instanceId: string, data: Types.EditMessageRequest, instanceJWT: string): Promise<Types.ResponseSendMessage> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/send/edit-message`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  // ============ CHAT CONTROLLER ============
  async validateNumbers(instanceId: string, data: Types.ValidateNumbersRequest, instanceJWT: string): Promise<Types.ValidateNumbersResponse[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/validate-numbers`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getProfilePicture(instanceId: string, contactId: string, instanceJWT: string): Promise<string> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/profile-picture?contactId=${contactId}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getWhatsAppStatus(instanceId: string, contactId: string, instanceJWT: string): Promise<string> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/whatsapp-status?contactId=${contactId}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getBusinessProfile(instanceId: string, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/business-profile`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async markAsRead(instanceId: string, data: Types.MarkAsReadRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/mark-as-read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async archiveChat(instanceId: string, chatId: string, data: Types.ArchiveChatRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/${chatId}/archive`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async deleteMessage(instanceId: string, messageId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/delete/message/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async searchMessages(instanceId: string, data: Types.SearchMessagesRequest, instanceJWT: string): Promise<any[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/search/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async searchContacts(instanceId: string, query?: string, instanceJWT?: string): Promise<any[]> {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/search/contacts${params}`, {
      headers: instanceJWT ? { 'Authorization': `Bearer ${instanceJWT}` } : {}
    });
  }

  async searchChats(instanceId: string, query?: string, instanceJWT?: string): Promise<any[]> {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/search/chats${params}`, {
      headers: instanceJWT ? { 'Authorization': `Bearer ${instanceJWT}` } : {}
    });
  }

  async rejectCall(instanceId: string, data: Types.RejectCallRequest, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/reject-call`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  // ============ GROUP CONTROLLER ============
  async createGroup(instanceId: string, data: Types.GroupCreateRequest, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getGroup(instanceId: string, groupJid: string, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateGroup(instanceId: string, groupJid: string, data: Types.GroupUpdateRequest, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getGroupParticipants(instanceId: string, groupJid: string, instanceJWT: string): Promise<any[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}/participant-list`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateGroupParticipants(instanceId: string, groupJid: string, data: Types.GroupParticipantUpdateRequest, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}/participant-update`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async updateGroupSettings(instanceId: string, groupJid: string, data: Types.GroupSettingsRequest, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}/settings`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async createGroupInvitation(instanceId: string, groupJid: string, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}/invitation`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async revokeGroupInvitation(instanceId: string, groupJid: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}/invitation`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getGroupInvitation(instanceId: string, code: string, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/invitation/${code}`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async acceptGroupInvitation(instanceId: string, code: string, instanceJWT: string): Promise<any> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/invitation/${code}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async leaveGroup(instanceId: string, groupJid: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/group/${encodeURIComponent(groupJid)}/leave`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ MEDIA CONTROLLER ============
  async prepareMedia(instanceId: string, messageId: string, instanceJWT: string): Promise<Types.MediaResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/media/message/${messageId}/prepare`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getMediaList(instanceId: string, instanceJWT: string): Promise<Types.MediaResponse[]> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/media`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async getMediaFile(instanceId: string, mediaId: string, instanceJWT: string): Promise<Blob> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/media/${mediaId}/file`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async downloadMediaDirectly(instanceId: string, data: Types.MediaDownloadRequest, instanceJWT: string): Promise<Blob> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/media/directly-download`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async deleteMedia(instanceId: string, mediaId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/media/${mediaId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ MINIO CONTROLLER ============
  async createMinIOConfig(instanceId: string, data: Types.MinIOConfigRequest, instanceJWT: string): Promise<Types.MinIOConfigResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/minio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getMinIOConfig(instanceId: string, instanceJWT: string): Promise<Types.MinIOConfigResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/minio`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateMinIOConfig(instanceId: string, data: Types.MinIOConfigRequest, instanceJWT: string): Promise<Types.MinIOConfigResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/minio`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async deleteMinIOConfig(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/minio`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  // ============ CHATWOOT CONTROLLER ============
  async createChatwootIntegration(instanceId: string, data: Types.ChatwootIntegrationRequest, instanceJWT: string): Promise<Types.ChatwootIntegrationResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chatwoot-integration`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async getChatwootIntegration(instanceId: string, instanceJWT: string): Promise<Types.ChatwootIntegrationResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chatwoot-integration`, {
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }

  async updateChatwootIntegration(instanceId: string, data: Types.ChatwootIntegrationRequest, instanceJWT: string): Promise<Types.ChatwootIntegrationResponse> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chatwoot-integration`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${instanceJWT}` },
      body: JSON.stringify(data)
    });
  }

  async deleteChatwootIntegration(instanceId: string, instanceJWT: string): Promise<void> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/chatwoot-integration`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${instanceJWT}` }
    });
  }
}

export const codechatV2CompleteApiService = new CodeChatV2CompleteApiService();
