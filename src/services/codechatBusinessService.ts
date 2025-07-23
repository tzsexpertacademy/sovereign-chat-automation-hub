/**
 * LEGACY COMPATIBILITY SERVICE - CodeChat Business Service
 * Redirecionando para yumerApiV2Service
 */

import yumerApiV2 from './yumerApiV2Service';

export interface BusinessData {
  businessId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  businessToken: string;
}

export interface CreateBusinessRequest {
  name: string;
  email: string;
  phone: string;
  slug?: string;
  country?: string;
  timezone?: string;
  language?: string;
  active?: boolean;
}

export interface InstanceData {
  instanceName: string;
  instanceId: string;
  owner: string;
  profileName?: string;
  status?: string;
  state?: string;
  connection?: 'connected' | 'disconnected' | 'connecting' | 'qr_ready';
  name?: string;
  Auth?: {
    apikey: string;
    jwt?: string;
  };
}

export interface BusinessWithInstances {
  businessId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  businessToken: string;
  instances: InstanceData[];
}

export class CodeChatBusinessService {
  // Legacy compatibility methods
  async getAllBusinesses(): Promise<BusinessData[]> {
    // Para compatibilidade - retornar array vazio
    return [];
  }

  async getInstancesByBusiness(businessId: string): Promise<InstanceData[]> {
    // Para compatibilidade - retornar array vazio
    return [];
  }

  async createBusiness(data: CreateBusinessRequest): Promise<BusinessData> {
    // Para compatibilidade - retornar dados mock
    return {
      businessId: 'legacy-compat',
      name: data.name,
      email: data.email,
      phone: data.phone,
      active: true,
      businessToken: 'legacy-token'
    };
  }

  async createInstance(businessToken: string, instanceName?: string): Promise<InstanceData> {
    // Para compatibilidade - retornar dados mock
    return {
      instanceName: instanceName || 'new-instance',
      instanceId: instanceName || 'new-instance',
      owner: 'legacy-owner',
      profileName: 'Legacy Profile',
      status: 'close',
      name: instanceName || 'new-instance',
      Auth: {
        apikey: 'legacy-api-key',
        jwt: 'legacy-jwt-token'
      }
    };
  }

  async connectInstance(jwt: string, instanceName: string): Promise<void> {
    // Para compatibilidade - não fazer nada
    console.log('[CodeChatBusinessService] Connect instance simulated:', instanceName);
  }

  async getQRCode(jwt: string, instanceName: string): Promise<string | null> {
    // Para compatibilidade - retornar null
    return null;
  }

  async deleteInstance(businessToken: string, instanceName: string): Promise<void> {
    // Para compatibilidade - não fazer nada
    console.log('[CodeChatBusinessService] Delete instance simulated:', instanceName);
  }
}

export const codechatBusinessService = new CodeChatBusinessService();