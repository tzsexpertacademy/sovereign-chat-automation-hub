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
   * Lista todos os businesses com dados dos clientes vinculados (Admin)
   */
  async getAllBusinesses(): Promise<BusinessData[]> {
    console.log('🔍 [BUSINESS-SERVICE] Buscando todos os businesses...');
    
    try {
      const result = await unifiedYumerService.listBusinesses();
      if (result.success && result.data) {
        console.log(`📋 [BUSINESS-SERVICE] ${result.data.length} businesses encontrados na API`);
        
        // Filtrar businesses que foram excluídos na sessão atual
        const filteredBusinesses = result.data.filter((business: any) => {
          const isDeleted = BusinessService.deletedBusinessesCache.has(business.businessId);
          if (isDeleted) {
            console.log(`🗑️ [BUSINESS-SERVICE] Filtrando business excluído: ${business.businessId}`);
          }
          return !isDeleted;
        });

        console.log(`📋 [BUSINESS-SERVICE] ${filteredBusinesses.length} businesses após filtrar excluídos`);
        
        // Buscar clientes do Supabase
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: clients } = await supabase
          .from('clients')
          .select('*');
        
        // Para cada business não excluído, buscar suas instâncias e cliente vinculado
        const businessesWithInstances = await Promise.all(
          filteredBusinesses.map(async (business: any) => {
            try {
              // Buscar instâncias do business
              const instancesResult = await unifiedYumerService.listBusinessInstances(business.businessId);
              const instances = instancesResult.success ? instancesResult.data || [] : [];
              
              // Calcular estatísticas
              const connectedInstances = instances.filter((i: any) => i.connection === 'open' || i.connectionStatus === 'open').length;
              
              // Encontrar cliente proprietário
              const ownerClient = clients?.find(c => c.business_id === business.businessId);
              
              return {
                businessId: business.businessId,
                name: business.name,
                businessToken: business.businessToken,
                attributes: {
                  clientId: ownerClient?.id,
                  clientName: ownerClient?.name,
                  clientEmail: ownerClient?.email,
                  clientPlan: ownerClient?.plan
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                Instance: instances.map((instance: any) => ({
                  instanceId: instance.instanceId || instance.id?.toString() || '',
                  name: instance.name,
                  state: (instance.state as 'active' | 'inactive') || 'inactive',
                  connection: (instance.connection === 'open' ? 'open' : instance.connection === 'refused' ? 'refused' : 'close') as 'open' | 'close' | 'refused',
                  createdAt: new Date().toISOString(),
                  businessBusinessId: business.businessId,
                  Auth: instance.Auth ? {
                    authId: instance.Auth.token || '',
                    jwt: instance.Auth.jwt || instance.Auth.token || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  } : undefined,
                  WhatsApp: instance.WhatsApp ? {
                    ...instance.WhatsApp,
                    createdAt: instance.WhatsApp.createdAt || new Date().toISOString()
                  } : undefined
                })),
                instances: instances.length,
                connectedInstances: connectedInstances
              };
            } catch (error) {
              console.warn(`⚠️ [BUSINESS-SERVICE] Erro ao buscar instâncias do business ${business.businessId}:`, error);
              
              // Encontrar cliente proprietário mesmo em caso de erro
              const ownerClient = clients?.find(c => c.business_id === business.businessId);
              
              return {
                businessId: business.businessId,
                name: business.name,
                businessToken: business.businessToken,
                attributes: {
                  clientId: ownerClient?.id,
                  clientName: ownerClient?.name,
                  clientEmail: ownerClient?.email,
                  clientPlan: ownerClient?.plan
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                instances: 0,
                connectedInstances: 0
              };
            }
          })
        );
        
        return businessesWithInstances;
      }
      throw new Error(result.error || 'Erro ao listar businesses');
    } catch (error) {
      console.error('❌ [BUSINESS-SERVICE] Erro ao buscar businesses:', error);
      throw error;
    }
  }

  /**
   * Identifica businesses órfãos (sem cliente vinculado)
   */
  async identifyOrphanBusinesses(): Promise<{ orphans: BusinessData[], total: number }> {
    try {
      console.log('🔍 [BUSINESS-SERVICE] Identificando businesses órfãos...');
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: clients, error } = await supabase
        .from('clients')
        .select('business_id')
        .not('business_id', 'is', null);

      if (error) throw error;

      const clientBusinessIds = new Set(clients?.map(c => c.business_id) || []);
      
      // Buscar todos os businesses da API
      const result = await unifiedYumerService.listBusinesses();
      if (!result.success || !result.data) {
        throw new Error('Erro ao buscar businesses da API');
      }
      
      const orphanBusinesses = result.data
        .filter((business: any) => !clientBusinessIds.has(business.businessId))
        .map((business: any) => ({
          businessId: business.businessId,
          name: business.name,
          businessToken: business.businessToken,
          attributes: business.attributes || {},
          createdAt: business.createdAt || new Date().toISOString(),
          updatedAt: business.updatedAt || new Date().toISOString(),
          instances: 0,
          connectedInstances: 0
        }));

      console.log(`📊 [BUSINESS-SERVICE] Encontrados ${orphanBusinesses.length} businesses órfãos de ${result.data.length} total`);
      
      return {
        orphans: orphanBusinesses,
        total: result.data.length
      };
    } catch (error) {
      console.error('❌ [BUSINESS-SERVICE] Erro ao identificar órfãos:', error);
      throw error;
    }
  }

  /**
   * Limpa businesses órfãos em lote
   */
  async cleanupOrphanBusinesses(): Promise<{ deleted: number, failed: string[] }> {
    try {
      console.log('🧹 [BUSINESS-SERVICE] Iniciando limpeza de businesses órfãos...');
      
      const { orphans } = await this.identifyOrphanBusinesses();
      const results = { deleted: 0, failed: [] as string[] };

      if (orphans.length === 0) {
        console.log('✅ [BUSINESS-SERVICE] Nenhum business órfão encontrado');
        return results;
      }

      for (const business of orphans) {
        try {
          await this.deleteBusiness(business.businessId, true);
          this.markBusinessAsDeleted(business.businessId);
          results.deleted++;
          console.log(`✅ [BUSINESS-SERVICE] Business órfão deletado: ${business.name} (${business.businessId})`);
        } catch (error) {
          console.error(`❌ [BUSINESS-SERVICE] Falha ao deletar business ${business.businessId}:`, error);
          results.failed.push(business.businessId);
        }
      }

      console.log(`🏁 [BUSINESS-SERVICE] Limpeza concluída: ${results.deleted} deletados, ${results.failed.length} falharam`);
      return results;
    } catch (error) {
      console.error('❌ [BUSINESS-SERVICE] Falha na limpeza:', error);
      throw error;
    }
  }

  /**
   * Sincroniza businesses com clientes
   */
  async syncBusinessesWithClients(): Promise<void> {
    try {
      console.log('🔄 [BUSINESS-SERVICE] Iniciando sincronização businesses-clientes...');
      
      // 1. Buscar todos os businesses da API
      const businesses = await unifiedYumerService.listBusinesses();
      if (!businesses.success || !businesses.data) {
        throw new Error('Erro ao buscar businesses da API');
      }
      
      // 2. Buscar todos os clientes do Supabase
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: clients } = await supabase
        .from('clients')
        .select('*');

      if (!clients) {
        console.log('⚠️ [BUSINESS-SERVICE] Nenhum cliente encontrado no banco');
        return;
      }

      let vinculados = 0;
      let jaVinculados = 0;

      // 3. Para cada cliente sem business_id, tentar encontrar um business correspondente
      for (const client of clients) {
        if (!client.business_id) {
          // Tentar encontrar business pelo nome ou email
          const matchingBusiness = businesses.data.find((business: any) => 
            business.name.toLowerCase().includes(client.name.toLowerCase()) ||
            business.email === client.email
          );

          if (matchingBusiness) {
            console.log(`🔗 [BUSINESS-SERVICE] Vinculando cliente "${client.name}" ao business "${matchingBusiness.name}"`);
            await supabase
              .from('clients')
              .update({ 
                business_id: matchingBusiness.businessId,
                business_token: matchingBusiness.businessToken 
              })
              .eq('id', client.id);
            vinculados++;
          }
        } else {
          jaVinculados++;
        }
      }

      console.log(`✅ [BUSINESS-SERVICE] Sincronização concluída: ${vinculados} novos vínculos, ${jaVinculados} já vinculados`);
      
      // Limpar cache para recarregar dados atualizados
      this.clearDeletedCache();
    } catch (error) {
      console.error('❌ [BUSINESS-SERVICE] Erro na sincronização:', error);
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

  // Cache para businesses excluídos na sessão atual
  private static deletedBusinessesCache = new Set<string>();

  /**
   * Remove um business (Admin)
   */
  async deleteBusiness(businessId: string, force = true): Promise<void> {
    try {
      console.log(`🗑️ [BUSINESS-SERVICE] Deletando business ${businessId} com force=${force}`);
      const result = await unifiedYumerService.deleteBusiness(businessId, force);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao deletar business');
      }
      console.log(`✅ [BUSINESS-SERVICE] Business ${businessId} deletado com sucesso`);
    } catch (error) {
      console.error('Erro ao deletar business:', error);
      throw error;
    }
  }

  /**
   * Marca business como excluído no cache
   */
  markBusinessAsDeleted(businessId: string): void {
    console.log(`🗑️ [BUSINESS-SERVICE] Marcando business ${businessId} como excluído no cache`);
    BusinessService.deletedBusinessesCache.add(businessId);
  }

  /**
   * Limpa cache de exclusões
   */
  clearDeletedCache(): void {
    console.log(`🧹 [BUSINESS-SERVICE] Limpando cache de businesses excluídos`);
    BusinessService.deletedBusinessesCache.clear();
  }

  /**
   * Refresh token de um business (Admin)
   */
  async refreshBusinessToken(businessId: string, oldToken: string): Promise<{ newToken: string }> {
    try {
      const result = await unifiedYumerService.makeRequest(`/api/v2/admin/business/${businessId}/refresh-token`, {
        method: 'PATCH',
        body: JSON.stringify({ oldToken })
      });
      
      if (result.success && result.data) {
        const responseData = result.data as any;
        if (responseData.newToken) {
          // Atualizar token no Supabase
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase
              .from('clients')
              .update({ business_token: responseData.newToken })
              .eq('business_id', businessId);
            
            console.log('✅ Token business atualizado no Supabase');
          } catch (error) {
            console.warn('⚠️ Erro ao atualizar token no Supabase:', error);
          }
          
          return { newToken: responseData.newToken };
        }
      }
      
      throw new Error(result.error || 'Erro ao fazer refresh do token');
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
      const result = await unifiedYumerService.makeRequest(`/api/v2/business/${businessId}/instance/${instanceId}`, {
        method: 'DELETE',
        body: JSON.stringify({ force })
      }, true, true, businessId);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao deletar instância');
      }
      
      console.log('✅ Instância deletada com sucesso:', instanceId);
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
      const result = await unifiedYumerService.makeRequest(`/api/v2/business/${businessId}/webhook`, {
        method: 'POST',
        body: JSON.stringify({
          url: webhookData.url,
          enabled: webhookData.enabled !== false,
          headers: webhookData.headers || {}
        })
      });
      
      if (result.success && result.data) {
        return result.data as WebhookData;
      }
      
      throw new Error(result.error || 'Erro ao criar webhook');
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
      const result = await unifiedYumerService.makeRequest(`/api/v2/business/${businessId}/webhook`, {
        method: 'GET'
      });
      
      if (result.success && result.data) {
        return result.data as WebhookData;
      }
      
      throw new Error(result.error || 'Webhook não encontrado');
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
      const result = await unifiedYumerService.makeRequest(`/api/v2/business/${businessId}/webhook`, {
        method: 'PUT',
        body: JSON.stringify({
          url: webhookData.url,
          enabled: webhookData.enabled !== false,
          headers: webhookData.headers || {}
        })
      });
      
      if (result.success && result.data) {
        return result.data as WebhookData;
      }
      
      throw new Error(result.error || 'Erro ao atualizar webhook');
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