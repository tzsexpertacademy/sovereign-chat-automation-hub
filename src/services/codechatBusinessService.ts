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
}

export interface InstanceData {
  instanceName: string;
  owner: string;
  profileName?: string;
  status?: string;
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

  async createInstance(instanceName: string): Promise<InstanceData> {
    // Para compatibilidade - retornar dados mock
    return {
      instanceName,
      owner: 'legacy-owner',
      profileName: 'Legacy Profile',
      status: 'close'
    };
  }

  async connectInstance(instanceName: string): Promise<void> {
    // Para compatibilidade - não fazer nada
    console.log('[CodeChatBusinessService] Connect instance simulated:', instanceName);
  }

  async getQRCode(instanceName: string): Promise<string | null> {
    // Para compatibilidade - retornar null
    return null;
  }

  async deleteInstance(instanceName: string): Promise<void> {
    // Para compatibilidade - não fazer nada
    console.log('[CodeChatBusinessService] Delete instance simulated:', instanceName);
  }
}

export const codechatBusinessService = new CodeChatBusinessService();