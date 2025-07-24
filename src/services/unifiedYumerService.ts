/**
 * Serviço Unificado Yumer API v2.2.1
 * Corrige CORS usando Authorization Bearer e centraliza toda funcionalidade
 */

import { serverConfigService } from './serverConfigService';

// ==================== TIPOS PRINCIPAIS ====================

export interface YumerInstance {
  id?: number;
  instanceId?: string;
  instanceName?: string;
  name: string;
  description?: string;
  connectionStatus?: string;
  connection?: string;
  state?: string;
  ownerJid?: string;
  profilePicUrl?: string;
  businessId?: string;
  Auth?: {
    token: string;
    jwt?: string;
  };
  WhatsApp?: {
    whatsappId: string;
    remoteJid: string;
    pictureUrl?: string;
    pushName?: string;
    createdAt?: string;
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
  timeout: 45000, // Aumentado para 45s
  retries: 3,
  retryDelay: 2000 // Aumentado delay entre tentativas
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

  // Request com retry e timeout - CORRIGIDO para suportar business_token
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    useRetry = true,
    useBusinessToken = false,
    businessId?: string
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const url = `${this.config.serverUrl}${endpoint}`;
    let attempt = 0;
    
    const executeRequest = async (): Promise<{ success: boolean; data?: T; error?: string }> => {
      attempt++;
      
      try {
        console.log(`🌐 [UNIFIED-YUMER] ${options.method || 'GET'} ${endpoint} (tentativa ${attempt})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

        // Autenticação corrigida: usar business_token para operações de instância
        let authHeaders = this.getAuthHeaders();
        
        if (useBusinessToken && businessId) {
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data: client } = await supabase
              .from('clients')
              .select('business_token')
              .eq('business_id', businessId)
              .single();
            
            if (client?.business_token) {
              authHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'authorization': `Bearer ${client.business_token}`
              };
              console.log('🔑 [UNIFIED-YUMER] Usando business_token para business:', businessId);
            }
          } catch (error) {
            console.warn('⚠️ [UNIFIED-YUMER] Erro ao buscar business_token:', error);
          }
        }

        const response = await fetch(url, {
          ...options,
          headers: {
            ...authHeaders,
            ...options.headers
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [UNIFIED-YUMER] Erro HTTP ${response.status}:`, errorText);
          
          // Análise específica de erro com tokens
          if (response.status === 401) {
            if (errorText.includes('expired') || errorText.includes('jwt')) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`Token inválido ou expirado (${response.status})`);
          } else if (response.status === 403) {
            if (errorText.includes('Inactive instance')) {
              throw new Error('INSTANCE_INACTIVE');
            }
            throw new Error(`Acesso negado - verifique permissões (${response.status})`);
          } else if (response.status === 404) {
            throw new Error(`Endpoint não encontrado (${response.status})`);
          } else {
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        }

        // Verificar se a resposta tem conteúdo antes de tentar fazer parse
        const responseText = await response.text();
        
        if (!responseText || responseText.trim() === '') {
          console.log(`⚠️ [UNIFIED-YUMER] Resposta vazia recebida (${attempt}/${this.requestConfig.retries})`);
          return { success: true, data: null };
        }

        try {
          const data = JSON.parse(responseText);
          console.log(`✅ [UNIFIED-YUMER] Resposta recebida (${attempt}/${this.requestConfig.retries}):`, data);
          return { success: true, data };
        } catch (parseError) {
          console.error(`❌ [UNIFIED-YUMER] Erro ao fazer parse do JSON:`, responseText);
          throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}`);
        }

      } catch (error: any) {
        console.error(`❌ [UNIFIED-YUMER] Erro na tentativa ${attempt}:`, error);
        
        // Retry lógico - não retry para erros específicos
        const shouldRetry = useRetry && 
          attempt < this.requestConfig.retries && 
          !error.name?.includes('AbortError') &&
          !error.message?.includes('INSTANCE_INACTIVE') &&
          !error.message?.includes('TOKEN_EXPIRED');
          
        if (shouldRetry) {
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

  // ==================== NOVOS MÉTODOS CORRIGIDOS ====================
  
  // Refresh token para instâncias com tokens expirados
  async refreshInstanceToken(businessId: string, instanceId: string, oldToken: string): Promise<{ success: boolean; newToken?: string; error?: string }> {
    console.log('🔄 [UNIFIED-YUMER] Fazendo refresh do token para instância:', instanceId);
    
    const result = await this.makeRequest<{ newToken: string }>(`/api/v2/business/${businessId}/instance/${instanceId}/refresh-token`, {
      method: 'PATCH',
      body: JSON.stringify({ oldToken })
    }, true, true, businessId);
    
    if (result.success && result.data?.newToken) {
      // Atualizar token no Supabase
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('whatsapp_instances')
          .update({ 
            auth_token: result.data.newToken,
            updated_at: new Date().toISOString()
          })
          .eq('instance_id', instanceId);
        
        console.log('✅ [UNIFIED-YUMER] Token atualizado no Supabase');
      } catch (error) {
        console.warn('⚠️ [UNIFIED-YUMER] Erro ao atualizar token no Supabase:', error);
      }
      
      return { success: true, newToken: result.data.newToken };
    }
    
    return result;
  }

  // Ativar/desativar instância
  async toggleActivate(businessId: string, instanceId: string, action: 'activate' | 'deactivate' = 'activate'): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔄 [UNIFIED-YUMER] ${action === 'activate' ? 'Ativando' : 'Desativando'} instância:`, instanceId);
    
    return this.makeRequest(`/api/v2/business/${businessId}/instance/${instanceId}/toggle-activate`, {
      method: 'PATCH',
      body: JSON.stringify({ action })
    }, true, true, businessId);
  }

  // Sincronizar instância Supabase ↔ YUMER
  async syncInstanceToSupabase(instanceId: string, instanceData: any): Promise<void> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const updateData = {
        status: instanceData.connection || 'disconnected',
        connection_state: instanceData.state || 'close',
        auth_jwt: instanceData.Auth?.jwt,
        api_version: 'v2.2.1',
        yumer_instance_name: instanceData.name || instanceId,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('whatsapp_instances')
        .update(updateData)
        .eq('instance_id', instanceId);
        
      if (error) {
        console.error('❌ [SYNC] Erro ao sincronizar com Supabase:', error);
        throw error;
      } else {
        console.log('✅ [SYNC] Instância sincronizada com Supabase:', instanceId);
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro na sincronização:', error);
    }
  }

  // Fluxo completo de criação de instância corrigido
  async createInstanceCompleteFlow(businessId: string, clientId: string, instanceName?: string): Promise<{ success: boolean; instanceId?: string; error?: string }> {
    console.log('🚀 [UNIFIED-YUMER] Iniciando fluxo completo de criação de instância');
    
    try {
      // 1. Criar instância
      const createResult = await this.createBusinessInstance(businessId, { instanceName });
      if (!createResult.success) {
        return { success: false, error: `Erro ao criar instância: ${createResult.error}` };
      }
      
      const instanceId = createResult.data?.instanceId || createResult.data?.id;
      if (!instanceId) {
        return { success: false, error: 'ID da instância não retornado' };
      }
      
      console.log('✅ [FLOW] Instância criada:', instanceId);
      
      // 2. Aguardar e verificar estado
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const instanceResult = await this.getInstance(String(instanceId));
      if (!instanceResult.success) {
        return { success: false, error: `Erro ao verificar instância: ${instanceResult.error}` };
      }
      
      // 3. Ativar se necessário
      if (instanceResult.data?.state !== 'active') {
        console.log('🔄 [FLOW] Ativando instância...');
        const activateResult = await this.toggleActivate(businessId, String(instanceId), 'activate');
        if (!activateResult.success) {
          console.warn('⚠️ [FLOW] Erro ao ativar instância:', activateResult.error);
        }
        
        // Aguardar ativação
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 4. Sincronizar com Supabase
      try {
        await this.syncInstanceToSupabase(String(instanceId), instanceResult.data);
      } catch (error) {
        console.warn('⚠️ [FLOW] Erro ao sincronizar com Supabase (não bloqueia):', error);
      }
      
      // 5. Configurar webhook
      try {
        const webhookResult = await this.ensureWebhookConfigured(String(instanceId));
        if (!webhookResult.success) {
          console.warn('⚠️ [FLOW] Erro ao configurar webhook:', webhookResult.error);
        }
      } catch (error) {
        console.warn('⚠️ [FLOW] Erro ao configurar webhook (não bloqueia):', error);
      }
      
      console.log('🎉 [FLOW] Fluxo completo de criação concluído com sucesso');
      return { success: true, instanceId: String(instanceId) };
      
    } catch (error) {
      console.error('❌ [FLOW] Erro no fluxo completo:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido no fluxo' 
      };
    }
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

  async createBusinessInstance(businessId: string, instanceData?: {
    instanceName?: string;
    externalId?: string;
  }): Promise<{ success: boolean; data?: YumerInstance; error?: string; instanceJWT?: string }> {
    console.log('🔄 Criando instância no business:', businessId, 'com dados:', instanceData);
    
    const result = await this.makeRequest<YumerInstance>(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      body: instanceData ? JSON.stringify(instanceData) : null
    }, true, true, businessId);
    
    // Se instância criada com sucesso, gerar JWT específico
    if (result.success && result.data?.instanceId) {
      try {
        const { yumerJwtService } = await import('./yumerJwtService');
        const instanceJWT = await yumerJwtService.generateInstanceJWT(
          result.data.instanceId, 
          businessId
        );
        
        // Salvar JWT no Supabase
        const { whatsappInstancesService } = await import('./whatsappInstancesService');
        await whatsappInstancesService.saveInstanceJWT(result.data.instanceId, instanceJWT);
        
        console.log('✅ [CREATE-INSTANCE] JWT gerado e salvo para instância:', result.data.instanceId);
        
        return {
          ...result,
          instanceJWT
        };
      } catch (jwtError) {
        console.warn('⚠️ [CREATE-INSTANCE] Erro ao gerar JWT (não bloqueia):', jwtError);
        return result;
      }
    }
    
    return result;
  }

  async getInstance(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; data?: YumerInstance; error?: string }> {
    console.log(`🔍 [UNIFIED-YUMER] Buscando instância: ${instanceId}`);
    
    // Buscar business_id da instância para usar business_token
    let businessId = '';
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();
      
      businessId = instance?.business_business_id || '';
      console.log('🔑 [GET-INSTANCE] Business ID encontrado:', businessId);
    } catch (error) {
      console.warn('⚠️ [GET-INSTANCE] Erro ao buscar business_id:', error);
    }
    
    return this.makeRequest<YumerInstance>(`/api/v2/instance/${instanceId}`, {
      method: 'GET'
    }, true, true, businessId);
  }

  async connectInstance(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔗 [UNIFIED-YUMER] Conectando instância: ${instanceId} - Usando ADMIN_TOKEN`);
    
    // Connect endpoint requires ADMIN_TOKEN, not business_token
    return this.makeRequest(
      `/api/v2/instance/${instanceId}/connect`,
      { method: 'GET' },
      true,
      false // Use ADMIN_TOKEN instead of business_token
    );
  }

  async deleteInstance(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.makeRequest(`/api/v2/instance/${instanceId}`, {
      method: 'DELETE'
    });
  }

  // ==================== CONNECTION & QR CODE ====================
  
  async getConnectionState(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; data?: ConnectionState; error?: string }> {
    console.log(`🔍 [UNIFIED-YUMER] Verificando estado da conexão: ${instanceId}`);
    
    // Buscar business_id da instância para usar business_token
    let businessId = '';
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();
      
      businessId = instance?.business_business_id || '';
      console.log('🔑 [CONNECTION-STATE] Business ID encontrado:', businessId);
    } catch (error) {
      console.warn('⚠️ [CONNECTION-STATE] Erro ao buscar business_id:', error);
    }
    
    // Usar o endpoint correto para conexão
    const result = await this.makeRequest<ConnectionState>(`/api/v2/instance/${instanceId}/connection-state`, {
      method: 'GET'
    }, true, true, businessId);
    
    console.log(`📊 [CONNECTION-STATE] Resultado da API para ${instanceId}:`, result);
    
    return result;
  }

  async getQRCode(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; data?: QRCodeResponse; error?: string }> {
    console.log(`🔍 [UNIFIED-YUMER] Buscando QR Code: ${instanceId}`);
    
    // Buscar business_id da instância para usar business_token
    let businessId = '';
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();
      
      businessId = instance?.business_business_id || '';
      console.log('🔑 [QR-CODE] Business ID encontrado:', businessId);
    } catch (error) {
      console.warn('⚠️ [QR-CODE] Erro ao buscar business_id:', error);
    }
    
    return this.makeRequest<QRCodeResponse>(`/api/v2/instance/${instanceId}/qrcode`, {
      method: 'GET'
    }, true, true, businessId);
  }

  // ==================== WEBHOOK MANAGEMENT ====================
  
  async configureWebhook(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔧 [UNIFIED-YUMER] Configurando webhook para instância: ${instanceId}`);
    
    // Buscar business_id da instância para usar business_token
    let businessId = '';
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();
      
      businessId = instance?.business_business_id || '';
      console.log('🔑 [WEBHOOK] Business ID encontrado:', businessId);
    } catch (error) {
      console.warn('⚠️ [WEBHOOK] Erro ao buscar business_id:', error);
    }
    
    const webhookConfig = {
      name: `Instance ${instanceId} Webhook`, // Nome obrigatório 
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
    }, true, true, businessId);
  }

  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔍 [UNIFIED-YUMER] Verificando webhook para instância: ${instanceId}`);
    
    // Buscar business_id da instância para usar business_token
    let businessId = '';
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();
      
      businessId = instance?.business_business_id || '';
      console.log('🔑 [GET-WEBHOOK] Business ID encontrado:', businessId);
    } catch (error) {
      console.warn('⚠️ [GET-WEBHOOK] Erro ao buscar business_id:', error);
    }
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
      method: 'GET'
    }, true, true, businessId);
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
  getQRCode: (instanceId: string) => unifiedYumerService.getQRCode(instanceId),
  // Novos métodos
  refreshInstanceToken: (businessId: string, instanceId: string, oldToken: string) => unifiedYumerService.refreshInstanceToken(businessId, instanceId, oldToken),
  toggleActivate: (businessId: string, instanceId: string, action: 'activate' | 'deactivate') => unifiedYumerService.toggleActivate(businessId, instanceId, action),
  createInstanceCompleteFlow: (businessId: string, clientId: string, instanceName?: string) => unifiedYumerService.createInstanceCompleteFlow(businessId, clientId, instanceName)
};