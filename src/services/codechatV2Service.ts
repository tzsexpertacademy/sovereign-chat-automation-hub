import { serverConfigService } from './serverConfigService';
import { supabase } from '@/integrations/supabase/client';

// Types for CodeChat API v2.1.3
export interface BusinessData {
  id: string;
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
  country?: string;
  timezone?: string;
  language?: string;
  active?: boolean;
}

export interface InstanceData {
  id: string;
  instanceId: string;
  name: string;
  state: 'active' | 'inactive';
  connection: 'open' | 'close' | 'connecting';
  proxy?: string;
  createdAt: string;
  deletedAt?: string;
  businessBusinessId: string;
  Auth: {
    id: string;
    jwt: string;
    createdAt: string;
    updatedAt?: string;
  };
}

export interface MessageData {
  number: string;
  text?: string;
  media?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  caption?: string;
  delay?: number;
  presence?: 'composing' | 'recording' | 'paused';
}

class CodeChatV2Service {
  private config = serverConfigService.getConfig();

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${serverConfigService.getApiUrl()}/${endpoint.replace(/^\//, '')}`;
    
    try {
      console.log(`🔥 [CODECHAT-V2] ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
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
  async createBusiness(businessData: CreateBusinessRequest, adminToken?: string): Promise<BusinessData> {
    console.log(`🏢 [CODECHAT-V2] Criando business: ${businessData.name}`);
    
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    return this.makeRequest('api/v2/admin/business', {
      method: 'POST',
      headers,
      body: JSON.stringify(businessData)
    });
  }

  async getBusiness(businessId: string, adminToken?: string): Promise<BusinessData> {
    console.log(`📋 [CODECHAT-V2] Buscando business: ${businessId}`);
    
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    return this.makeRequest(`api/v2/admin/business/${businessId}`, { headers });
  }

  async getAllBusinesses(adminToken?: string): Promise<BusinessData[]> {
    console.log(`📋 [CODECHAT-V2] Buscando todos os businesses`);
    
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    return this.makeRequest('api/v2/admin/business', { headers });
  }

  async updateBusiness(businessId: string, updates: Partial<CreateBusinessRequest>, adminToken?: string): Promise<BusinessData> {
    console.log(`🔄 [CODECHAT-V2] Atualizando business: ${businessId}`);
    
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    return this.makeRequest(`api/v2/admin/business/${businessId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });
  }

  async deleteBusiness(businessId: string, adminToken?: string): Promise<void> {
    console.log(`🗑️ [CODECHAT-V2] Deletando business: ${businessId}`);
    
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    return this.makeRequest(`api/v2/admin/business/${businessId}`, {
      method: 'DELETE',
      headers
    });
  }

  // Instance Management
  async createInstance(businessToken: string, instanceName?: string): Promise<InstanceData> {
    console.log(`📱 [CODECHAT-V2] Criando instância com business token`);
    
    return this.makeRequest('api/v2/instance/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`
      },
      body: JSON.stringify({
        name: instanceName || `instance_${Date.now()}`
      })
    });
  }

  async getInstancesByBusiness(businessToken: string): Promise<InstanceData[]> {
    console.log(`📋 [CODECHAT-V2] Buscando instâncias do business`);
    
    return this.makeRequest('api/v2/instance', {
      headers: {
        'Authorization': `Bearer ${businessToken}`
      }
    });
  }

  async getInstanceDetails(instanceJWT: string, instanceId: string): Promise<InstanceData> {
    console.log(`📋 [CODECHAT-V2] Buscando detalhes da instância: ${instanceId}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}`, {
      headers: {
        'Authorization': `Bearer ${instanceJWT}`
      }
    });
  }

  async deleteInstance(businessToken: string, instanceId: string): Promise<void> {
    console.log(`🗑️ [CODECHAT-V2] Deletando instância: ${instanceId}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${businessToken}`
      }
    });
  }

  // Connection Management
  async connectInstance(instanceJWT: string, instanceId: string) {
    console.log(`🔌 [CODECHAT-V2] Conectando instância: ${instanceId}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instanceJWT}`
      }
    });
  }

  async getQRCode(instanceJWT: string, instanceId: string) {
    console.log(`📱 [CODECHAT-V2] Buscando QR Code: ${instanceId}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}/qrcode`, {
      headers: {
        'Authorization': `Bearer ${instanceJWT}`
      }
    });
  }

  async getConnectionStatus(instanceJWT: string, instanceId: string) {
    console.log(`📊 [CODECHAT-V2] Verificando status: ${instanceId}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}/status`, {
      headers: {
        'Authorization': `Bearer ${instanceJWT}`
      }
    });
  }

  // Messaging
  async sendTextMessage(instanceJWT: string, instanceId: string, messageData: MessageData) {
    console.log(`📤 [CODECHAT-V2] Enviando mensagem: ${instanceId} -> ${messageData.number}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}/message/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instanceJWT}`
      },
      body: JSON.stringify({
        number: messageData.number,
        text: messageData.text,
        options: {
          delay: messageData.delay,
          presence: messageData.presence
        }
      })
    });
  }

  async sendMediaMessage(instanceJWT: string, instanceId: string, messageData: MessageData) {
    console.log(`📤 [CODECHAT-V2] Enviando mídia: ${instanceId} -> ${messageData.number}`);
    
    return this.makeRequest(`api/v2/instance/${instanceId}/message/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instanceJWT}`
      },
      body: JSON.stringify({
        number: messageData.number,
        mediaMessage: {
          mediatype: messageData.mediaType,
          media: messageData.media,
          caption: messageData.caption
        },
        options: {
          delay: messageData.delay,
          presence: messageData.presence
        }
      })
    });
  }

  // Sync with Supabase
  async syncBusinessToSupabase(businessData: BusinessData, clientId: string) {
    console.log(`🔄 [SYNC] Sincronizando business para Supabase: ${businessData.businessId}`);
    
    const { data, error } = await supabase
      .from('codechat_businesses')
      .upsert({
        business_id: businessData.businessId,
        name: businessData.name,
        slug: businessData.slug,
        email: businessData.email,
        phone: businessData.phone,
        country: businessData.country,
        timezone: businessData.timezone,
        language: businessData.language,
        active: businessData.active,
        business_token: businessData.businessToken,
        client_id: clientId
      }, { 
        onConflict: 'business_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [SYNC] Erro ao sincronizar business:', error);
      throw error;
    }

    console.log('✅ [SYNC] Business sincronizado:', data);
    return data;
  }

  async syncInstanceToSupabase(instanceData: InstanceData, businessSupabaseId: string, clientId: string) {
    console.log(`🔄 [SYNC] Sincronizando instância para Supabase: ${instanceData.instanceId}`);
    
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .upsert({
        instance_id: instanceData.instanceId,
        codechat_instance_name: instanceData.name,
        status: instanceData.connection === 'open' ? 'connected' : 'disconnected',
        connection_state: instanceData.connection,
        codechat_business_id: businessSupabaseId,
        business_business_id: instanceData.businessBusinessId,
        auth_jwt: instanceData.Auth?.jwt,
        api_version: 'v2.1.3',
        client_id: clientId
      }, { 
        onConflict: 'instance_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [SYNC] Erro ao sincronizar instância:', error);
      throw error;
    }

    // Salvar JWT token se existe
    if (instanceData.Auth?.jwt) {
      await this.saveInstanceJWT(data.id, instanceData.Auth.jwt);
    }

    console.log('✅ [SYNC] Instância sincronizada:', data);
    return data;
  }

  async saveInstanceJWT(instanceSupabaseId: string, jwt: string) {
    console.log(`🔑 [JWT] Salvando token para instância: ${instanceSupabaseId}`);
    
    const { data, error } = await supabase
      .from('codechat_instance_tokens')
      .upsert({
        instance_id: instanceSupabaseId,
        jwt_token: jwt
      }, { 
        onConflict: 'instance_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [JWT] Erro ao salvar token:', error);
      throw error;
    }

    console.log('✅ [JWT] Token salvo:', data);
    return data;
  }
}

export const codechatV2Service = new CodeChatV2Service();