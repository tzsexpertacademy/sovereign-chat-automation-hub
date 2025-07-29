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
  public async makeRequest<T>(
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

  // ==================== PROFILE MANAGEMENT - CODECHAT V2.2.1 ====================
  
  // Online Privacy: Configurar quando o bot aparece online
  async updateOnlinePrivacy(instanceId: string, privacy: 'all' | 'contacts' | 'none'): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔒 [PROFILE] Configurando privacidade online: ${privacy}`);
    
    try {
      // Buscar business_token da instância
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          instance_id,
          clients:client_id (
            business_token
          )
        `)
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        return { success: false, error: 'Business token não encontrado' };
      }

      // Primeiro definir presença global como disponível
      await fetch(`${this.config.serverUrl}/api/v2/instance/${instanceId}/whatsapp/set-presence-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${instanceData.clients.business_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ presence: 'available' })
      });

      const response = await fetch(`${this.config.serverUrl}/api/v2/instance/${instanceId}/whatsapp/update/profile-online-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${instanceData.clients.business_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ privacy })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();
      console.log('✅ [PROFILE] Privacidade online atualizada:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ [PROFILE] Erro ao atualizar privacidade online:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  // Seen Privacy: Configurar visto por último
  async updateSeenPrivacy(instanceId: string, privacy: 'all' | 'contacts' | 'none'): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`👁️ [PROFILE] Configurando privacidade visto por último: ${privacy}`);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          instance_id,
          clients:client_id (
            business_token
          )
        `)
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        return { success: false, error: 'Business token não encontrado' };
      }

      const response = await fetch(`${this.config.serverUrl}/api/v2/instance/${instanceId}/whatsapp/update/profile-seen-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${instanceData.clients.business_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ privacy })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();
      console.log('✅ [PROFILE] Privacidade visto atualizada:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ [PROFILE] Erro ao atualizar privacidade visto:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  // Profile Status: Configurar status do perfil (recado)
  async updateProfileStatus(instanceId: string, status: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`📝 [PROFILE] Atualizando status do perfil: ${status}`);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          instance_id,
          clients:client_id (
            business_token
          )
        `)
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        return { success: false, error: 'Business token não encontrado' };
      }

      const response = await fetch(`${this.config.serverUrl}/api/v2/instance/${instanceId}/whatsapp/update/profile-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${instanceData.clients.business_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();
      console.log('✅ [PROFILE] Status do perfil atualizado:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ [PROFILE] Erro ao atualizar status do perfil:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  // ==================== PRESENÇA EM CHATS - CODECHAT V2.2.1 ====================
  
  // Presença: Online/Offline em chat específico
  async setPresence(instanceId: string, chatId: string, status: 'composing' | 'available' | 'unavailable' = 'available'): Promise<{ success: boolean; error?: string }> {
    console.log(`🟢 [PRESENCE] Definindo presença ${status} para ${chatId}`);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/presence`, {
      method: 'POST',
      body: JSON.stringify({
        remoteJid: chatId,
        status
      })
    });
  }

  // Typing: Simulação de digitação
  async setTyping(instanceId: string, chatId: string, isTyping: boolean = true): Promise<{ success: boolean; error?: string }> {
    console.log(`⌨️ [TYPING] ${isTyping ? 'Iniciando' : 'Parando'} digitação para ${chatId}`);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/typing`, {
      method: 'POST',
      body: JSON.stringify({
        remoteJid: chatId,
        typing: isTyping
      })
    });
  }

  // Recording: Simulação de gravação
  async setRecording(instanceId: string, chatId: string, isRecording: boolean = true): Promise<{ success: boolean; error?: string }> {
    console.log(`🎙️ [RECORDING] ${isRecording ? 'Iniciando' : 'Parando'} gravação para ${chatId}`);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/recording`, {
      method: 'POST',
      body: JSON.stringify({
        remoteJid: chatId,
        recording: isRecording
      })
    });
  }

  // Mark as Read: Marcar mensagem como lida
  async markAsRead(instanceId: string, messageId: string, chatId?: string): Promise<{ success: boolean; error?: string }> {
    console.log(`✅ [READ] Marcando como lida: ${messageId}`);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/markAsRead`, {
      method: 'POST',
      body: JSON.stringify({
        messageId,
        remoteJid: chatId
      })
    });
  }

  // Send Text: Enviar mensagem de texto - USANDO MESMA AUTENTICAÇÃO DO WHATSAPP-MULTI-CLIENT
  async sendTextMessage(instanceId: string, chatId: string, text: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`📤 [UNIFIED-YUMER] Enviando texto para ${chatId}: "${text.substring(0, 50)}..."`);
      
      // BUSCAR BUSINESS_TOKEN DA INSTÂNCIA (MESMA LÓGICA DO WHATSAPP-MULTI-CLIENT)
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select(`
          instance_id,
          client_id,
          business_business_id,
          clients:client_id (
            business_token
          )
        `)
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData?.clients?.business_token) {
        console.error('❌ [UNIFIED-YUMER] Business token não encontrado para instância:', instanceId);
        return { success: false, error: 'Business token não encontrado para instância' };
      }

      const businessToken = instanceData.clients.business_token;
      console.log('🔑 [UNIFIED-YUMER] Usando business_token específico do cliente');

      // USAR ENDPOINT CORRETO DA API YUMER V2.2.1 (MESMO DO WHATSAPP-MULTI-CLIENT)
      const payload = {
        recipient: chatId,
        textMessage: {
          text: text
        },
        options: {
          delay: Math.floor(Math.random() * 1000 + 800), // Delay humanizado
          presence: 'composing'
        }
      };

      // USAR BUSINESS_TOKEN DIRETAMENTE NA REQUISIÇÃO
      const response = await fetch(`${this.config.serverUrl}/api/v2/instance/${instanceId}/send/text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [UNIFIED-YUMER] Erro HTTP:', response.status, errorText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const result = await response.json();
      console.log('✅ [UNIFIED-YUMER] Mensagem enviada com sucesso via business_token:', result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ [UNIFIED-YUMER] Erro ao enviar mensagem:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // ==================== FILTRO MESSAGES STATUS ====================
  
  // Buscar mensagens com filtro de status para detectar presença
  async getChatMessages(
    instanceId: string, 
    chatId: string, 
    options: {
      messagesStatus?: 'delivered' | 'read' | 'sent';
      limit?: number;
      page?: number;
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`📨 [MESSAGES-STATUS] Buscando mensagens com filtro: ${options.messagesStatus || 'all'}`);
    
    const params = new URLSearchParams();
    params.append('remoteJid', chatId);
    
    if (options.messagesStatus) {
      params.append('messagesStatus', options.messagesStatus);
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options.page) {
      params.append('page', options.page.toString());
    }

    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/messages?${params.toString()}`, {
      method: 'GET'
    }, true, true, undefined);
  }

  // Detectar presença baseada em status das mensagens
  async detectPresenceFromMessages(
    instanceId: string, 
    chatId: string,
    timeWindow: number = 300000 // 5 minutos
  ): Promise<{ 
    isOnline: boolean; 
    lastActivity: Date | null; 
    messageStatus: 'delivered' | 'read' | 'sent' | null;
    activityScore: number;
  }> {
    console.log(`👁️ [PRESENCE-DETECTION] Analisando presença para: ${chatId}`);
    
    try {
      // Buscar mensagens recentes com status 'delivered' e 'read'
      const [deliveredResult, readResult] = await Promise.all([
        this.getChatMessages(instanceId, chatId, { messagesStatus: 'delivered', limit: 10 }),
        this.getChatMessages(instanceId, chatId, { messagesStatus: 'read', limit: 10 })
      ]);

      const now = Date.now();
      let lastActivity: Date | null = null;
      let messageStatus: 'delivered' | 'read' | 'sent' | null = null;
      let activityScore = 0;

      // Analisar mensagens lidas (atividade mais recente)
      if (readResult.success && readResult.data?.messages) {
        const readMessages = readResult.data.messages.filter((msg: any) => {
          const msgTime = new Date(msg.messageTimestamp * 1000).getTime();
          return (now - msgTime) <= timeWindow;
        });

        if (readMessages.length > 0) {
          const latestRead = readMessages[0];
          lastActivity = new Date(latestRead.messageTimestamp * 1000);
          messageStatus = 'read';
          activityScore = 100; // Muito ativo - lendo mensagens
          
          console.log(`✅ [PRESENCE] Usuario ATIVO - leu mensagens recentemente: ${lastActivity}`);
          return { isOnline: true, lastActivity, messageStatus, activityScore };
        }
      }

      // Analisar mensagens entregues (atividade moderada)
      if (deliveredResult.success && deliveredResult.data?.messages) {
        const deliveredMessages = deliveredResult.data.messages.filter((msg: any) => {
          const msgTime = new Date(msg.messageTimestamp * 1000).getTime();
          return (now - msgTime) <= timeWindow;
        });

        if (deliveredMessages.length > 0) {
          const latestDelivered = deliveredMessages[0];
          lastActivity = new Date(latestDelivered.messageTimestamp * 1000);
          messageStatus = 'delivered';
          activityScore = 60; // Moderadamente ativo - recebeu mensagens
          
          console.log(`📱 [PRESENCE] Usuario MODERADO - recebeu mensagens: ${lastActivity}`);
          return { isOnline: true, lastActivity, messageStatus, activityScore };
        }
      }

      // Sem atividade recente
      console.log(`😴 [PRESENCE] Usuario INATIVO - sem atividade recente`);
      return { isOnline: false, lastActivity: null, messageStatus: null, activityScore: 0 };

    } catch (error) {
      console.error('❌ [PRESENCE-DETECTION] Erro ao detectar presença:', error);
      return { isOnline: false, lastActivity: null, messageStatus: null, activityScore: 0 };
    }
  }

  // ==================== WEBHOOK CONFIGURATION ====================
  
  // Configurar webhook para instância
  async configureWebhook(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔧 [WEBHOOK] Configurando webhook para: ${instanceId}`);
    
    // URL do webhook correta
    const webhookUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-webhook';
    
    try {
      // Primeiro, verificar se já existe um webhook
      const existingWebhooks = await this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
        method: 'GET'
      }, true, false);

      let webhookId: string | undefined;

      // Se já existe webhook, usar o primeiro
      if (existingWebhooks.success && existingWebhooks.data && Array.isArray(existingWebhooks.data) && existingWebhooks.data.length > 0) {
        const firstWebhook = existingWebhooks.data[0] as any;
        webhookId = firstWebhook?.webhookId;
        console.log(`🔍 [WEBHOOK] Webhook existente encontrado: ${webhookId}`);

        // Atualizar webhook existente
        const updateResult = await this.makeRequest(`/api/v2/instance/${instanceId}/webhook/${webhookId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: 'CRM Webhook Updated',
            url: webhookUrl,
            enabled: true,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }, true, false);

        if (!updateResult.success) {
          console.warn('⚠️ [WEBHOOK] Erro ao atualizar webhook existente:', updateResult.error);
        }
      } else {
        // Criar novo webhook
        const createResult = await this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
          method: 'POST',
          body: JSON.stringify({
            name: 'CRM Webhook',
            url: webhookUrl,
            enabled: true,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }, true, false);

        if (createResult.success && createResult.data) {
          const webhookData = createResult.data as any;
          webhookId = webhookData?.webhookId;
          console.log(`✅ [WEBHOOK] Novo webhook criado: ${webhookId}`);
        } else {
          console.error('❌ [WEBHOOK] Erro ao criar webhook:', createResult.error);
          return createResult;
        }
      }

      // Configurar eventos específicos
      if (webhookId) {
        const eventsResult = await this.makeRequest(`/api/v2/instance/${instanceId}/webhook/${webhookId}/events`, {
          method: 'PATCH',
          body: JSON.stringify({
            messagesUpsert: true,
            connectionUpdate: true,
            qrcodeUpdate: true,
            chatsUpsert: true,
            contactsUpsert: true,
            messagesUpdate: true,
            presenceUpdate: true
          })
        }, true, false);

        if (eventsResult.success) {
          // Atualizar status no banco
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase
              .from('whatsapp_instances')
              .update({ 
                webhook_enabled: true,
                updated_at: new Date().toISOString()
              })
              .eq('instance_id', instanceId);
            
            console.log('✅ [WEBHOOK] Status atualizado no banco');
          } catch (dbError) {
            console.warn('⚠️ [WEBHOOK] Erro ao atualizar status no banco:', dbError);
          }

          console.log('✅ [WEBHOOK] Webhook configurado com sucesso');
          return { success: true, data: { webhookId } };
        } else {
          console.error('❌ [WEBHOOK] Erro ao configurar eventos:', eventsResult.error);
          return eventsResult;
        }
      }

      return { success: false, error: 'Webhook ID não encontrado' };
    } catch (error) {
      console.error('❌ [WEBHOOK] Erro ao configurar webhook:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // Verificar configuração do webhook
  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔍 [WEBHOOK] Obtendo configuração do webhook para: ${instanceId}`);

    try {
      const result = await this.makeRequest(`/api/v2/instance/${instanceId}/webhook`, {
        method: 'GET'
      }, true, false);

      if (result.success && result.data) {
        // Se result.data é um array, pegar o primeiro webhook
        const webhookData = Array.isArray(result.data) ? result.data[0] : result.data;
        
        console.log('📋 [WEBHOOK] Configuração do webhook:', webhookData);
        
        // Verificar se webhook está habilitado no banco
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('webhook_enabled')
            .eq('instance_id', instanceId)
            .single();
            
          const webhookEnabled = instance?.webhook_enabled || false;
          const isApiEnabled = webhookData?.enabled || false;
          
          return { 
            success: true, 
            data: { 
              ...webhookData, 
              enabled: webhookEnabled && isApiEnabled,
              webhook_enabled: webhookEnabled,
              api_enabled: isApiEnabled
            } 
          };
        } catch (dbError) {
          console.warn('⚠️ [WEBHOOK] Erro ao verificar status no banco:', dbError);
          return { success: true, data: webhookData };
        }
      }

      return result;
    } catch (error) {
      console.error('❌ [WEBHOOK] Erro ao obter webhook:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // Garantir que webhook está configurado
  async ensureWebhookConfigured(instanceId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🔍 [WEBHOOK] Verificando configuração para: ${instanceId}`);
    
    // Primeiro verificar se já está configurado
    const checkResult = await this.getWebhookConfig(instanceId);
    
    if (checkResult.success && checkResult.data?.enabled) {
      console.log(`✅ [WEBHOOK] Webhook já configurado para: ${instanceId}`);
      return { success: true };
    }
    
    // Se não está configurado, configurar agora
    console.log(`🔧 [WEBHOOK] Configurando webhook para: ${instanceId}`);
    const configResult = await this.configureWebhook(instanceId);
    
    if (configResult.success) {
      console.log(`✅ [WEBHOOK] Webhook configurado com sucesso para: ${instanceId}`);
      return { success: true };
    } else {
      console.error(`❌ [WEBHOOK] Falha ao configurar webhook:`, configResult.error);
      return { success: false, error: configResult.error };
    }
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
    
    return { success: false, error: result.error || 'Falha ao fazer refresh do token' };
   }

  // Função para ativar/desativar instância
  async toggleActivate(instanceId: string, action: 'activate' | 'deactivate'): Promise<{ success: boolean; error?: string }> {
    console.log(`🔄 [UNIFIED-YUMER] ${action === 'activate' ? 'Ativando' : 'Desativando'} instância ${instanceId}`);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/${action}`, {
      method: 'PATCH'
    });
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
        const activateResult = await this.toggleActivate(String(instanceId), 'activate');
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

  async deleteBusiness(businessId: string, force: boolean = false): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = `/api/v2/admin/business/${businessId}${force ? '?force=true' : ''}`;
    return this.makeRequest(url, {
      method: 'DELETE'
    });
  }

  // ==================== INSTANCE MANAGEMENT ====================
  
  async listBusinessInstances(businessId: string): Promise<{ success: boolean; data?: YumerInstance[]; error?: string }> {
    return this.makeRequest<YumerInstance[]>(`/api/v2/business/${businessId}/instance`, {
      method: 'GET'
    }, true, true, businessId);
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

  async logoutInstance(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔌 [UNIFIED-YUMER] Desconectando instância: ${instanceId}`);
    
    // Buscar business_id da instância para usar business_token correto
    let businessId = '';
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();
      
      businessId = instance?.business_business_id || '';
      console.log('🔑 [LOGOUT] Business ID encontrado:', businessId);
    } catch (error) {
      console.warn('⚠️ [LOGOUT] Erro ao buscar business_id:', error);
    }
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/logout`, {
      method: 'DELETE'
    }, true, true, businessId);
  }

  async restartInstance(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔄 [UNIFIED-YUMER] Reiniciando instância: ${instanceId}`);
    
    return this.makeRequest(`/api/v2/instance/${instanceId}/restart`, {
      method: 'PUT'
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


  // ==================== MESSAGING ====================
  
  async sendMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`📤 [UNIFIED-YUMER] Enviando mensagem para: ${chatId}`);

    // Garantir webhook configurado antes de enviar
    const webhookResult = await this.ensureWebhookConfigured(instanceId);
    if (!webhookResult.success) {
      console.warn(`⚠️ [UNIFIED-YUMER] Webhook não configurado:`, webhookResult.error);
    }

    return this.makeRequest(`/api/v2/instance/${instanceId}/chat/sendText`, {
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


  // ==================== UTILITIES ====================

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
  logoutInstance: (instanceId: string) => unifiedYumerService.logoutInstance(instanceId),
  restartInstance: (instanceId: string) => unifiedYumerService.restartInstance(instanceId),
  getConnectionState: (instanceId: string) => unifiedYumerService.getConnectionState(instanceId),
  getQRCode: (instanceId: string) => unifiedYumerService.getQRCode(instanceId),
  // Novos métodos
  refreshInstanceToken: (businessId: string, instanceId: string, oldToken: string) => unifiedYumerService.refreshInstanceToken(businessId, instanceId, oldToken),
  toggleActivate: (instanceId: string, action: 'activate' | 'deactivate') => unifiedYumerService.toggleActivate(instanceId, action),
  createInstanceCompleteFlow: (businessId: string, clientId: string, instanceName?: string) => unifiedYumerService.createInstanceCompleteFlow(businessId, clientId, instanceName)
};