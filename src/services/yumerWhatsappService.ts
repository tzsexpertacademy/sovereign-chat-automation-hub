// YUMER WhatsApp Backend Service - Integração completa com todas as APIs
import { API_BASE_URL, getYumerGlobalApiKey } from '@/config/environment';

import { yumerJwtService } from './yumerJwtService';

// Interfaces para tipagem do YUMER Backend
export interface YumerInstance {
  instanceName: string;
  status: 'connected' | 'disconnected' | 'qr_ready' | 'authenticating' | 'ready';
  phoneNumber?: string;
  qrCode?: string;
  hasQrCode?: boolean;
  timestamp?: string;
  profilePictureUrl?: string;
}

export interface YumerMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'reaction';
  timestamp: string;
  fromMe: boolean;
  mediaUrl?: string;
  caption?: string;
  isForwarded?: boolean;
  quotedMessageId?: string;
}

export interface YumerChat {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  profilePictureUrl?: string;
  participants?: string[];
}

export interface YumerContact {
  id: string;
  name: string;
  phoneNumber: string;
  profilePictureUrl?: string;
  isBlocked?: boolean;
  isMyContact?: boolean;
}

export interface YumerGroup {
  id: string;
  name: string;
  description?: string;
  participantsCount: number;
  profilePictureUrl?: string;
  inviteCode?: string;
  isAdmin?: boolean;
}

// Service principal para integração com YUMER Backend
class YumerWhatsAppService {
  private jwtToken: string | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    console.log('🚀 Inicializando YUMER WhatsApp Service...');
  }

  // ============ AUTENTICAÇÃO JWT ============
  setJWTToken(token: string): void {
    this.jwtToken = token;
    console.log('🔐 JWT Token configurado para YUMER Backend');
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    // Prioridade: Global API Key > JWT Token
    const globalApiKey = getYumerGlobalApiKey();
    if (globalApiKey) {
      headers['X-API-Key'] = globalApiKey;
      console.log('🔑 Usando Global API Key para autenticação YUMER');
    } else if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
      console.log('🔐 Usando JWT Token para autenticação YUMER');
    } else {
      console.log('⚠️ Nenhuma autenticação configurada para YUMER');
    }
    
    return headers;
  }

  // ============ REQUISIÇÕES HTTP ============
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const requestOptions: RequestInit = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    console.log(`📡 YUMER Request: ${options.method || 'GET'} ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YUMER API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ YUMER Response: ${endpoint}`, data);
      return data;
    } catch (error: any) {
      console.error(`❌ YUMER Request failed: ${endpoint}`, error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - servidor não responde');
      }
      throw error;
    }
  }

  // ============ HEALTH CHECK HIERÁRQUICO ============
  async checkServerHealth(): Promise<{ status: 'online' | 'offline'; details: any }> {
    try {
      console.log('🏥 Verificando saúde do servidor YUMER (rotas públicas)...');
      
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // NÍVEL 1: Teste básico na rota pública / (sem auth)
      try {
        const response = await fetch(`${API_BASE_URL}/`, {
          method: 'GET',
          signal: controller.signal,
        });
        
        if (response.ok) {
          const data = await response.json();
          const responseTime = Date.now() - startTime;
          
          console.log('✅ Rota pública / respondeu:', data);
          
          return {
            status: 'online',
            details: {
              level: 'public',
              endpoint: '/',
              data: data,
              responseTime,
              timestamp: new Date().toISOString()
            }
          };
        }
      } catch (error: any) {
        console.log('⚠️ Rota / falhou, tentando /health...');
      }
      
      // NÍVEL 2: Teste na rota /health (sem auth)
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        
        if (response.ok) {
          const data = await response.json();
          const responseTime = Date.now() - startTime;
          
          console.log('✅ Rota pública /health respondeu:', data);
          
          return {
            status: 'online',
            details: {
              level: 'health',
              endpoint: '/health',
              data: data,
              responseTime,
              timestamp: new Date().toISOString()
            }
          };
        }
      } catch (error: any) {
        console.log('⚠️ Rota /health falhou, tentando APIs autenticadas...');
      }
      
      clearTimeout(timeoutId);
      
      // NÍVEL 3: Teste nas APIs funcionais (com auth) - fallback
      const authResponse = await fetch(`${API_BASE_URL}/instance/fetchInstances`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        signal: controller.signal,
      });
      
      if (authResponse.ok) {
        const instances = await authResponse.json();
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'online',
          details: {
            level: 'authenticated',
            endpoint: '/instance/fetchInstances',
            instanceCount: instances.length,
            responseTime,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        throw new Error(`Server returned ${authResponse.status}`);
      }
    } catch (error: any) {
      console.error('❌ Health check falhou em todos os níveis:', error);
      return {
        status: 'offline',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // ============ REST-ONLY MODE ============
  async connectWebSocket(): Promise<void> {
    console.log('🔧 WebSocket disabled - REST-only mode');
  }

  disconnectWebSocket(): void {
    console.log('🔧 WebSocket disabled - REST-only mode');
  }

  isWebSocketConnected(): boolean {
    return false; // Sempre falso em modo REST
  }

  getWebSocketInfo(): any {
    return { mode: 'REST-only', protocol: 'HTTPS' };
  }

  // ============ TESTE DE CONECTIVIDADE REST ============
  async testWebSocketConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    return { success: true, details: { mode: 'REST-only', message: 'WebSocket disabled - using REST API only' } };
  }

  // ============ GESTÃO DE EVENTOS JWT E WEBSOCKET ============
  async getAvailableEvents(): Promise<string[]> {
    return yumerJwtService.getAvailableEvents();
  }

  async generateWebSocketJWT(instanceName: string): Promise<string> {
    return yumerJwtService.generateJWT(instanceName);
  }

  // ============ GERENCIAMENTO DE INSTÂNCIAS ============
  
  // POST /instance/create
  async createInstance(instanceName: string, customName?: string): Promise<YumerInstance> {
    return this.makeRequest('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName, customName }),
    });
  }

  // GET /instance/connect/:instanceName
  async connectInstance(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/connect/${instanceName}`);
  }

  // GET /instance/connectionState/:instanceName
  async getInstanceConnectionState(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/connectionState/${instanceName}`);
  }

  // GET /instance/fetchInstance/:instanceName
  async fetchInstance(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/fetchInstance/${instanceName}`);
  }

  // GET /instance/fetchInstances
  async fetchAllInstances(): Promise<YumerInstance[]> {
    return this.makeRequest('/instance/fetchInstances');
  }

  // PATCH /instance/reload/:instanceName
  async reloadInstance(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/reload/${instanceName}`, {
      method: 'PATCH',
    });
  }

  // PATCH /instance/update/:instanceName
  async updateInstance(instanceName: string, updateData: any): Promise<YumerInstance> {
    return this.makeRequest(`/instance/update/${instanceName}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  // DELETE /instance/logout/:instanceName
  async logoutInstance(instanceName: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/instance/logout/${instanceName}`, {
      method: 'DELETE',
    });
  }

  // DELETE /instance/delete/:instanceName
  async deleteInstance(instanceName: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/instance/delete/${instanceName}`, {
      method: 'DELETE',
    });
  }

  // PUT /instance/refreshToken/:instanceName
  async refreshInstanceToken(instanceName: string): Promise<{ token: string }> {
    return this.makeRequest(`/instance/refreshToken/${instanceName}`, {
      method: 'PUT',
    });
  }

  // GET /instance/qrcode/:instanceName
  async getQRCode(instanceName: string): Promise<{ qrCode: string }> {
    return this.makeRequest(`/instance/qrcode/${instanceName}`);
  }

  // ============ ENVIO DE MENSAGENS ============

  // POST /message/sendText/:instanceName
  async sendTextMessage(instanceName: string, to: string, message: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, message }),
    });
  }

  // POST /message/sendMedia/:instanceName
  async sendMediaMessage(instanceName: string, to: string, media: File, caption?: string): Promise<YumerMessage> {
    const formData = new FormData();
    formData.append('to', to);
    formData.append('media', media);
    if (caption) formData.append('caption', caption);

    return fetch(`${API_BASE_URL}/message/sendMedia/${instanceName}`, {
      method: 'POST',
      headers: this.jwtToken ? { 'Authorization': `Bearer ${this.jwtToken}` } : {},
      body: formData,
    }).then(res => res.json());
  }

  // POST /message/sendMediaFile/:instanceName
  async sendMediaFile(instanceName: string, to: string, filePath: string, caption?: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendMediaFile/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, filePath, caption }),
    });
  }

  // POST /message/sendWhatsAppAudio/:instanceName
  async sendAudioMessage(instanceName: string, to: string, audio: File): Promise<YumerMessage> {
    const formData = new FormData();
    formData.append('to', to);
    formData.append('audio', audio);

    return fetch(`${API_BASE_URL}/message/sendWhatsAppAudio/${instanceName}`, {
      method: 'POST',
      headers: this.jwtToken ? { 'Authorization': `Bearer ${this.jwtToken}` } : {},
      body: formData,
    }).then(res => res.json());
  }

  // POST /message/sendWhatsAppAudioFile/:instanceName
  async sendAudioFile(instanceName: string, to: string, audioPath: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendWhatsAppAudioFile/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, audioPath }),
    });
  }

  // POST /message/sendLocation/:instanceName
  async sendLocation(instanceName: string, to: string, latitude: number, longitude: number, description?: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendLocation/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, latitude, longitude, description }),
    });
  }

  // POST /message/sendContact/:instanceName
  async sendContact(instanceName: string, to: string, contact: YumerContact): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendContact/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, contact }),
    });
  }

  // POST /message/sendReaction/:instanceName
  async sendReaction(instanceName: string, to: string, messageId: string, emoji: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendReaction/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, messageId, emoji }),
    });
  }

  // POST /message/sendButtons/:instanceName
  async sendButtons(instanceName: string, to: string, text: string, buttons: any[]): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendButtons/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, text, buttons }),
    });
  }

  // POST /message/sendList/:instanceName
  async sendList(instanceName: string, to: string, text: string, buttonText: string, list: any[]): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendList/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, text, buttonText, list }),
    });
  }

  // POST /message/sendList/legacy/:instanceName
  async sendListLegacy(instanceName: string, to: string, text: string, list: any[]): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendList/legacy/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, text, list }),
    });
  }

  // POST /message/sendLink/:instanceName
  async sendLink(instanceName: string, to: string, url: string, text?: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendLink/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, url, text }),
    });
  }

  // ============ GERENCIAMENTO DE CHATS ============

  // POST /chat/whatsappNumbers/:instanceName
  async getWhatsAppNumbers(instanceName: string): Promise<string[]> {
    return this.makeRequest(`/chat/whatsappNumbers/${instanceName}`, {
      method: 'POST',
    });
  }

  // PUT /chat/markMessageAsRead/:instanceName
  async markMessageAsRead(instanceName: string, chatId: string, messageId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/markMessageAsRead/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ chatId, messageId }),
    });
  }

  // PATCH /chat/readMessages/:instanceName
  async markChatAsRead(instanceName: string, chatId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/readMessages/${instanceName}`, {
      method: 'PATCH',
      body: JSON.stringify({ chatId }),
    });
  }

  // PATCH /chat/updatePresence/:instanceName
  async updatePresence(instanceName: string, presence: 'available' | 'unavailable' | 'composing' | 'recording'): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/updatePresence/${instanceName}`, {
      method: 'PATCH',
      body: JSON.stringify({ presence }),
    });
  }

  // PUT /chat/archiveChat/:instanceName
  async archiveChat(instanceName: string, chatId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/archiveChat/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ chatId }),
    });
  }

  // DELETE /chat/deleteMessageForEveryone/:instanceName
  async deleteMessageForEveryone(instanceName: string, messageId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/deleteMessageForEveryone/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ messageId }),
    });
  }

  // DELETE /chat/deleteMessage/:instanceName
  async deleteMessage(instanceName: string, messageId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/deleteMessage/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ messageId }),
    });
  }

  // DELETE /chat/deleteChat/:instanceName
  async deleteChat(instanceName: string, chatId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/deleteChat/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ chatId }),
    });
  }

  // POST /chat/fetchProfilePictureUrl/:instanceName
  async fetchProfilePictureUrl(instanceName: string, contactId: string): Promise<{ profilePictureUrl: string }> {
    return this.makeRequest(`/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ contactId }),
    });
  }

  // POST /chat/findContacts/:instanceName
  async findContacts(instanceName: string, query: string): Promise<YumerContact[]> {
    return this.makeRequest(`/chat/findContacts/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // POST /chat/findMessages/:instanceName
  async findMessages(instanceName: string, chatId: string, limit?: number, offset?: number): Promise<YumerMessage[]> {
    return this.makeRequest(`/chat/findMessages/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ chatId, limit, offset }),
    });
  }

  // GET /chat/findChats/:instanceName
  async findChats(instanceName: string): Promise<YumerChat[]> {
    return this.makeRequest(`/chat/findChats/${instanceName}`);
  }

  // ============ GERENCIAMENTO DE GRUPOS ============

  // POST /group/create/:instanceName
  async createGroup(instanceName: string, name: string, participants: string[]): Promise<YumerGroup> {
    return this.makeRequest(`/group/create/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ name, participants }),
    });
  }

  // PUT /group/updateGroupPicture/:instanceName
  async updateGroupPicture(instanceName: string, groupId: string, picture: File): Promise<{ success: boolean }> {
    const formData = new FormData();
    formData.append('groupId', groupId);
    formData.append('picture', picture);

    return fetch(`${API_BASE_URL}/group/updateGroupPicture/${instanceName}`, {
      method: 'PUT',
      headers: this.jwtToken ? { 'Authorization': `Bearer ${this.jwtToken}` } : {},
      body: formData,
    }).then(res => res.json());
  }

  // GET /group/findGroupInfos/:instanceName
  async getGroupInfo(instanceName: string, groupId: string): Promise<YumerGroup> {
    return this.makeRequest(`/group/findGroupInfos/${instanceName}?groupId=${groupId}`);
  }

  // GET /group/findAllGroups/:instanceName
  async findAllGroups(instanceName: string): Promise<YumerGroup[]> {
    return this.makeRequest(`/group/findAllGroups/${instanceName}`);
  }

  // GET /group/participants/:instanceName
  async getGroupParticipants(instanceName: string, groupId: string): Promise<YumerContact[]> {
    return this.makeRequest(`/group/participants/${instanceName}?groupId=${groupId}`);
  }

  // GET /group/inviteCode/:instanceName
  async getGroupInviteCode(instanceName: string, groupId: string): Promise<{ inviteCode: string }> {
    return this.makeRequest(`/group/inviteCode/${instanceName}?groupId=${groupId}`);
  }

  // PUT /group/revokeInviteCode/:instanceName
  async revokeGroupInviteCode(instanceName: string, groupId: string): Promise<{ inviteCode: string }> {
    return this.makeRequest(`/group/revokeInviteCode/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ groupId }),
    });
  }

  // PUT /group/updateParticipant/:instanceName
  async updateGroupParticipant(instanceName: string, groupId: string, participantId: string, action: 'add' | 'remove' | 'promote' | 'demote'): Promise<{ success: boolean }> {
    return this.makeRequest(`/group/updateParticipant/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ groupId, participantId, action }),
    });
  }

  // DELETE /group/leaveGroup/:instanceName
  async leaveGroup(instanceName: string, groupId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/group/leaveGroup/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ groupId }),
    });
  }

  // ============ WEBHOOK / S3 / MÍDIA ============

  // POST /api/v2/instance/:instanceId/webhook (API v2 com descoberta dinâmica)
  async setWebhook(instanceName: string, webhookUrl: string, events: string[]): Promise<{ success: boolean }> {
    try {
      // Descobrir instanceId real
      const discovery = await this.makeRequest(`/api/v2/instance/find/${instanceName}`, {
        method: 'GET'
      });
      
      if (!discovery.id) {
        throw new Error('InstanceId não encontrado na resposta de discovery');
      }
      
      const realInstanceId = discovery.id.toString();
      console.log(`🎯 [YUMER-API] Usando instanceId real: ${realInstanceId} para webhook`);
      
      return this.makeRequest(`/api/v2/instance/${realInstanceId}/webhook`, {
        method: 'POST',
        body: JSON.stringify({
          name: "supabase-codechat",
          url: webhookUrl,
          enabled: true,
          headers: { "apikey": "df1afd525fs5f15" },
          WebhookEvents: { 
            qrcodeUpdate: true, 
            connectionUpdate: true 
          }
        }),
      });
    } catch (error) {
      console.error(`❌ [YUMER-API] Erro ao configurar webhook:`, error);
      return { success: false };
    }
  }

  // GET /webhook/find/:instanceName
  async getWebhook(instanceName: string): Promise<{ webhookUrl: string; events: string[] }> {
    return this.makeRequest(`/webhook/find/${instanceName}`);
  }

  // POST /s3/findMedia/:instanceName
  async findS3Media(instanceName: string, mediaId: string): Promise<{ mediaUrl: string }> {
    return this.makeRequest(`/s3/findMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ mediaId }),
    });
  }

  // GET /s3/media/url/:id/:instanceName
  async getS3MediaUrl(instanceName: string, mediaId: string): Promise<{ url: string }> {
    return this.makeRequest(`/s3/media/url/${mediaId}/${instanceName}`);
  }

  // ============ WEBSOCKET EVENT LISTENERS (BRIDGE DE COMPATIBILIDADE) ============

  // ============ EVENT HANDLERS DISABLED (REST-ONLY) ============
  
  getSocket(): any {
    return {
      connected: false, // Sempre falso em modo REST
      id: 'rest-mode',
      on: () => console.log('🔧 WebSocket disabled - REST mode'),
      off: () => console.log('🔧 WebSocket disabled - REST mode'),
      emit: () => console.log('🔧 WebSocket disabled - REST mode'),
      disconnect: () => console.log('🔧 WebSocket disabled - REST mode')
    };
  }

  onQRCodeGenerated(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onAuthenticated(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onReady(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onDisconnected(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onAuthFailure(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onStatusUpdate(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onTypingStart(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onTypingStop(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onRecordingStart(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onRecordingStop(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onPresenceUpdate(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onMessageReceived(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onMessageSent(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onMessageDelivered(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onMessageRead(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onMessageReaction(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onMessageDeleted(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onChatCreated(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onChatArchived(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onContactBlocked(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }

  onGroupUpdated(): void {
    console.log('🔧 Event handlers disabled - use REST polling instead');
  }
}

// Export singleton instance
export const yumerWhatsAppService = new YumerWhatsAppService();
export default yumerWhatsAppService;