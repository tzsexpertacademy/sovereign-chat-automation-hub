/**
 * Serviço Unificado Yumer API v2.2.1
 * Corrige CORS usando Authorization Bearer e centraliza toda funcionalidade
 */

import { serverConfigService } from './serverConfigService';

// ==================== TIPOS PRINCIPAIS ====================

export interface YumerInstance {
  id: number;
  instanceName: string;
  name: string;
  description?: string;
  connectionStatus: string;
  ownerJid?: string;
  profilePicUrl?: string;
  businessId?: string;
  Auth: {
    token: string;
    jwt?: string;
  };
}

export interface YumerBusiness {
  businessId: string;
  name: string;
  email: string;
  phone: string;
  slug: string;
  country: string;
  timezone: string;
  language: string;
  active: boolean;
  businessToken: string;
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
  remoteJid: string;
  name?: string;
  isGroup: boolean;
  lastMessage?: string;
  unreadCount: number;
}

export interface ConnectionState {
  instance: string;
  state: 'open' | 'close' | 'connecting';
}

export interface QRCodeResponse {
  qrcode: {
    instance: string;
    code: string;
  };
}

// ==================== CONFIGURAÇÕES ====================

interface RequestConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: RequestConfig = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000
};

// ==================== SERVIÇO UNIFICADO ====================

class UnifiedYumerService {
  private config = serverConfigService.getConfig();
  private requestConfig: RequestConfig = DEFAULT_CONFIG;

  // Configurações de autenticação multi-nível
  private getAuthHeaders(instanceJWT?: string): Record<string, string> {
    if (!this.config.globalApiKey && !instanceJWT) {
      console.warn('🔑 [UNIFIED-YUMER] API Key não configurada');
      return {};
    }

    const token = instanceJWT || this.config.globalApiKey;
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'authorization': `Bearer ${token}`
    };
  }

  // Request com retry e timeout
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    useRetry = true,
    instanceJWT?: string
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const url = `${this.config.serverUrl}${endpoint}`;
    let attempt = 0;
    
    const executeRequest = async (): Promise<{ success: boolean; data?: T; error?: string }> => {
      attempt++;
      
      try {
        console.log(`🌐 [UNIFIED-YUMER] ${options.method || 'GET'} ${endpoint} (tentativa ${attempt})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestConfig.timeout);

        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.getAuthHeaders(instanceJWT),
            ...options.headers
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [UNIFIED-YUMER] Erro HTTP ${response.status}:`, errorText);
          
          // Análise específica de erro
          if (response.status === 401) {
            throw new Error(`Token inválido ou expirado (${response.status})`);
          } else if (response.status === 403) {
            throw new Error(`Acesso negado - verifique permissões (${response.status})`);
          } else if (response.status === 404) {
            throw new Error(`Endpoint não encontrado (${response.status})`);
          } else {
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        }

        const data = await response.json();
        console.log(`✅ [UNIFIED-YUMER] Resposta recebida (${attempt}/${this.requestConfig.retries}):`, data);
        
        return { success: true, data };

      } catch (error: any) {
        console.error(`❌ [UNIFIED-YUMER] Erro na tentativa ${attempt}:`, error);
        
        // Retry lógico
        if (useRetry && attempt < this.requestConfig.retries && !error.name?.includes('AbortError')) {
          console.log(`🔄 [UNIFIED-YUMER] Tentando novamente em ${this.requestConfig.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.requestConfig.retryDelay));
          return executeRequest();
        }
        
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        };
      }
    };

    return executeRequest();
  }

  // ==================== HEALTH CHECK ====================
  
  async checkServerHealth(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const response = await fetch(`${this.config.serverUrl}/docs`, {
        method: 'GET',
        headers: { 'Accept': 'text/html' }
      });
      
      if (response.ok) {
        return { success: true, version: 'v2.2.1' };
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [UNIFIED-YUMER] Health check failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Server offline' 
      };
    }
  }

  // ==================== BUSINESS MANAGEMENT ====================
  
  async listBusinesses(): Promise<{ success: boolean; data?: YumerBusiness[]; error?: string }> {
    return this.makeRequest<YumerBusiness[]>('/api/v2/admin/business', {
      method: 'GET'
    });
  }

  async createBusiness(businessData: {
    name: string;
    email: string;
    phone: string;
    slug: string;
    country?: string;
    timezone?: string;
    language?: string;
  }): Promise<{ success: boolean; data?: YumerBusiness; error?: string }> {
    return this.makeRequest<YumerBusiness>('/api/v2/admin/business', {
      method: 'POST',
      body: JSON.stringify({
        ...businessData,
        country: businessData.country || 'BR',
        timezone: businessData.timezone || 'America/Sao_Paulo',
        language: businessData.language || 'pt-BR'
      })
    });
  }

  async deleteBusiness(businessId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      method: 'DELETE'
    });
  }

  // ==================== INSTANCE MANAGEMENT ====================
  
  async listBusinessInstances(businessId: string): Promise<{ success: boolean; data?: YumerInstance[]; error?: string }> {
    return this.makeRequest<YumerInstance[]>(`/api/v2/business/${businessId}/instance`, {
      method: 'GET'
    });
  }

  async createBusinessInstance(businessId: string, instanceData: {
    instanceName: string;
    qrcode?: boolean;
  }): Promise<{ success: boolean; data?: YumerInstance; error?: string }> {
    return this.makeRequest<YumerInstance>(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      body: JSON.stringify({
        ...instanceData,
        qrcode: instanceData.qrcode !== false
      })
    });
  }

  async getInstance(instanceId: string): Promise<{ success: boolean; data?: YumerInstance; error?: string }> {
    return this.makeRequest<YumerInstance>(`/api/v2/instance/${instanceId}`, {
      method: 'GET'
    });
  }

  async connectInstance(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; data?: YumerInstance; error?: string }> {
    return this.makeRequest<YumerInstance>(`/api/v2/instance/${instanceId}/connect`, {
      method: 'GET'
    }, true, instanceJWT);
  }

  async deleteInstance(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      method: 'DELETE'
    });
  }

  // ==================== CONNECTION & QR CODE ====================
  
  async getConnectionState(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; data?: ConnectionState; error?: string }> {
    return this.makeRequest<ConnectionState>(`/api/v2/instance/${instanceId}/connection-state`, {
      method: 'GET'
    }, true, instanceJWT);
  }

  async getQRCode(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; data?: QRCodeResponse; error?: string }> {
    return this.makeRequest<QRCodeResponse>(`/api/v2/instance/${instanceId}/qrcode`, {
      method: 'GET'
    }, true, instanceJWT);
  }

  // ==================== WEBHOOK MANAGEMENT ====================
  
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

    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      method: 'POST',
      body: JSON.stringify(webhookConfig)
    });
  }

  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      method: 'GET'
    });
  }

  // ==================== MESSAGING ====================
  
  async sendMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`📤 [UNIFIED-YUMER] Enviando mensagem para: ${chatId}`);

    // Garantir webhook configurado antes de enviar
    const webhookResult = await this.ensureWebhookConfigured(instanceId);
    if (!webhookResult.success) {
      console.warn(`⚠️ [UNIFIED-YUMER] Webhook não configurado:`, webhookResult.error);
    }

    return this.makeRequest(`/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      body: JSON.stringify({
        number: chatId,
        text: message
      })
    });
  }

  // ==================== CHAT MANAGEMENT ====================
  
  async getChats(instanceId: string): Promise<{ success: boolean; data?: YumerChat[]; error?: string }> {
    return this.makeRequest<YumerChat[]>(`/api/v2/instance/${instanceId}/chat/search/chats`, {
      method: 'GET'
    });
  }

  async getChatMessages(instanceId: string, chatId: string, options?: any): Promise<{ success: boolean; data?: YumerMessage[]; error?: string }> {
    const requestBody = {
      remoteJid: chatId,
      limit: options?.limit || 50,
      ...(options?.fromDate && {
        where: {
          messageTimestamp: {
            gte: Math.floor(new Date(options.fromDate).getTime() / 1000)
          }
        }
      })
    };

    return this.makeRequest<YumerMessage[]>(`/api/v2/instance/${instanceId}/chat/findMessages`, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
  }

  // ==================== UTILITIES ====================
  
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

  async testConnection(instanceId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.getConnectionState(instanceId);
    return {
      success: result.success,
      error: result.error
    };
  }

  // ==================== CONFIGURAÇÃO ====================
  
  setRequestConfig(config: Partial<RequestConfig>): void {
    this.requestConfig = { ...this.requestConfig, ...config };
  }

  getConfig(): RequestConfig {
    return { ...this.requestConfig };
  }
}

// ==================== INSTÂNCIA SINGLETON ====================

const unifiedYumerService = new UnifiedYumerService();

// ==================== EXPORTS ====================

export default unifiedYumerService;

// Compatibilidade com serviços antigos
export const yumerWhatsappService = {
  configureWebhook: (instanceId: string) => unifiedYumerService.configureWebhook(instanceId),
  getWebhookConfig: (instanceId: string) => unifiedYumerService.getWebhookConfig(instanceId),
  getChats: (instanceId: string) => unifiedYumerService.getChats(instanceId),
  getChatMessages: (instanceId: string, chatId: string, options?: any) => unifiedYumerService.getChatMessages(instanceId, chatId, options),
  sendMessage: (instanceId: string, chatId: string, message: string) => unifiedYumerService.sendMessage(instanceId, chatId, message),
  ensureWebhookConfigured: (instanceId: string) => unifiedYumerService.ensureWebhookConfigured(instanceId),
  testConnection: (instanceId: string) => unifiedYumerService.testConnection(instanceId)
};

export const yumerApiV2 = {
  checkServerHealth: () => unifiedYumerService.checkServerHealth(),
  listBusinesses: () => unifiedYumerService.listBusinesses(),
  createBusiness: (data: any) => unifiedYumerService.createBusiness(data),
  deleteBusiness: (id: string) => unifiedYumerService.deleteBusiness(id),
  listBusinessInstances: (businessId: string) => unifiedYumerService.listBusinessInstances(businessId),
  createBusinessInstance: (businessId: string, data: any) => unifiedYumerService.createBusinessInstance(businessId, data),
  getInstance: (instanceId: string) => unifiedYumerService.getInstance(instanceId),
  connectInstance: (instanceId: string) => unifiedYumerService.connectInstance(instanceId),
  deleteInstance: (instanceId: string) => unifiedYumerService.deleteInstance(instanceId),
  getConnectionState: (instanceId: string) => unifiedYumerService.getConnectionState(instanceId),
  getQRCode: (instanceId: string) => unifiedYumerService.getQRCode(instanceId)
};