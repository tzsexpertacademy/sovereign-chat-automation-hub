
import { serverConfigService } from './serverConfigService';

// Types for CodeChat API v2.1.3
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

export interface CreateBusinessRequest {
  name: string;
  slug: string;
  email: string;
  phone: string;
  country: string;
  timezone: string;
  language: string;
  active: boolean;
}

export interface InstanceData {
  instanceId: string;
  name: string;
  state: 'active' | 'inactive';
  connection: 'open' | 'close' | 'connecting';
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

class CodeChatBusinessService {
  private config = serverConfigService.getConfig();

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.serverUrl}${endpoint}`;
    
    try {
      console.log(`🔥 [CODECHAT-V2] ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...serverConfigService.getAdminHeaders(),
          ...options.headers
        },
        signal: AbortSignal.timeout(this.config.requestTimeout)
      });

      console.log(`📊 [CODECHAT-V2] Response: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        console.error(`❌ [CODECHAT-V2] Error ${response.status}:`, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Request failed'}`);
      }

      const data = await response.json();
      console.log(`✅ [CODECHAT-V2] Success:`, data);
      return data;

    } catch (error: any) {
      console.error(`❌ [CODECHAT-V2] Request failed:`, error);
      throw error;
    }
  }

  // Business Management
  async createBusiness(businessData: CreateBusinessRequest): Promise<BusinessData> {
    console.log(`🏢 [CODECHAT-V2] Criando business: ${businessData.name}`);
    
    return this.makeRequest('/api/v2/admin/business', {
      method: 'POST',
      body: JSON.stringify(businessData)
    });
  }

  async getBusiness(businessId: string): Promise<BusinessData> {
    console.log(`📋 [CODECHAT-V2] Buscando business: ${businessId}`);
    
    return this.makeRequest(`/api/v2/admin/business/${businessId}`);
  }

  async getAllBusinesses(): Promise<BusinessData[]> {
    console.log(`📋 [CODECHAT-V2] Buscando todos os businesses`);
    
    return this.makeRequest('/api/v2/admin/business');
  }

  async updateBusiness(businessId: string, updates: Partial<CreateBusinessRequest>): Promise<BusinessData> {
    console.log(`🔄 [CODECHAT-V2] Atualizando business: ${businessId}`);
    
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteBusiness(businessId: string): Promise<void> {
    console.log(`🗑️ [CODECHAT-V2] Deletando business: ${businessId}`);
    
    return this.makeRequest(`/api/v2/admin/business/${businessId}`, {
      method: 'DELETE'
    });
  }

  // Instance Management (requires Business Token)
  async createInstance(businessToken: string, instanceName?: string): Promise<InstanceData> {
    console.log(`📱 [CODECHAT-V2] Criando instância com business token`);
    
    const headers = serverConfigService.getBusinessHeaders(businessToken);
    
    return this.makeRequest('/api/v2/instance/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: instanceName || `instance_${Date.now()}`
      })
    });
  }

  async getInstancesByBusiness(businessToken: string): Promise<InstanceData[]> {
    console.log(`📋 [CODECHAT-V2] Buscando instâncias do business`);
    
    const headers = serverConfigService.getBusinessHeaders(businessToken);
    
    return this.makeRequest('/api/v2/instance', {
      headers
    });
  }

  async getInstanceDetails(businessToken: string, instanceId: string): Promise<InstanceData> {
    console.log(`📋 [CODECHAT-V2] Buscando detalhes da instância: ${instanceId}`);
    
    const headers = serverConfigService.getBusinessHeaders(businessToken);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      headers
    });
  }

  async deleteInstance(businessToken: string, instanceId: string): Promise<void> {
    console.log(`🗑️ [CODECHAT-V2] Deletando instância: ${instanceId}`);
    
    const headers = serverConfigService.getBusinessHeaders(businessToken);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      method: 'DELETE',
      headers
    });
  }

  // Connection Management
  async connectInstance(instanceJWT: string, instanceId: string) {
    console.log(`🔌 [CODECHAT-V2] Conectando instância: ${instanceId}`);
    
    const headers = serverConfigService.getInstanceHeaders(instanceJWT);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/connect`, {
      method: 'POST',
      headers
    });
  }

  async getQRCode(instanceJWT: string, instanceId: string) {
    console.log(`📱 [CODECHAT-V2] Buscando QR Code: ${instanceId}`);
    
    const headers = serverConfigService.getInstanceHeaders(instanceJWT);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/qrcode`, {
      headers
    });
  }

  async getConnectionStatus(instanceJWT: string, instanceId: string) {
    console.log(`📊 [CODECHAT-V2] Verificando status: ${instanceId}`);
    
    const headers = serverConfigService.getInstanceHeaders(instanceJWT);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/status`, {
      headers
    });
  }

  // Messaging
  async sendTextMessage(instanceJWT: string, instanceId: string, to: string, message: string) {
    console.log(`📤 [CODECHAT-V2] Enviando mensagem: ${instanceId} -> ${to}`);
    
    const headers = serverConfigService.getInstanceHeaders(instanceJWT);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/message/text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: to,
        text: message
      })
    });
  }
}

export const codechatBusinessService = new CodeChatBusinessService();
