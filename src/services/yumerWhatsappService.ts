import { serverConfigService } from './serverConfigService';

// Tipos do Yumer API
export interface YumerInstance {
  id: number;
  name: string;
  description?: string;
  connectionStatus: string;
  ownerJid?: string;
  profilePicUrl?: string;
  Auth: {
    token: string;
  };
}

export interface YumerMessage {
  id: number;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  messageType: string;
  content: any;
  messageTimestamp: number;
  device: string;
}

export interface YumerChat {
  id: string;
  name?: string;
  isGroup: boolean;
  lastMessage?: string;
  unreadCount: number;
}

// Service centralizado para API Yumer
class YumerApiService {
  private config = serverConfigService.getConfig();
  
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.globalApiKey}`,
      'apikey': this.config.globalApiKey
    };
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = `${this.config.serverUrl}${endpoint}`;
    
    try {
      console.log(`🌐 [YUMER-API] ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.requestTimeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YUMER-API] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ [YUMER-API] Resposta recebida:`, data);
      
      return { success: true, data };
    } catch (error) {
      console.error(`❌ [YUMER-API] Erro na requisição para ${endpoint}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // Configurar webhook automaticamente
  async configureWebhook(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const webhookConfig = {
      enabled: true,
      url: this.config.adminWebhooks.messageWebhook.url,
      events: {
        qrcodeUpdated: true,
        messagesSet: false,
        messagesUpsert: true,
        messagesUpdated: true,
        sendMessage: true,
        contactsSet: true,
        contactsUpsert: true,
        contactsUpdated: true,
        chatsSet: false,
        chatsUpsert: true,
        chatsUpdated: true,
        chatsDeleted: true,
        presenceUpdated: true,
        groupsUpsert: true,
        groupsUpdated: true,
        groupsParticipantsUpdated: true,
        connectionUpdated: true,
        statusInstance: true,
        refreshToken: true
      }
    };

    return this.makeRequest(`/webhook/set/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify(webhookConfig)
    });
  }

  // Obter configuração do webhook
  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest(`/webhook/find/${instanceId}`, {
      method: 'GET'
    });
  }

  // Obter chats
  async getChats(instanceId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return this.makeRequest(`/chat/findChats/${instanceId}`, {
      method: 'GET'
    });
  }

  // Obter mensagens do chat
  async getChatMessages(instanceId: string, chatId: string, options?: any): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const requestBody = {
      where: {
        keyRemoteJid: chatId
      },
      limit: options?.limit || 50,
      ...(options?.fromDate && {
        where: {
          ...{ keyRemoteJid: chatId },
          messageTimestamp: {
            gte: Math.floor(new Date(options.fromDate).getTime() / 1000)
          }
        }
      })
    };

    const result = await this.makeRequest(`/chat/findMessages/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    if (result.success && result.data) {
      // Extrair mensagens da resposta
      const messages = result.data?.messages?.records || [];
      return { success: true, data: messages };
    }

    return result;
  }

  // Enviar mensagem com retry automático
  async sendMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const messagePayload = {
      number: chatId,
      options: {
        delay: 1200,
        presence: 'composing'
      },
      textMessage: {
        text: message
      }
    };

    console.log(`📤 [YUMER-SEND] Enviando mensagem para: ${chatId}`, messagePayload);

    // Tentar configurar webhook automaticamente antes de enviar
    console.log(`🔧 [YUMER-SEND] Verificando webhook para instância: ${instanceId}`);
    const webhookResult = await this.ensureWebhookConfigured(instanceId);
    if (!webhookResult.success) {
      console.warn(`⚠️ [YUMER-SEND] Webhook não configurado corretamente:`, webhookResult.error);
    }

    return this.makeRequest(`/message/sendText/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify(messagePayload)
    });
  }

  // Garantir que webhook está configurado
  async ensureWebhookConfigured(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar se webhook já está configurado
      const configResult = await this.getWebhookConfig(instanceId);
      
      if (configResult.success && configResult.data?.enabled) {
        console.log(`✅ [WEBHOOK] Webhook já configurado para: ${instanceId}`);
        return { success: true };
      }

      // Configurar webhook se necessário
      console.log(`🔧 [WEBHOOK] Configurando webhook para: ${instanceId}`);
      const setupResult = await this.configureWebhook(instanceId);
      
      if (setupResult.success) {
        console.log(`✅ [WEBHOOK] Webhook configurado com sucesso para: ${instanceId}`);
        return { success: true };
      }

      return { success: false, error: setupResult.error };
    } catch (error) {
      console.error(`❌ [WEBHOOK] Erro ao garantir configuração:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao configurar webhook' 
      };
    }
  }

  // Testar conexão com instância
  async testConnection(instanceId: string): Promise<{ success: boolean; error?: string }> {
    return this.makeRequest(`/instance/connectionState/${instanceId}`, {
      method: 'GET'
    });
  }
}

// Instância única do service
const yumerApiService = new YumerApiService();

// Export do objeto para compatibilidade
export const yumerWhatsappService = {
  configureWebhook: (instanceId: string, config?: any) => yumerApiService.configureWebhook(instanceId),
  getWebhookConfig: (instanceId: string) => yumerApiService.getWebhookConfig(instanceId),
  getChats: (instanceId: string) => yumerApiService.getChats(instanceId),
  getChatMessages: (instanceId: string, chatId: string, options?: any) => yumerApiService.getChatMessages(instanceId, chatId, options),
  sendMessage: (instanceId: string, chatId: string, message: string) => yumerApiService.sendMessage(instanceId, chatId, message),
  ensureWebhookConfigured: (instanceId: string) => yumerApiService.ensureWebhookConfigured(instanceId),
  testConnection: (instanceId: string) => yumerApiService.testConnection(instanceId)
};

export default yumerApiService;