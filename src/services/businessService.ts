/**
 * Business Service - Gerenciamento de Businesses e suas Instâncias
 * Implementa todos os endpoints da API Yumer v2.2.1
 */

import unifiedYumerService from './unifiedYumerService';

export interface BusinessData {
  businessId: string;
  name: string;
  businessToken: string;
  attributes?: any;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  BusinessWebhook?: {
    webhookId: string;
    url: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
  Instance?: InstanceData[];
  instances?: number;
  connectedInstances?: number;
}

export interface InstanceData {
  instanceId: string;
  name: string;
  state: 'active' | 'inactive';
  connection: 'open' | 'close' | 'refused';
  createdAt: string;
  deletedAt?: string;
  businessBusinessId: string;
  Auth?: {
    authId: string;
    jwt: string;
    createdAt: string;
    updatedAt: string;
  };
  WhatsApp?: {
    whatsappId: string;
    remoteJid: string;
    pictureUrl?: string;
    pushName?: string;
    createdAt: string;
  };
  Webhook?: WebhookData[];
}

export interface WebhookData {
  name: string;
  url: string;
  enabled: boolean;
  headers: Record<string, any>;
  webhookId: string;
  createdAt: string;
  updatedAt: string;
  instanceInstanceId: string;
  WebhookEvents: {
    qrcodeUpdate: boolean;
    stateInstance: boolean;
    messagesSet: boolean;
    messagesUpsert: boolean;
    messagesUpdate: boolean;
    sendMessage: boolean;
    contactsSet: boolean;
    contactsUpsert: boolean;
    contactsUpdate: boolean;
    presenceUpdate: boolean;
    chatsSet: boolean;
    chatsUpdate: boolean;
    chatsUpsert: boolean;
    groupsUpsert: boolean;
    groupUpdate: boolean;
    groupParticipantsUpdate: boolean;
    connectionUpdate: boolean;
    callUpsert: boolean;
    labelAssociation: boolean;
    labelEdit: boolean;
    webhookEventsId: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface SearchInstancesParams {
  instanceId?: string;
  name?: string;
  state?: 'active' | 'inactive';
  connection?: 'open' | 'close' | 'refused';
  page?: number;
}

export interface BusinessInstancesResponse {
  businessId: string;
  name: string;
  businessToken: string;
  attributes: any;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  BusinessWebhook: WebhookData;
  BusinessPage: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    records: InstanceData[];
  };
}

class BusinessService {
  
  // ==================== ADMIN BUSINESS MANAGEMENT ====================
  
  /**
   * Lista todos os businesses (Admin)
   */
  async getAllBusinesses(): Promise<BusinessData[]> {
    try {
      const result = await unifiedYumerService.listBusinesses();
      if (result.success && result.data) {
        return result.data.map(business => ({
          businessId: business.businessId,
          name: business.name,
          businessToken: business.businessToken,
          attributes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          instances: 0,
          connectedInstances: 0
        }));
      }
      throw new Error(result.error || 'Erro ao listar businesses');
    } catch (error) {
      console.error('Erro ao buscar businesses:', error);
      throw error;
    }
  }

  /**
   * Cria um novo business (Admin)
   */
  async createBusiness(businessData: {
    name: string;
    attributes?: any;
  }): Promise<BusinessData> {
    try {
      // Gerar dados necessários para criar business
      const slug = this.generateSlug(businessData.name);
      const email = `${slug}@codechat.app`;
      const phone = `+55119${Math.floor(Math.random() * 90000000) + 10000000}`;

      const result = await unifiedYumerService.createBusiness({
        name: businessData.name,
        email,
        phone,
        slug,
        country: 'BR',
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR'
      });

      if (result.success && result.data) {
        return {
          businessId: result.data.businessId,
          name: result.data.name,
          businessToken: result.data.businessToken,
          attributes: businessData.attributes || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          instances: 0,
          connectedInstances: 0
        };
      }
      throw new Error(result.error || 'Erro ao criar business');
    } catch (error) {
      console.error('Erro ao criar business:', error);
      throw error;
    }
  }

  /**
   * Atualiza um business (Admin)
   */
  async updateBusiness(businessId: string, updates: {
    name?: string;
    attributes?: any;
  }): Promise<BusinessData> {
    try {
      // TODO: Implementar endpoint PUT /api/v2/business/{businessId}
      console.log('Atualizando business:', businessId, updates);
      throw new Error('Endpoint de atualização não implementado');
    } catch (error) {
      console.error('Erro ao atualizar business:', error);
      throw error;
    }
  }

  /**
   * Remove um business (Admin)
   */
  async deleteBusiness(businessId: string, force = false): Promise<void> {
    try {
      const result = await unifiedYumerService.deleteBusiness(businessId);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao deletar business');
      }
    } catch (error) {
      console.error('Erro ao deletar business:', error);
      throw error;
    }
  }

  /**
   * Refresh token de um business (Admin)
   */
  async refreshBusinessToken(businessId: string, oldToken: string): Promise<{ newToken: string }> {
    try {
      // TODO: Implementar endpoint PATCH /api/v2/admin/business/{businessId}/refresh-token
      console.log('Refresh token business:', businessId, oldToken);
      throw new Error('Endpoint de refresh token não implementado');
    } catch (error) {
      console.error('Erro ao fazer refresh token business:', error);
      throw error;
    }
  }

  // ==================== BUSINESS INSTANCE MANAGEMENT ====================

  /**
   * Obtém um business específico com suas instâncias
   */
  async getBusiness(businessId: string): Promise<BusinessData> {
    try {
      // TODO: Implementar endpoint GET /api/v2/business/{businessId}
      console.log('Buscando business:', businessId);
      throw new Error('Endpoint de busca de business não implementado');
    } catch (error) {
      console.error('Erro ao buscar business:', error);
      throw error;
    }
  }

  /**
   * Cria uma nova instância em um business
   */
  async createInstance(businessId: string, instanceData?: {
    instanceName?: string;
    externalId?: string;
  }): Promise<InstanceData> {
    try {
      const result = await unifiedYumerService.createBusinessInstance(businessId, instanceData);
      if (result.success && result.data) {
        return {
          instanceId: result.data.instanceId || result.data.id?.toString() || '',
          name: result.data.name,
          state: (result.data.state as 'active' | 'inactive') || 'inactive',
          connection: (result.data.connection as 'open' | 'close' | 'refused') || 'close',
          createdAt: new Date().toISOString(),
          businessBusinessId: businessId,
          Auth: result.data.Auth ? {
            authId: result.data.Auth.token || '',
            jwt: result.data.Auth.jwt || result.data.Auth.token || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } : undefined,
          WhatsApp: result.data.WhatsApp ? {
            ...result.data.WhatsApp,
            createdAt: result.data.WhatsApp.createdAt || new Date().toISOString()
          } : undefined
        };
      }
      throw new Error(result.error || 'Erro ao criar instância');
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      throw error;
    }
  }

  /**
   * Remove uma instância de um business
   */
  async deleteInstance(businessId: string, instanceId: string, force = false): Promise<void> {
    try {
      // TODO: Implementar endpoint DELETE /api/v2/business/{businessId}/instance
      console.log('Deletando instância:', businessId, instanceId, force);
      throw new Error('Endpoint de remoção de instância não implementado');
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      throw error;
    }
  }

  /**
   * Refresh token de uma instância
   */
  async refreshInstanceToken(businessId: string, instanceId: string, oldToken: string): Promise<{ newToken: string }> {
    try {
      const result = await unifiedYumerService.refreshInstanceToken(businessId, instanceId, oldToken);
      if (result.success && result.newToken) {
        return { newToken: result.newToken };
      }
      throw new Error(result.error || 'Erro ao fazer refresh token');
    } catch (error) {
      console.error('Erro ao fazer refresh token instância:', error);
      throw error;
    }
  }

  /**
   * Ativa/desativa uma instância
   */
  async toggleInstanceActivation(businessId: string, instanceId: string, action: 'activate' | 'deactivate'): Promise<{
    instanceId: string;
    state: string;
    activate: boolean;
  }> {
    try {
      const result = await unifiedYumerService.toggleActivate(businessId, instanceId, action);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || 'Erro ao alterar status da instância');
    } catch (error) {
      console.error('Erro ao alterar status da instância:', error);
      throw error;
    }
  }

  /**
   * Lista apenas instâncias conectadas de um business
   */
  async getConnectedInstances(businessId: string): Promise<InstanceData[]> {
    try {
      // TODO: Implementar endpoint GET /api/v2/business/{businessId}/instance/connected
      console.log('Buscando instâncias conectadas:', businessId);
      throw new Error('Endpoint de instâncias conectadas não implementado');
    } catch (error) {
      console.error('Erro ao buscar instâncias conectadas:', error);
      throw error;
    }
  }

  /**
   * Busca instâncias com filtros e paginação
   */
  async searchInstances(businessId: string, params: SearchInstancesParams): Promise<BusinessInstancesResponse> {
    try {
      // TODO: Implementar endpoint POST /api/v2/business/{businessId}/instance/search
      console.log('Buscando instâncias:', businessId, params);
      throw new Error('Endpoint de busca de instâncias não implementado');
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      throw error;
    }
  }

  /**
   * Move número WhatsApp entre instâncias
   */
  async moveWhatsApp(businessId: string, sourceWhatsAppId: string, instanceIdTarget: string): Promise<InstanceData> {
    try {
      // TODO: Implementar endpoint PATCH /api/v2/business/{businessId}/instance/move-whatsapp
      console.log('Movendo WhatsApp:', businessId, sourceWhatsAppId, instanceIdTarget);
      throw new Error('Endpoint de mover WhatsApp não implementado');
    } catch (error) {
      console.error('Erro ao mover WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Move instância entre businesses (Admin)
   */
  async moveInstance(sourceInstanceId: string, businessIdTarget: string): Promise<BusinessData> {
    try {
      // TODO: Implementar endpoint PATCH /api/v2/admin/business/move-instance
      console.log('Movendo instância:', sourceInstanceId, businessIdTarget);
      throw new Error('Endpoint de mover instância não implementado');
    } catch (error) {
      console.error('Erro ao mover instância:', error);
      throw error;
    }
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Cria webhook para um business
   */
  async createWebhook(businessId: string, webhookData: {
    url: string;
    enabled?: boolean;
    headers?: Record<string, any>;
  }): Promise<WebhookData> {
    try {
      // TODO: Implementar endpoint POST /api/v2/business/{businessId}/webhook
      console.log('Criando webhook:', businessId, webhookData);
      throw new Error('Endpoint de criação de webhook não implementado');
    } catch (error) {
      console.error('Erro ao criar webhook:', error);
      throw error;
    }
  }

  /**
   * Obtém webhook de um business
   */
  async getWebhook(businessId: string): Promise<WebhookData> {
    try {
      // TODO: Implementar endpoint GET /api/v2/business/{businessId}/webhook
      console.log('Buscando webhook:', businessId);
      throw new Error('Endpoint de busca de webhook não implementado');
    } catch (error) {
      console.error('Erro ao buscar webhook:', error);
      throw error;
    }
  }

  /**
   * Atualiza webhook de um business
   */
  async updateWebhook(businessId: string, webhookData: {
    url: string;
    enabled?: boolean;
    headers?: Record<string, any>;
  }): Promise<WebhookData> {
    try {
      // TODO: Implementar endpoint PUT /api/v2/business/{businessId}/webhook
      console.log('Atualizando webhook:', businessId, webhookData);
      throw new Error('Endpoint de atualização de webhook não implementado');
    } catch (error) {
      console.error('Erro ao atualizar webhook:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  /**
   * Calcula estatísticas de um business
   */
  getBusinessStats(business: BusinessData) {
    return {
      totalInstances: business.instances || 0,
      connectedInstances: business.connectedInstances || 0,
      disconnectedInstances: (business.instances || 0) - (business.connectedInstances || 0),
      hasWebhook: !!business.BusinessWebhook?.enabled,
      webhookEnabled: business.BusinessWebhook?.enabled || false
    };
  }

  /**
   * Formata status de conexão para exibição
   */
  formatConnectionStatus(connection: string): { text: string; color: string; variant: string } {
    switch (connection) {
      case 'open':
        return { text: 'Conectado', color: 'text-green-600', variant: 'success' };
      case 'close':
        return { text: 'Desconectado', color: 'text-gray-600', variant: 'secondary' };
      case 'refused':
        return { text: 'Recusado', color: 'text-red-600', variant: 'destructive' };
      default:
        return { text: 'Desconhecido', color: 'text-gray-400', variant: 'outline' };
    }
  }

  /**
   * Formata estado da instância para exibição
   */
  formatInstanceState(state: string): { text: string; color: string; variant: string } {
    switch (state) {
      case 'active':
        return { text: 'Ativo', color: 'text-blue-600', variant: 'default' };
      case 'inactive':
        return { text: 'Inativo', color: 'text-gray-600', variant: 'secondary' };
      default:
        return { text: 'Desconhecido', color: 'text-gray-400', variant: 'outline' };
    }
  }
}

export const businessService = new BusinessService();