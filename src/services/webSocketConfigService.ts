import { supabase } from '@/integrations/supabase/client';

interface WebSocketConfig {
  enabled: boolean;
  events: {
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
  };
}

export class WebSocketConfigService {
  private static instance: WebSocketConfigService;
  private configCache = new Map<string, WebSocketConfig>();

  static getInstance(): WebSocketConfigService {
    if (!this.instance) {
      this.instance = new WebSocketConfigService();
    }
    return this.instance;
  }

  private getDefaultConfig(): WebSocketConfig {
    return {
      enabled: true,
      events: {
        qrcodeUpdate: true,
        stateInstance: false,
        messagesSet: false,
        messagesUpsert: true,      // ✅ Mensagens novas
        messagesUpdate: true,      // ✅ Atualizações de mensagem
        sendMessage: true,         // ✅ Confirmações de envio
        contactsSet: false,
        contactsUpsert: false,
        contactsUpdate: false,
        presenceUpdate: true,      // ✅ Status de presença
        chatsSet: false,
        chatsUpdate: false,
        chatsUpsert: false,
        groupsUpsert: false,
        groupUpdate: false,
        groupParticipantsUpdate: false,
        connectionUpdate: true,    // ✅ Status da conexão
        callUpsert: false
      }
    };
  }

  async configureWebSocket(instanceId: string): Promise<boolean> {
    try {
      console.log('🔧 [WEBSOCKET-CONFIG] Configurando WebSocket para instância:', instanceId);

      const config = this.getDefaultConfig();
      
      // Buscar business token para autenticação
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('auth_jwt')
        .eq('instance_id', instanceId)
        .single();

      if (!instance?.auth_jwt) {
        console.error('❌ [WEBSOCKET-CONFIG] Token JWT não encontrado para instância');
        return false;
      }
      
      const url = `https://api.yumer.com.br/api/v2/instance/${instanceId}/socket`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${instance.auth_jwt}`
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        const data = await response.json();
        this.configCache.set(instanceId, config);
        console.log('✅ [WEBSOCKET-CONFIG] WebSocket configurado com sucesso:', data);
        return true;
      } else {
        const error = await response.text();
        console.error('❌ [WEBSOCKET-CONFIG] Erro ao configurar WebSocket:', error);
        return false;
      }
    } catch (error) {
      console.error('❌ [WEBSOCKET-CONFIG] Erro crítico ao configurar WebSocket:', error);
      return false;
    }
  }

  async getWebSocketConfig(instanceId: string): Promise<WebSocketConfig | null> {
    try {
      // Verificar cache primeiro
      if (this.configCache.has(instanceId)) {
        return this.configCache.get(instanceId)!;
      }

      console.log('📡 [WEBSOCKET-CONFIG] Buscando configuração WebSocket:', instanceId);

      const url = `https://api.yumer.com.br/api/v2/instance/${instanceId}/socket`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        const config: WebSocketConfig = {
          enabled: data.enabled,
          events: data.SocketEvents
        };
        
        this.configCache.set(instanceId, config);
        console.log('✅ [WEBSOCKET-CONFIG] Configuração obtida:', config);
        return config;
      } else {
        console.warn('⚠️ [WEBSOCKET-CONFIG] WebSocket não configurado, usando padrão');
        return this.getDefaultConfig();
      }
    } catch (error) {
      console.error('❌ [WEBSOCKET-CONFIG] Erro ao obter configuração:', error);
      return this.getDefaultConfig();
    }
  }

  async updateWebSocketConfig(instanceId: string, config: Partial<WebSocketConfig>): Promise<boolean> {
    try {
      console.log('🔄 [WEBSOCKET-CONFIG] Atualizando configuração WebSocket:', instanceId);

      const currentConfig = await this.getWebSocketConfig(instanceId) || this.getDefaultConfig();
      const updatedConfig = { ...currentConfig, ...config };

      const url = `https://api.yumer.com.br/api/v2/instance/${instanceId}/socket`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        this.configCache.set(instanceId, updatedConfig);
        console.log('✅ [WEBSOCKET-CONFIG] Configuração atualizada com sucesso');
        return true;
      } else {
        const error = await response.text();
        console.error('❌ [WEBSOCKET-CONFIG] Erro ao atualizar configuração:', error);
        return false;
      }
    } catch (error) {
      console.error('❌ [WEBSOCKET-CONFIG] Erro crítico ao atualizar configuração:', error);
      return false;
    }
  }

  async deleteWebSocketConfig(instanceId: string): Promise<boolean> {
    try {
      console.log('🗑️ [WEBSOCKET-CONFIG] Removendo configuração WebSocket:', instanceId);

      const url = `https://api.yumer.com.br/api/v2/instance/${instanceId}/socket`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        this.configCache.delete(instanceId);
        console.log('✅ [WEBSOCKET-CONFIG] Configuração removida com sucesso');
        return true;
      } else {
        const error = await response.text();
        console.error('❌ [WEBSOCKET-CONFIG] Erro ao remover configuração:', error);
        return false;
      }
    } catch (error) {
      console.error('❌ [WEBSOCKET-CONFIG] Erro crítico ao remover configuração:', error);
      return false;
    }
  }

  async ensureWebSocketConfigured(instanceId: string): Promise<boolean> {
    try {
      const currentConfig = await this.getWebSocketConfig(instanceId);
      
      if (!currentConfig || !currentConfig.enabled) {
        console.log('🔧 [WEBSOCKET-CONFIG] WebSocket não configurado, configurando automaticamente...');
        return await this.configureWebSocket(instanceId);
      }

      console.log('✅ [WEBSOCKET-CONFIG] WebSocket já configurado');
      return true;
    } catch (error) {
      console.error('❌ [WEBSOCKET-CONFIG] Erro ao verificar configuração:', error);
      return false;
    }
  }

  clearCache(): void {
    this.configCache.clear();
    console.log('🧹 [WEBSOCKET-CONFIG] Cache limpo');
  }
}

export const webSocketConfigService = WebSocketConfigService.getInstance();