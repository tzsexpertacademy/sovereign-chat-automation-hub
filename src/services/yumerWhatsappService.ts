// YUMER WhatsApp Backend Service - Integração completa com todas as APIs
import { API_BASE_URL, getYumerGlobalApiKey } from '@/config/environment';
import { codeChatApiService } from './codechatApiService';
import { yumerJwtService } from './yumerJwtService';

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
  private instanceTokens: Map<string, string> = new Map(); // Cache de tokens por instância

  constructor() {
    console.log('🚀 Inicializando YUMER WhatsApp Service...');
  }

  // ============ AUTENTICAÇÃO JWT ============
  setJWTToken(token: string): void {
    this.jwtToken = token;
    console.log('🔐 JWT Token configurado para YUMER Backend');
  }

  // Definir token específico para uma instância
  setInstanceToken(instanceName: string, token: string): void {
    this.instanceTokens.set(instanceName, token);
    // Também configurar no CodeChat API Service
    codeChatApiService.setInstanceToken(instanceName, token);
    console.log(`🔐 JWT Token configurado para instância: ${instanceName}`);
  }

  // Obter token específico da instância
  getInstanceToken(instanceName: string): string | null {
    return this.instanceTokens.get(instanceName) || null;
  }

  private async getAuthHeaders(instanceName?: string): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    console.log(`🔐 [AUTH] Obtendo headers de autenticação para: ${instanceName}`);
    
    // PRIORIDADE 1: Token específico da instância
    if (instanceName) {
      const instanceToken = this.getInstanceToken(instanceName);
      if (instanceToken) {
        headers['Authorization'] = `Bearer ${instanceToken}`;
        console.log(`🔐 [AUTH] Usando JWT Token da instância: ${instanceName}`);
        console.log(`🔑 [AUTH] Token: ${instanceToken.substring(0, 50)}...`);
        return headers;
      }
    }
    
    // PRIORIDADE 2: Token JWT global
    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
      console.log('🔐 [AUTH] Usando JWT Token global para autenticação YUMER');
      return headers;
    }
    
    // PRIORIDADE 3: Tentar gerar JWT automaticamente se necessário
    if (instanceName) {
      try {
        console.log(`🔄 [AUTH] Tentando gerar JWT automaticamente para: ${instanceName}`);
        const newToken = await yumerJwtService.generateLocalJWT(instanceName);
        this.setInstanceToken(instanceName, newToken);
        headers['Authorization'] = `Bearer ${newToken}`;
        console.log(`✅ [AUTH] JWT gerado automaticamente para: ${instanceName}`);
        console.log(`🔑 [AUTH] Novo token: ${newToken.substring(0, 50)}...`);
        return headers;
      } catch (error) {
        console.warn(`⚠️ [AUTH] Falha ao gerar JWT automaticamente: ${error}`);
      }
    }
    
    // PRIORIDADE 4: Global API Key (último recurso, pode estar causando 401)
    const globalApiKey = getYumerGlobalApiKey();
    if (globalApiKey && globalApiKey.trim() !== '') {
      // Validar se a API Key não é um placeholder ou valor inválido
      if (!globalApiKey.includes('your-api-key') && !globalApiKey.includes('df1afd525fs5f15')) {
        headers['X-API-Key'] = globalApiKey;
        console.log('🔑 [AUTH] Usando Global API Key para autenticação YUMER');
      } else {
        console.warn('⚠️ [AUTH] Global API Key parece ser um placeholder - ignorando');
      }
    } else {
      console.log('⚠️ [AUTH] Nenhuma autenticação configurada para YUMER');
    }
    
    return headers;
  }

  // ============ REQUISIÇÕES HTTP ============
  private async makeRequest(endpoint: string, options: RequestInit = {}, instanceName?: string): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const requestOptions: RequestInit = {
      headers: await this.getAuthHeaders(instanceName),
      ...options,
    };

    console.log(`📡 YUMER Request: ${options.method || 'GET'} ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Aumentar timeout
      
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ YUMER API Error ${response.status}:`, errorText);
        
        // Se for 401 e estivermos usando API Key, tentar com JWT
        if (response.status === 401 && instanceName) {
          console.log('🔄 Tentando novamente com JWT...');
          return this.retryWithJWT(endpoint, options, instanceName);
        }
        
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

  // Retry com JWT quando API Key falha
  private async retryWithJWT(endpoint: string, options: RequestInit, instanceName: string): Promise<any> {
    try {
      // Gerar novo JWT para a instância
      const newToken = await yumerJwtService.generateLocalJWT(instanceName);
      this.setInstanceToken(instanceName, newToken);
      
      const url = `${API_BASE_URL}${endpoint}`;
      const requestOptions: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${newToken}`
        },
        ...options,
      };

      console.log(`🔄 Retry com JWT: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YUMER API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Retry Success: ${endpoint}`, data);
      return data;
    } catch (error) {
      console.error(`❌ Retry failed: ${endpoint}`, error);
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
        headers: await this.getAuthHeaders(),
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
    return this.makeRequest(`/instance/connect/${instanceName}`, {}, instanceName);
  }

  // GET /instance/connectionState/:instanceName
  async getInstanceConnectionState(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/connectionState/${instanceName}`, {}, instanceName);
  }

  // GET /instance/fetchInstance/:instanceName
  async fetchInstance(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/fetchInstance/${instanceName}`, {}, instanceName);
  }

  // GET /instance/fetchInstances
  async fetchAllInstances(): Promise<YumerInstance[]> {
    return this.makeRequest('/instance/fetchInstances');
  }

  // PATCH /instance/reload/:instanceName
  async reloadInstance(instanceName: string): Promise<YumerInstance> {
    return this.makeRequest(`/instance/reload/${instanceName}`, {
      method: 'PATCH',
    }, instanceName);
  }

  // PATCH /instance/update/:instanceName
  async updateInstance(instanceName: string, updateData: any): Promise<YumerInstance> {
    return this.makeRequest(`/instance/update/${instanceName}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    }, instanceName);
  }

  // DELETE /instance/logout/:instanceName
  async logoutInstance(instanceName: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/instance/logout/${instanceName}`, {
      method: 'DELETE',
    }, instanceName);
  }

  // DELETE /instance/delete/:instanceName
  async deleteInstance(instanceName: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/instance/delete/${instanceName}`, {
      method: 'DELETE',
    }, instanceName);
  }

  // PUT /instance/refreshToken/:instanceName
  async refreshInstanceToken(instanceName: string): Promise<{ token: string }> {
    return this.makeRequest(`/instance/refreshToken/${instanceName}`, {
      method: 'PUT',
    }, instanceName);
  }

  // GET /instance/qrcode/:instanceName
  async getQRCode(instanceName: string): Promise<{ qrCode: string }> {
    return this.makeRequest(`/instance/qrcode/${instanceName}`, {}, instanceName);
  }

  // ============ ENVIO DE MENSAGENS - CORRIGIDO ============

  // POST /message/sendText/:instanceName - CORREÇÃO PRINCIPAL
  async sendTextMessage(instanceName: string, to: string, message: string): Promise<YumerMessage> {
    // ✅ USAR o instanceName completo exatamente como recebido (SEM LIMPEZA)
    console.log(`📤 [CORREÇÃO] Enviando mensagem usando instanceName COMPLETO: ${instanceName}`);
    
    const payload = {
      number: to,
      options: {
        delay: 1200,
        presence: "composing"
      },
      textMessage: {
        text: message
      }
    };

    console.log(`📤 Enviando mensagem de texto para ${to} via instância ${instanceName}`);
    console.log(`📋 Payload:`, payload);
    console.log(`🔐 Verificando JWT para instância: ${instanceName}`);

    return this.makeRequest(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, instanceName);
  }

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

  async sendMediaFile(instanceName: string, to: string, filePath: string, caption?: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendMediaFile/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, filePath, caption }),
    }, instanceName);
  }

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

  async sendAudioFile(instanceName: string, to: string, audioPath: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendWhatsAppAudioFile/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, audioPath }),
    }, instanceName);
  }

  async sendLocation(instanceName: string, to: string, latitude: number, longitude: number, description?: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendLocation/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, latitude, longitude, description }),
    }, instanceName);
  }

  async sendContact(instanceName: string, to: string, contact: YumerContact): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendContact/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, contact }),
    }, instanceName);
  }

  async sendReaction(instanceName: string, to: string, messageId: string, emoji: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendReaction/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, messageId, emoji }),
    }, instanceName);
  }

  async sendButtons(instanceName: string, to: string, text: string, buttons: any[]): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendButtons/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, text, buttons }),
    }, instanceName);
  }

  async sendList(instanceName: string, to: string, text: string, buttonText: string, list: any[]): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendList/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, text, buttonText, list }),
    }, instanceName);
  }

  async sendListLegacy(instanceName: string, to: string, text: string, list: any[]): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendList/legacy/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, text, list }),
    }, instanceName);
  }

  async sendLink(instanceName: string, to: string, url: string, text?: string): Promise<YumerMessage> {
    return this.makeRequest(`/message/sendLink/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ to, url, text }),
    }, instanceName);
  }

  async getWhatsAppNumbers(instanceName: string): Promise<string[]> {
    return this.makeRequest(`/chat/whatsappNumbers/${instanceName}`, {
      method: 'POST',
    }, instanceName);
  }

  async markMessageAsRead(instanceName: string, chatId: string, messageId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/markMessageAsRead/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ chatId, messageId }),
    }, instanceName);
  }

  async markChatAsRead(instanceName: string, chatId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/readMessages/${instanceName}`, {
      method: 'PATCH',
      body: JSON.stringify({ chatId }),
    }, instanceName);
  }

  async updatePresence(instanceName: string, presence: 'available' | 'unavailable' | 'composing' | 'recording'): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/updatePresence/${instanceName}`, {
      method: 'PATCH',
      body: JSON.stringify({ presence }),
    }, instanceName);
  }

  async archiveChat(instanceName: string, chatId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/archiveChat/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ chatId }),
    }, instanceName);
  }

  async deleteMessageForEveryone(instanceName: string, messageId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/deleteMessageForEveryone/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ messageId }),
    }, instanceName);
  }

  async deleteMessage(instanceName: string, messageId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/deleteMessage/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ messageId }),
    }, instanceName);
  }

  async deleteChat(instanceName: string, chatId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/chat/deleteChat/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ chatId }),
    }, instanceName);
  }

  async fetchProfilePictureUrl(instanceName: string, contactId: string): Promise<{ profilePictureUrl: string }> {
    return this.makeRequest(`/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ contactId }),
    }, instanceName);
  }

  async findContacts(instanceName: string, query: string): Promise<YumerContact[]> {
    return this.makeRequest(`/chat/findContacts/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }, instanceName);
  }

  async findMessages(instanceName: string, chatId: string, limit?: number, offset?: number): Promise<YumerMessage[]> {
    try {
      console.log(`📨 [CODECHAT] Buscando mensagens via CodeChat API v1.3.0 para chat: ${chatId}`);
      
      // Usar o novo serviço CodeChat
      const messages = await codeChatApiService.findMessages(instanceName, chatId, limit, offset);
      
      // Converter para formato YUMER
      return messages.map(message => ({
        id: message.keyId,
        from: message.keyRemoteJid,
        to: message.keyRemoteJid,
        body: typeof message.content === 'string' ? message.content : 
              (message.content?.text || message.content?.body || `[${message.messageType}]`),
        type: message.messageType as any,
        timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
        fromMe: message.keyFromMe,
        mediaUrl: message.content?.url,
        caption: message.content?.caption,
        isForwarded: message.content?.contextInfo?.isForwarded || false
      }));
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao buscar mensagens:`, error);
      throw error;
    }
  }

  async findChats(instanceName: string): Promise<YumerChat[]> {
    try {
      console.log(`📊 [CODECHAT] Buscando chats via CodeChat API v1.3.0 para: ${instanceName}`);
      
      // Usar o novo serviço CodeChat
      const chats = await codeChatApiService.findChats(instanceName);
      
      // Converter para formato YUMER
      return chats.map(chat => ({
        id: chat.id,
        name: chat.name || 'Contato sem nome',
        isGroup: chat.isGroup,
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        unreadCount: chat.unreadCount,
        profilePictureUrl: chat.profilePictureUrl,
        participants: chat.participants
      }));
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao buscar chats:`, error);
      throw error;
    }
  }

  async createGroup(instanceName: string, name: string, participants: string[]): Promise<YumerGroup> {
    return this.makeRequest(`/group/create/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ name, participants }),
    }, instanceName);
  }

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

  async getGroupInfo(instanceName: string, groupId: string): Promise<YumerGroup> {
    return this.makeRequest(`/group/findGroupInfos/${instanceName}?groupId=${groupId}`, {}, instanceName);
  }

  async findAllGroups(instanceName: string): Promise<YumerGroup[]> {
    return this.makeRequest(`/group/findAllGroups/${instanceName}`, {}, instanceName);
  }

  async getGroupParticipants(instanceName: string, groupId: string): Promise<YumerContact[]> {
    return this.makeRequest(`/group/participants/${instanceName}?groupId=${groupId}`, {}, instanceName);
  }

  async getGroupInviteCode(instanceName: string, groupId: string): Promise<{ inviteCode: string }> {
    return this.makeRequest(`/group/inviteCode/${instanceName}?groupId=${groupId}`, {}, instanceName);
  }

  async revokeGroupInviteCode(instanceName: string, groupId: string): Promise<{ inviteCode: string }> {
    return this.makeRequest(`/group/revokeInviteCode/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ groupId }),
    }, instanceName);
  }

  async updateGroupParticipant(instanceName: string, groupId: string, participantId: string, action: 'add' | 'remove' | 'promote' | 'demote'): Promise<{ success: boolean }> {
    return this.makeRequest(`/group/updateParticipant/${instanceName}`, {
      method: 'PUT',
      body: JSON.stringify({ groupId, participantId, action }),
    }, instanceName);
  }

  async leaveGroup(instanceName: string, groupId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/group/leaveGroup/${instanceName}`, {
      method: 'DELETE',
      body: JSON.stringify({ groupId }),
    }, instanceName);
  }

  async setWebhook(instanceName: string, webhookUrl: string, events: string[]): Promise<{ success: boolean }> {
    try {
      // Descobrir instanceId real
      const discovery = await this.makeRequest(`/api/v2/instance/find/${instanceName}`, {
        method: 'GET'
      }, instanceName);
      
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
      }, instanceName);
    } catch (error) {
      console.error(`❌ [YUMER-API] Erro ao configurar webhook:`, error);
      return { success: false };
    }
  }

  async getWebhook(instanceName: string): Promise<{ webhookUrl: string; events: string[] }> {
    return this.makeRequest(`/webhook/find/${instanceName}`, {}, instanceName);
  }

  async findS3Media(instanceName: string, mediaId: string): Promise<{ mediaUrl: string }> {
    return this.makeRequest(`/s3/findMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ mediaId }),
    }, instanceName);
  }

  async getS3MediaUrl(instanceName: string, mediaId: string): Promise<{ url: string }> {
    return this.makeRequest(`/s3/media/url/${mediaId}/${instanceName}`, {}, instanceName);
  }

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
