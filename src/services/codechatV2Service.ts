// CodeChat API v2.1.3 Service - Nova Arquitetura Business/Instance
import { serverConfigService } from './serverConfigService';

// Tipos para CodeChat API v2.1.3
export interface BusinessData {
  businessId: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  country: string;
  timezone: string;
  language: string;
  active: boolean;
  businessToken: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface InstanceData {
  instanceId: string;
  name: string;
  state: string;
  connection: string;
  proxy?: string;
  createdAt: string;
  deletedAt?: string;
  businessBusinessId: string;
  Auth: {
    authId: string;
    jwt: string;
    createdAt: string;
    updatedAt?: string;
  };
}

export interface QRCodeResponse {
  count: number;
  base64: string;
  code: string;
}

// Service para CodeChat API v2.1.3
class CodeChatV2Service {
  private config = serverConfigService.getConfig();
  
  private getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.globalApiKey}`,
    };
  }

  private getBusinessHeaders(businessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`,
    };
  }

  private getInstanceHeaders(instanceJWT: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${instanceJWT}`,
    };
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = `${this.config.serverUrl}${endpoint}`;
    
    try {
      console.log(`🌐 [CODECHAT-V2] ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.requestTimeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT-V2] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-V2] Resposta recebida:`, data);
      
      return { success: true, data };
    } catch (error) {
      console.error(`❌ [CODECHAT-V2] Erro na requisição para ${endpoint}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // ADMINISTRAÇÃO - Criar Business
  async createBusiness(businessData: {
    name: string;
    slug: string;
    email: string;
    phone: string;
    country?: string;
    timezone?: string;
    language?: string;
    active?: boolean;
  }): Promise<{ success: boolean; data?: BusinessData; error?: string }> {
    const payload = {
      name: businessData.name,
      slug: businessData.slug,
      email: businessData.email,
      phone: businessData.phone,
      country: businessData.country || 'BR',
      timezone: businessData.timezone || 'America/Sao_Paulo',
      language: businessData.language || 'pt-BR',
      active: businessData.active !== false
    };

    return this.makeRequest('/api/v2/admin/business', {
      method: 'POST',
      headers: this.getAdminHeaders(),
      body: JSON.stringify(payload)
    });
  }

  // BUSINESS - Criar Instância
  async createInstance(businessToken: string, instanceName?: string): Promise<{ success: boolean; data?: InstanceData; error?: string }> {
    const payload = instanceName ? { name: instanceName } : {};

    return this.makeRequest('/api/v2/business/instance/create', {
      method: 'POST',
      headers: this.getBusinessHeaders(businessToken),
      body: JSON.stringify(payload)
    });
  }

  // INSTANCE - Conectar
  async connectInstance(instanceJWT: string): Promise<{ success: boolean; data?: QRCodeResponse; error?: string }> {
    return this.makeRequest('/api/v2/instance/connect', {
      method: 'GET',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // INSTANCE - Status da Conexão
  async getConnectionState(instanceJWT: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest('/api/v2/instance/connectionState', {
      method: 'GET',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // INSTANCE - Buscar Detalhes
  async fetchInstance(instanceJWT: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest('/api/v2/instance/fetchInstance', {
      method: 'GET',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // INSTANCE - Enviar Mensagem
  async sendTextMessage(instanceJWT: string, messageData: {
    number: string;
    text: string;
    options?: {
      delay?: number;
      presence?: string;
    };
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const payload = {
      number: messageData.number,
      options: {
        delay: messageData.options?.delay || 1200,
        presence: messageData.options?.presence || 'composing',
        ...messageData.options
      },
      textMessage: {
        text: messageData.text
      }
    };

    return this.makeRequest('/api/v2/instance/message/sendText', {
      method: 'POST',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(payload)
    });
  }

  // INSTANCE - Configurar Webhook
  async setWebhook(instanceJWT: string, webhookConfig: {
    enabled: boolean;
    url: string;
    events?: any;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const payload = {
      enabled: webhookConfig.enabled,
      url: webhookConfig.url,
      events: webhookConfig.events || {
        qrcodeUpdated: true,
        messagesUpsert: true,
        messagesUpdated: true,
        sendMessage: true,
        contactsUpsert: true,
        contactsUpdated: true,
        chatsUpsert: true,
        chatsUpdated: true,
        chatsDeleted: true,
        connectionUpdated: true,
        statusInstance: true,
      }
    };

    return this.makeRequest('/api/v2/instance/webhook/set', {
      method: 'PUT',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(payload)
    });
  }

  // INSTANCE - Buscar Chats
  async findChats(instanceJWT: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return this.makeRequest('/api/v2/instance/chat/findChats', {
      method: 'GET',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // INSTANCE - Buscar Mensagens
  async findMessages(instanceJWT: string, searchCriteria: any): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest('/api/v2/instance/chat/findMessages', {
      method: 'POST',
      headers: this.getInstanceHeaders(instanceJWT),
      body: JSON.stringify(searchCriteria)
    });
  }

  // INSTANCE - Deletar
  async deleteInstance(instanceJWT: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest('/api/v2/instance/delete', {
      method: 'DELETE',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // INSTANCE - Logout
  async logoutInstance(instanceJWT: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest('/api/v2/instance/logout', {
      method: 'DELETE',
      headers: this.getInstanceHeaders(instanceJWT)
    });
  }

  // HEALTH CHECK
  async healthCheck(): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest('/health', {
      method: 'GET'
    });
  }

  // TEST CONNECTION
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const result = await this.healthCheck();
      const latency = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ [CODECHAT-V2] Conexão OK - Latência: ${latency}ms`);
        return { success: true, latency };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`❌ [CODECHAT-V2] Teste de conexão falhou:`, error);
      return { 
        success: false, 
        latency,
        error: error instanceof Error ? error.message : 'Erro de conexão' 
      };
    }
  }
}

// Instância única do service
const codeChatV2Service = new CodeChatV2Service();

export { codeChatV2Service };
export default codeChatV2Service;