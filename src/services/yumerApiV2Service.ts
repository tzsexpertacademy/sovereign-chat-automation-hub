
/**
 * CodeChat API v2.2.1 - Serviço Unificado
 * Baseado na documentação oficial: https://docs.codechat.dev/api/v2.2.1
 */

export interface ApiKey {
  name: string;
  key: string;
}

export interface Business {
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

export interface Instance {
  instanceName: string;
  owner: string;
  profileName?: string;
  profilePicUrl?: string;
  status?: string;
  serverUrl?: string;
  apikey?: string;
  businessId?: string;
}

export interface ConnectionState {
  instance: string;
  state: 'open' | 'close' | 'connecting';
}

export interface QRCode {
  code: string;
  base64: string;
}

export interface SendMessageOptions {
  delay?: number;
  presence?: 'composing' | 'recording' | 'available' | 'unavailable';
  quoteMessageById?: string;
  groupMention?: {
    hidden?: boolean;
    everyone?: boolean;
  };
  externalAttributes?: string | object;
  messageId?: string;
}

export interface SendMessageData {
  number: string;
  text?: string;
  media?: {
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string; // base64 or URL
    caption?: string;
    filename?: string;
  };
  options?: SendMessageOptions;
}

export interface WebhookData {
  enabled: boolean;
  url: string;
  events: string[];
  webhook_by_events: boolean;
  webhook_base64: boolean;
}

export interface ContactInfo {
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
}

export interface ChatInfo {
  remoteJid: string;
  name?: string;
  isGroup: boolean;
  isWaContact: boolean;
}

export interface ChatRecord {
  chatId: string;
  remoteJid: string;
  createdAt: string;
}

export interface ContactRecord {
  contactId: string;
  pushName: string;
  remoteJid: string;
  pictureUrl: string;
  createdAt: string;
}

export interface ChatsPage {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  records: ChatRecord[];
}

export interface ContactsPage {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  records: ContactRecord[];
}

export interface MessageInfo {
  messageId?: string;
  keyId?: string;
  keyFromMe?: boolean;
  keyRemoteJid?: string;
  keyParticipant?: string;
  pushName?: string;
  contentType?: string;
  content?: any;
  messageTimestamp?: number;
  createdAt?: string;
  fromMe?: boolean;
  remoteJid?: string;
  // Legacy compatibility
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: any;
  status?: string;
}

export interface SendMessageResponse {
  key?: {
    id: string;
    fromMe: boolean;
    remoteJid: string;
  };
  message?: any;
  status?: string;
  timestamp?: number;
}

class YumerApiV2Service {
  private baseUrl: string;
  private globalApiKey: string;

  constructor(baseUrl = 'https://api.yumer.com.br', globalApiKey?: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.globalApiKey = globalApiKey || '';
    
    // Se não foi fornecida uma API key, tentar buscar do environment
    if (!this.globalApiKey && typeof window !== 'undefined') {
      this.globalApiKey = localStorage.getItem('yumer_global_api_key') || '';
    }
    
    console.log(`[YumerApiV2.2.1] Inicializado com API Key: ${this.globalApiKey ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useInstanceAuth = false,
    instanceName?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // AUTENTICAÇÃO CORRIGIDA - API v2.2.1 COM BUSINESS TOKEN
    if (useInstanceAuth && instanceName) {
      // Buscar business_token específico do cliente para operações de instância
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Buscar business_token do cliente baseado na instância
        const { data: instanceData } = await supabase
          .from('whatsapp_instances')
          .select(`
            business_business_id,
            clients!inner(business_token)
          `)
          .eq('instance_id', instanceName)
          .single();

        if (instanceData?.clients?.business_token) {
          console.log('[YumerApiV2.2.1] 🔑 Usando business_token específico do cliente para instância:', instanceName);
          headers['authorization'] = `Bearer ${instanceData.clients.business_token}`;
        } else {
          console.warn('[YumerApiV2.2.1] ⚠️ Business token não encontrado para instância:', instanceName);
          throw new Error('Business token não encontrado para a instância');
        }
      } catch (error) {
        console.error('[YumerApiV2.2.1] Erro ao buscar business_token:', error);
        throw new Error('Falha na autenticação: não foi possível obter token do cliente');
      }
    } else if (this.globalApiKey) {
      // Para operações administrativas, usar apikey global
      headers['apikey'] = this.globalApiKey;
      headers['authorization'] = `Bearer ${this.globalApiKey}`;
    } else {
      console.warn('[YumerApiV2.2.1] ⚠️ API Key não configurada!');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    console.log(`[YumerApiV2.2.1] ${options.method || 'GET'} ${url}`, {
      headers: { ...headers, apikey: (headers as any).apikey ? '***' : undefined },
      body: options.body
    });

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[YumerApiV2.2.1] Error ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[YumerApiV2.2.1] Response:`, data);
    return data;
  }

  // ==================== SERVER HEALTH CHECK ====================
  
  /**
   * Verifica se o servidor está online usando endpoint /docs
   */
  async checkServerHealth(): Promise<{ status: string; version: string; timestamp: string }> {
    try {
      // Usar endpoint /docs que sabemos que existe e retorna 200
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      });
      
      if (response.ok) {
        return {
          status: 'online',
          version: 'v2.2.1',
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[YumerApiV2.2.1] Health check failed:', error);
      throw new Error('Server offline or unreachable');
    }
  }

  // ==================== AUTHENTICATION ====================
  
  /**
   * Cria uma nova API Key
   */
  async createApiKey(name: string): Promise<ApiKey> {
    return this.makeRequest<ApiKey>('/api/v2/manager/createApikey', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  /**
   * Lista todas as API Keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    return this.makeRequest<ApiKey[]>('/api/v2/manager/findApikey');
  }

  /**
   * Remove uma API Key
   */
  async deleteApiKey(apikey: string): Promise<{ message: string }> {
    return this.makeRequest(`/api/v2/manager/deleteApikey/${apikey}`, {
      method: 'DELETE'
    });
  }

  // ==================== BUSINESS MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os businesses
   */
  async listBusinesses(): Promise<Business[]> {
    return this.makeRequest<Business[]>('/api/v2/admin/business');
  }

  /**
   * Cria um novo business
   */
  async createBusiness(businessData: {
    name: string;
    email: string;
    phone: string;
    slug: string;
    country?: string;
    timezone?: string;
    language?: string;
  }): Promise<Business> {
    return this.makeRequest<Business>('/api/v2/admin/business', {
      method: 'POST',
      body: JSON.stringify({
        ...businessData,
        country: businessData.country || 'BR',
        timezone: businessData.timezone || 'America/Sao_Paulo',
        language: businessData.language || 'pt-BR'
      })
    });
  }

  /**
   * Obtém um business específico
   */
  async getBusiness(businessId: string): Promise<Business> {
    return this.makeRequest<Business>(`/api/v2/admin/business/${businessId}`);
  }

  /**
   * Atualiza um business
   */
  async updateBusiness(businessId: string, updates: Partial<Business>): Promise<Business> {
    return this.makeRequest<Business>(`/api/v2/admin/business/${businessId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Remove um business
   */
  async deleteBusiness(businessId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/admin/business/${businessId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Regenera o business_token de um business específico
   */
  async regenerateBusinessToken(businessId: string): Promise<{ business_token: string; message: string }> {
    return this.makeRequest<{ business_token: string; message: string }>(`/api/v2/admin/business/${businessId}/token`, {
      method: 'POST'
    });
  }

  // ==================== INSTANCE MANAGEMENT (v2.2.1) ====================

  /**
   * Lista instâncias de um business
   */
  async listBusinessInstances(businessId: string): Promise<Instance[]> {
    return this.makeRequest<Instance[]>(`/api/v2/business/${businessId}/instance`, {}, true);
  }

  /**
   * Cria uma nova instância em um business
   */
  async createBusinessInstance(businessId: string, instanceData: {
    instanceName: string;
    token?: string;
    qrcode?: boolean;
    number?: string;
  }): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/business/${businessId}/instance`, {
      method: 'POST',
      body: JSON.stringify(instanceData)
    }, true);
  }

  /**
   * Obtém uma instância específica com dados completos (v2.2.1)
   * Retorna: instanceId, name, state, connection, WhatsApp, Auth, Webhook, Business
   */
  async getInstance(instanceId: string, businessToken?: string): Promise<any> {
    // Buscar business_token dinamicamente se não fornecido
    if (!businessToken) {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Buscar business_id da instância
        const { data: instanceData } = await supabase
          .from('whatsapp_instances')
          .select('business_business_id')
          .eq('instance_id', instanceId)
          .single();

        if (instanceData?.business_business_id) {
          // Buscar token do cliente
          const { data: clientData } = await supabase
            .from('clients')
            .select('business_token')
            .eq('business_id', instanceData.business_business_id)
            .single();

          businessToken = clientData?.business_token;
        }
      } catch (error) {
        console.warn('⚠️ [YUMER-API] Erro ao buscar business_token:', error);
      }
    }

    // Fazer request com token dinâmico
    return this.makeRequest<any>(`/api/v2/instance/${instanceId}`, {
      headers: businessToken ? {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json'
      } : {}
    });
  }

  /**
   * Conecta uma instância
   */
  async connectInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/instance/${instanceId}/connect`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Reinicia uma instância
   */
  async restartInstance(instanceId: string): Promise<Instance> {
    return this.makeRequest<Instance>(`/api/v2/instance/${instanceId}/restart`, {
      method: 'PUT'
    }, true, instanceId);
  }

  /**
   * Desconecta uma instância
   */
  async logoutInstance(instanceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/instance/${instanceId}/logout`, {
      method: 'DELETE'
    }, true, instanceId);
  }

  /**
   * Remove uma instância
   */
  async deleteInstance(instanceId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/instance/${instanceId}`, {
      method: 'DELETE'
    }, true, instanceId);
  }

  // ==================== CONNECTION STATUS (v2.2.1) ====================

  /**
   * Obtém status da conexão via getInstance - API v2.2.1 não tem connection-state separado
   */
  async getConnectionState(instanceId: string, businessToken?: string): Promise<ConnectionState> {
    console.log('🔍 [YUMER-API] Verificando connection state para:', instanceId);
    
    try {
      const instanceData = await this.getInstance(instanceId, businessToken);
      
      return {
        instance: instanceId,
        state: instanceData.connection === 'open' ? 'open' : 
               instanceData.connection === 'close' ? 'close' : 'connecting'
      };
    } catch (error) {
      console.error('❌ [YUMER-API] Erro ao verificar connection state:', error);
      return {
        instance: instanceId,
        state: 'close'
      };
    }
  }

  /**
   * Obtém QR Code para conexão via endpoint /connect
   */
  async getQRCode(instanceId: string): Promise<{ code: string; base64: string }> {
    console.log('🔍 [YUMER-QR] Buscando QR code para instância:', instanceId);
    const result = await this.makeRequest<{ code: string; base64: string }>(`/api/v2/instance/${instanceId}/connect`, {
      method: 'GET'
    }, true, instanceId);
    
    console.log('🔍 [YUMER-QR] Resposta da API:', {
      result,
      hasBase64: !!result?.base64,
      base64Length: result?.base64?.length,
      base64Start: result?.base64?.substring(0, 50),
      hasCode: !!result?.code,
    });
    
    return result;
  }

  // ==================== MESSAGE SENDING (v2.2.1) ====================

  // ==================== MESSAGE SENDING (v2.2.1) ====================

  /**
   * Helper para preparar opções de mensagem
   */
  private prepareMessageOptions(customOptions?: Partial<SendMessageOptions>): SendMessageOptions {
    const defaultOptions: SendMessageOptions = {
      delay: 1200,
      presence: "composing"
    };

    const mergedOptions = { ...defaultOptions, ...customOptions };

    // Converter externalAttributes para string se for objeto
    if (mergedOptions.externalAttributes && typeof mergedOptions.externalAttributes === 'object') {
      mergedOptions.externalAttributes = JSON.stringify(mergedOptions.externalAttributes);
    }

    return mergedOptions;
  }

  /**
   * Envia mensagem de texto (Evolution API v2.2.1)
   */
  async sendText(instanceId: string, number: string, text: string, options?: Partial<SendMessageOptions>): Promise<SendMessageResponse> {
    const body = {
      recipient: number,
      textMessage: {
        text: text
      },
      options: this.prepareMessageOptions(options)
    };
    
    return this.makeRequest<SendMessageResponse>(`/api/v2/instance/${instanceId}/send/text`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, true, instanceId);
  }

  /**
   * Envia mídia (imagem, vídeo, áudio, documento) com suporte completo a opções
   */
  async sendMedia(instanceId: string, data: SendMessageData): Promise<MessageInfo> {
    const messageOptions = this.prepareMessageOptions(data.options);
    
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/media`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: data.number,
        mediaMessage: {
          mediatype: data.media?.mediatype,
          url: data.media?.media,
          caption: data.media?.caption,
          fileName: data.media?.filename
        },
        options: messageOptions
      })
    }, true, instanceId);
  }

  /**
   * Envia áudio WhatsApp (formato .ogg ou .oga) com suporte completo a opções
   */
  async sendWhatsAppAudio(instanceId: string, number: string, audioUrl: string, options?: Partial<SendMessageOptions>): Promise<MessageInfo> {
    const messageOptions = this.prepareMessageOptions({
      ...options,
      presence: "recording" // Força presence de recording para áudios
    });
    
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/audio`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        audioMessage: {
          url: audioUrl
        },
        options: messageOptions
      })
    }, true, instanceId);
  }

  /**
   * Envia localização
   */
  async sendLocation(instanceId: string, number: string, latitude: number, longitude: number, name?: string, address?: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/location`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        locationMessage: {
          latitude,
          longitude,
          name: name || 'Localização',
          address: address || ''
        },
        options: {
          delay: 1200,
          presence: "composing"
        }
      })
    }, true, instanceId);
  }

  /**
   * Envia botões interativos
   */
  async sendButtons(instanceId: string, number: string, title: string, description: string, buttons: Array<{type: string, displayText: string, id: string}>): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/buttons`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        buttonsMessage: {
          title,
          description,
          buttons
        },
        options: {
          delay: 1200,
          presence: "composing"
        }
      })
    }, true, instanceId);
  }

  /**
   * Envia lista interativa
   */
  async sendList(instanceId: string, number: string, title: string, description: string, sections: Array<{buttonText: string, list: Array<{title: string, rows: Array<{title: string, description?: string, id?: string}>}>}>): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/list`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: number,
        listMessage: {
          title,
          description,
          sections
        },
        options: {
          delay: 1200,
          presence: "composing"
        }
      })
    }, true, instanceId);
  }

  /**
   * Envia reação a mensagem
   */
  async sendReaction(instanceId: string, messageId: string, emoji: string): Promise<MessageInfo> {
    return this.makeRequest<MessageInfo>(`/api/v2/instance/${instanceId}/send/reaction?message=${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        reactionMessage: {
          reaction: emoji
        }
      })
    }, true, instanceId);
  }

  // ==================== CHAT MANAGEMENT (v2.2.1) ====================

  /**
   * Busca mensagens com paginação (v2.2.1 - ENDPOINT CORRIGIDO)
   * Este é o único endpoint funcional para buscar mensagens na API v2.2.1
   */
  async searchMessages(instanceId: string, options: {
    remoteJid?: string;
    limit?: number;
    offset?: number;
    fromMe?: boolean;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<MessageInfo[]> {
    try {
      // Estrutura correta para API v2.2.1 conforme documentação
      const searchBody: any = {};
      
      // Adicionar filtros específicos se fornecidos
      if (options.remoteJid) {
        searchBody.keyRemoteJid = options.remoteJid; // API v2.2.1 usa keyRemoteJid
      }
      
      if (options.fromMe !== undefined) {
        searchBody.keyFromMe = options.fromMe;
      }

      console.log(`📋 [YumerApiV2] Buscando mensagens com filtro:`, {
        keyRemoteJid: searchBody.keyRemoteJid,
        keyFromMe: searchBody.keyFromMe,
        limit: options.limit || 50
      });

      const response = await this.makeRequest<any>(`/api/v2/instance/${instanceId}/chat/search/messages?page=1&sort=${options.sortOrder || 'desc'}`, {
        method: 'POST',
        body: JSON.stringify(searchBody)
      }, true, instanceId);

      console.log('[YumerApiV2] API Response Structure:', {
        type: typeof response,
        keys: response ? Object.keys(response) : 'null',
        isArray: Array.isArray(response),
        hasMessagesPage: response?.MessagesPage ? true : false,
        messagesPageKeys: response?.MessagesPage ? Object.keys(response.MessagesPage) : 'none'
      });

      // Extrair array de mensagens da estrutura correta da API v2.2.1
      let messages: MessageInfo[] = [];
      
      if (Array.isArray(response)) {
        messages = response;
      } else if (response?.MessagesPage?.records && Array.isArray(response.MessagesPage.records)) {
        messages = response.MessagesPage.records;
        console.log(`[YumerApiV2] Mensagens extraídas do MessagesPage: ${messages.length}/${response.MessagesPage.totalRecords} (Página ${response.MessagesPage.currentPage}/${response.MessagesPage.totalPages})`);
      } else if (response && Array.isArray(response.messages)) {
        messages = response.messages;
      } else if (response && Array.isArray(response.data)) {
        messages = response.data;
      } else if (response && Array.isArray(response.results)) {
        messages = response.results;
      } else {
        console.warn('[YumerApiV2] Resposta da API não contém array de mensagens:', response);
        return [];
      }

      console.log(`[YumerApiV2] Extraídas ${messages.length} mensagens da resposta`);
      return messages;
    } catch (error) {
      console.error('[YumerApiV2] Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Busca todas as mensagens recentes de todos os chats
   * Usado para identificar chats ativos e suas mensagens
   */
  async getAllRecentMessages(instanceId: string, limit = 200): Promise<MessageInfo[]> {
    return this.searchMessages(instanceId, { 
      limit: Math.min(limit, 500), // API v2.2.1 limita a 50 por página, mas podemos fazer múltiplas requisições
      sortOrder: 'desc'
    });
  }

  /**
   * Busca mensagens de um chat específico
   */
  async findMessages(instanceId: string, remoteJid: string, limit = 50): Promise<MessageInfo[]> {
    return this.searchMessages(instanceId, { 
      remoteJid, 
      limit: Math.min(limit, 50),
      sortOrder: 'desc'
    });
  }

  /**
   * Busca chats diretamente via endpoint search/chats da API v2.2.1
   */
  async searchChats(instanceId: string, page: number = 1): Promise<{ chats: ChatInfo[]; totalPages: number }> {
    try {
      console.log(`🔍 [YumerApiV2] searchChats INICIADO - Instância: ${instanceId}, Página: ${page}`);
      
      // Testar diferentes formatos de endpoint
      const endpoints = [
        `/api/v2/instance/${instanceId}/chat/search/chats?page=${page}&sort=desc`,
        `/api/v2/instance/${instanceId}/chat/search/chats`,
        `/api/v2/instance/${instanceId}/chats/search`
      ];
      
      let response = null;
      let usedEndpoint = '';
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🌐 [YumerApiV2] Tentando endpoint: ${endpoint}`);
          
          if (endpoint.includes('?')) {
            // GET request
            response = await this.makeRequest<any>(endpoint, {
              method: 'GET'
            }, true, instanceId);
          } else {
            // POST request
            response = await this.makeRequest<any>(endpoint, {
              method: 'POST',
              body: JSON.stringify({
                page: page,
                limit: 50,
                sortOrder: 'desc'
              })
            }, true, instanceId);
          }
          
          usedEndpoint = endpoint;
          console.log(`✅ [YumerApiV2] Endpoint ${endpoint} respondeu com sucesso`);
          break;
          
        } catch (endpointError) {
          console.warn(`⚠️ [YumerApiV2] Endpoint ${endpoint} falhou:`, endpointError);
          continue;
        }
      }
      
      if (!response) {
        throw new Error('Todos os endpoints falharam');
      }

      console.log(`📨 [YumerApiV2] Resposta completa de ${usedEndpoint}:`, {
        response,
        hasChatsPage: response?.ChatsPage ? true : false,
        hasData: response?.data ? true : false,
        hasRecords: response?.records ? true : false,
        keys: Object.keys(response || {})
      });

      const chats: ChatInfo[] = [];
      let totalPages = 1;
      
      // Tentar diferentes estruturas de resposta
      let records = null;
      if (response?.ChatsPage?.records) {
        records = response.ChatsPage.records;
        totalPages = response.ChatsPage.totalPages || 1;
      } else if (response?.data?.records) {
        records = response.data.records;
        totalPages = response.data.totalPages || 1;
      } else if (response?.records) {
        records = response.records;
        totalPages = response.totalPages || 1;
      } else if (Array.isArray(response)) {
        records = response;
      }
      
      if (records && Array.isArray(records)) {
        console.log(`📂 [YumerApiV2] Processando ${records.length} registros:`, records.slice(0, 3));
        
        records.forEach((chatRecord: any) => {
          const remoteJid = chatRecord.remoteJid || chatRecord.id || chatRecord.chatId;
          if (remoteJid) {
            chats.push({
              remoteJid,
              name: chatRecord.name || (remoteJid.includes('@g.us') ? 'Grupo' : undefined),
              isGroup: remoteJid.includes('@g.us'),
              isWaContact: remoteJid.includes('@s.whatsapp.net')
            });
          }
        });
        
        console.log(`✅ [YumerApiV2] ${chats.length} chats processados (Página ${page}/${totalPages})`);
        console.log(`📝 [YumerApiV2] Primeiros chats:`, chats.slice(0, 3));
        
        return { chats, totalPages };
      }

      console.log(`⚠️ [YumerApiV2] Nenhum chat encontrado na resposta. Estrutura:`, response);
      return { chats: [], totalPages: 1 };
      
    } catch (error) {
      console.error(`❌ [YumerApiV2] Erro crítico em searchChats:`, {
        error,
        instanceId,
        page,
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      return { chats: [], totalPages: 1 };
    }
  }

  /**
   * Busca contatos diretamente via endpoint search/contacts da API v2.2.1
   */
  async searchContacts(instanceId: string, page: number = 1): Promise<{ contacts: ContactRecord[]; totalPages: number }> {
    try {
      console.log(`👥 [YumerApiV2] Buscando contatos - Instância: ${instanceId}, Página: ${page}`);
      
      const response = await this.makeRequest<any>(`/api/v2/instance/${instanceId}/chat/search/contacts?page=${page}&sort=desc`, {
        method: 'GET'
      }, true, instanceId);

      const contacts: ContactRecord[] = [];
      
      if (response?.ContactsPage?.records && Array.isArray(response.ContactsPage.records)) {
        contacts.push(...response.ContactsPage.records);
        
        console.log(`👥 [YumerApiV2] Contatos encontrados: ${contacts.length}/${response.ContactsPage.totalRecords} (Página ${response.ContactsPage.currentPage}/${response.ContactsPage.totalPages})`);
        
        return {
          contacts,
          totalPages: response.ContactsPage.totalPages || 1
        };
      }

      return { contacts: [], totalPages: 1 };
    } catch (error) {
      console.error('[YumerApiV2] Erro ao buscar contatos:', error);
      return { contacts: [], totalPages: 1 };
    }
  }

  /**
   * Busca todos os contatos com paginação automática
   */
  async getAllContacts(instanceId: string): Promise<ContactRecord[]> {
    try {
      console.log(`📋 [YumerApiV2] Iniciando busca completa de contatos para: ${instanceId}`);
      
      const allContacts: ContactRecord[] = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const result = await this.searchContacts(instanceId, currentPage);
        allContacts.push(...result.contacts);
        totalPages = result.totalPages;
        
        console.log(`📄 [YumerApiV2] Página ${currentPage}/${totalPages} - ${result.contacts.length} contatos`);
        
        currentPage++;
        
        // Pequena pausa entre requisições
        if (currentPage <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (currentPage <= totalPages);

      console.log(`✅ [YumerApiV2] Busca completa finalizada: ${allContacts.length} contatos total`);
      return allContacts;
    } catch (error) {
      console.error('❌ [YumerApiV2] Erro ao buscar todos os contatos:', error);
      return [];
    }
  }

  /**
   * Busca todos os chats com paginação automática
   */
  async getAllChats(instanceId: string): Promise<ChatInfo[]> {
    try {
      console.log(`🚀 [YumerApiV2] getAllChats INICIADO para instância: ${instanceId}`);
      
      // Verificar conectividade antes de buscar
      console.log(`🔗 [YumerApiV2] Verificando conectividade da instância...`);
      const connectionState = await this.getConnectionState(instanceId);
      console.log(`📊 [YumerApiV2] Estado da conexão:`, connectionState);
      
      const allChats: ChatInfo[] = [];
      let currentPage = 1;
      let totalPages = 1;
      let hasError = false;

      do {
        console.log(`📖 [YumerApiV2] Processando página ${currentPage}/${totalPages}...`);
        
        try {
          const { chats, totalPages: pages } = await this.searchChats(instanceId, currentPage);
          
          console.log(`📄 [YumerApiV2] Resultado da página ${currentPage}:`, {
            chatsCount: chats.length,
            totalPages: pages,
            chats: chats.slice(0, 3) // Primeiros 3 para debug
          });
          
          allChats.push(...chats);
          totalPages = pages;
          currentPage++;
          
          // Se não retornou chats na primeira página, pode ser problema na API
          if (currentPage === 2 && chats.length === 0) {
            console.warn(`⚠️ [YumerApiV2] Primeira página retornou 0 chats - possível problema na API`);
            hasError = true;
            break;
          }
          
        } catch (pageError) {
          console.error(`❌ [YumerApiV2] Erro na página ${currentPage}:`, pageError);
          hasError = true;
          break;
        }
        
      } while (currentPage <= totalPages && currentPage <= 10); // Limitar a 10 páginas

      console.log(`🏁 [YumerApiV2] getAllChats FINALIZADO:`, {
        totalChats: allChats.length,
        pagesProcessed: currentPage - 1,
        hasError,
        sampleChats: allChats.slice(0, 5) // Primeiros 5 para debug
      });
      
      // Se não encontrou chats e houve erro, tentar fallback
      if (allChats.length === 0 && hasError) {
        console.warn(`🔄 [YumerApiV2] Tentando fallback para extractChatsFromMessages...`);
        return await this.extractChatsFromMessages(instanceId);
      }
      
      return allChats;
    } catch (error) {
      console.error('💥 [YumerApiV2] Erro crítico em getAllChats:', {
        error,
        instanceId,
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      // Fallback para método antigo se getAllChats falhar completamente
      console.warn(`🔄 [YumerApiV2] Fazendo fallback para extractChatsFromMessages devido a erro crítico...`);
      return await this.extractChatsFromMessages(instanceId);
    }
  }

  /**
   * @deprecated Usar getAllChats() para nova implementação
   * Extrai informações dos chats a partir das mensagens com paginação
   */
  async extractChatsFromMessages(instanceId: string): Promise<ChatInfo[]> {
    try {
      console.log(`🔍 [YumerApiV2] Extraindo chats das mensagens para instância: ${instanceId}`);
      
      // Buscar primeira página para verificar total de páginas
      const firstPageResponse = await this.makeRequest<any>(`/api/v2/instance/${instanceId}/chat/search/messages`, {
        method: 'POST',
        body: JSON.stringify({
          limit: 50,
          offset: 0,
          sortOrder: 'desc'
        })
      }, true, instanceId);

      let allMessages: MessageInfo[] = [];
      
      if (firstPageResponse?.MessagesPage?.records) {
        allMessages = [...firstPageResponse.MessagesPage.records];
        const totalPages = firstPageResponse.MessagesPage.totalPages || 1;
        
        console.log(`📄 [YumerApiV2] Total de páginas: ${totalPages}, primeira página: ${allMessages.length} mensagens`);
        
        // Se há mais páginas, buscar todas (limitando a 10 páginas para evitar timeout)
        const maxPages = Math.min(totalPages, 10);
        if (maxPages > 1) {
          console.log(`📋 [YumerApiV2] Buscando ${maxPages - 1} páginas adicionais...`);
          
          const pagePromises = [];
          for (let page = 2; page <= maxPages; page++) {
            pagePromises.push(
              this.makeRequest<any>(`/api/v2/instance/${instanceId}/chat/search/messages`, {
                method: 'POST',
                body: JSON.stringify({
                  limit: 50,
                  offset: (page - 1) * 50,
                  sortOrder: 'desc'
                })
              }, true, instanceId)
            );
          }
          
          const additionalPages = await Promise.all(pagePromises);
          
          additionalPages.forEach(pageResponse => {
            if (pageResponse?.MessagesPage?.records) {
              allMessages.push(...pageResponse.MessagesPage.records);
            }
          });
        }
      }

      console.log(`💬 [YumerApiV2] Total de mensagens coletadas: ${allMessages.length}`);

      const chatsMap = new Map<string, ChatInfo>();

      // Agrupar mensagens por remoteJid para identificar chats únicos
      allMessages.forEach(message => {
        if (message.key?.remoteJid && !chatsMap.has(message.key.remoteJid)) {
          const chat: ChatInfo = {
            remoteJid: message.key.remoteJid,
            name: message.pushName || message.key.remoteJid.split('@')[0],
            isGroup: message.key.remoteJid.includes('@g.us'),
            isWaContact: message.key.remoteJid.includes('@s.whatsapp.net')
          };
          chatsMap.set(message.key.remoteJid, chat);
        }
      });

      const chats = Array.from(chatsMap.values());
      console.log(`📂 [YumerApiV2] Chats únicos extraídos: ${chats.length}`);
      
      return chats;
    } catch (error) {
      console.error('[YumerApiV2] Erro ao extrair chats das mensagens:', error);
      return [];
    }
  }

  // ==================== CONTACT MANAGEMENT (v2.2.1) ====================

  /**
   * Lista todos os contatos
   */
  async findContacts(instanceId: string): Promise<ContactInfo[]> {
    return this.makeRequest<ContactInfo[]>(`/api/v2/chat/findContacts/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Obtém foto do perfil de um contato
   */
  async getProfilePic(instanceId: string, number: string): Promise<{ profilePicUrl: string }> {
    return this.makeRequest<{ profilePicUrl: string }>(`/api/v2/chat/getProfilePic/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({ number })
    }, true, instanceId);
  }

  // ==================== INSTANCE SETTINGS (v2.2.1) ====================

  /**
   * Define foto do perfil da instância
   */
  async setProfilePic(instanceId: string, picture: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/chat/setProfilePic/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ picture })
    }, true, instanceId);
  }

  /**
   * Define nome do perfil da instância
   */
  async setProfileName(instanceId: string, name: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v2/chat/setProfileName/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    }, true, instanceId);
  }

  // ==================== LEGACY COMPATIBILITY METHODS ====================

  /**
   * @deprecated Use listBusinessInstances instead - Este método não funciona na v2.2.1
   */
  async listInstances(): Promise<Instance[]> {
    console.warn('[YumerApiV2.2.1] listInstances() is deprecated and not available in v2.2.1');
    console.warn('[YumerApiV2.2.1] Use listBusinessInstances(businessId) instead');
    // Retornar array vazio para manter compatibilidade
    return [];
  }

  /**
   * @deprecated Use createBusinessInstance instead - Este método não funciona na v2.2.1
   */
  async createInstance(instanceName: string, token?: string, qrcode = true, number?: string): Promise<Instance> {
    console.warn('[YumerApiV2.2.1] createInstance() is deprecated and not available in v2.2.1');
    console.warn('[YumerApiV2.2.1] Use createBusinessInstance(businessId, instanceData) instead');
    throw new Error('createInstance is deprecated in v2.2.1. Use createBusinessInstance(businessId, instanceData) instead');
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Configura a API Key global
   */
  setGlobalApiKey(apiKey: string): void {
    this.globalApiKey = apiKey;
    console.log(`[YumerApiV2.2.1] ✅ API Key configurada: ${apiKey ? 'Sim' : 'Não'}`);
    
    // Salvar no localStorage para persistência
    if (typeof window !== 'undefined' && apiKey) {
      localStorage.setItem('yumer_global_api_key', apiKey);
    }
  }

  /**
   * Configura a URL base da API
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  /**
   * Obtém configurações atuais
   */
  getConfig(): { baseUrl: string; hasApiKey: boolean; version: string } {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.globalApiKey,
      version: 'v2.2.1'
    };
  }

  // ==================== WEBHOOK CONFIGURATION (v2.2.1) ====================

  /**
   * Configura webhook para uma instância (nova implementação v2.2.1)
   */
  async setInstanceWebhook(instanceId: string, webhookUrl: string, events?: string[]): Promise<any> {
    const defaultEvents = [
      'qr.updated',
      'connection.update', 
      'messages.upsert',
      'chats.upsert',
      'contacts.upsert'
    ];

    return this.makeRequest(`/api/v2/webhook/set/${instanceId}`, {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        events: events || defaultEvents,
        webhook_by_events: true
      })
    }, true, instanceId);
  }

  /**
   * Obtém configuração do webhook (nova implementação v2.2.1)
   */
  async getWebhookConfig(instanceId: string): Promise<any> {
    return this.makeRequest(`/api/v2/webhook/find/${instanceId}`, {
      method: 'GET'
    }, true, instanceId);
  }

  /**
   * Configura webhook automaticamente para instância
   */
  async configureInstanceWebhook(instanceId: string): Promise<boolean> {
    try {
      const webhookUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-unified-webhook';
      
      console.log(`🔗 [WEBHOOK-CONFIG] Configurando webhook para ${instanceId}...`);
      
      const result = await this.setInstanceWebhook(instanceId, webhookUrl);
      
      console.log(`✅ [WEBHOOK-CONFIG] Webhook configurado:`, result);
      
      return true;
    } catch (error) {
      console.error(`❌ [WEBHOOK-CONFIG] Erro ao configurar webhook:`, error);
      return false;
    }
  }
}

// Singleton instance com configuração automática da API key
export const yumerApiV2 = new YumerApiV2Service();

// Configurar API key padrão na inicialização
if (typeof window !== 'undefined') {
  // Tentar pegar API key do localStorage primeiro
  const storedApiKey = localStorage.getItem('yumer_global_api_key');
  if (storedApiKey) {
    yumerApiV2.setGlobalApiKey(storedApiKey);
  } else {
    // Se não houver API key salva, usar a padrão do environment
    import('@/config/environment').then(({ auth }) => {
      if (auth.adminToken) {
        yumerApiV2.setGlobalApiKey(auth.adminToken);
        console.log('[YumerApiV2.2.1] 🔑 Usando API Key padrão do environment');
      }
    });
  }
}

export default yumerApiV2;
