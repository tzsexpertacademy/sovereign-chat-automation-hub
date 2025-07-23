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
}

export class CodeChatBusinessService {
  // Legacy compatibility methods
  async getAllBusinesses(): Promise<BusinessData[]> {
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
}

export const codechatBusinessService = new CodeChatBusinessService();