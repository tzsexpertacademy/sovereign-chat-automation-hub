/**
 * Cliente YumerFlow - Serviço Unificado para WhatsApp API v2.2.1
 * Baseado na API CodeChat v2.2.1: https://docs.codechat.dev/api/v2.2.1
 * Específico para operações do painel do cliente
 */

import { supabase } from '@/integrations/supabase/client';

export interface ClientInstance {
  instanceId: string;
  instanceName: string;
  status: 'open' | 'close' | 'connecting';
  owner?: string;
  profileName?: string;
  profilePicUrl?: string;
  phoneNumber?: string;
  businessId?: string;
  customName?: string;
  qrCode?: string;
  hasQrCode?: boolean;
}

export interface ConnectionState {
  instance: string;
  state: 'open' | 'close' | 'connecting';
}

export interface QRCodeResponse {
  code: string;
  base64: string;
}

export interface SendMessageData {
  number: string;
  text?: string;
  media?: {
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string;
    caption?: string;
    filename?: string;
  };
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  events: string[];
  webhook_by_events: boolean;
  webhook_base64: boolean;
}

export interface ChatInfo {
  remoteJid: string;
  name?: string;
  isGroup: boolean;
  isWaContact: boolean;
  unreadCount?: number;
  lastMessage?: any;
}

export interface MessageInfo {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message: any;
  messageTimestamp: number;
  status?: string;
}

class ClientYumerService {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseUrl = 'https://api.yumer.com.br';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Faz requisição autenticada usando business_token do cliente
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    businessToken: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = new Headers(this.defaultHeaders);
    headers.set('Authorization', `Bearer ${businessToken}`);
    
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        headers.set(key, value as string);
      });
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Obtém business_token do cliente do Supabase
   */
  private async getBusinessToken(clientId: string): Promise<string> {
    const { data, error } = await supabase
      .from('clients')
      .select('business_token')
      .eq('id', clientId)
      .single();

    if (error || !data?.business_token) {
      throw new Error('Business token não encontrado para este cliente');
    }

    return data.business_token;
  }

  // ========== GESTÃO DE INSTÂNCIAS ==========

  /**
   * Lista todas as instâncias do cliente
   */
  async listClientInstances(clientId: string): Promise<ClientInstance[]> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<{ data: any[] }>(
        '/api/v2/business/instances',
        { method: 'GET' },
        businessToken
      );

      return response.data.map(instance => ({
        instanceId: instance.instanceId,
        instanceName: instance.instanceName,
        status: instance.status || 'close',
        owner: instance.owner,
        profileName: instance.profileName,
        profilePicUrl: instance.profilePictureUrl,
        businessId: instance.businessId
      }));
    } catch (error) {
      console.error('Erro ao listar instâncias:', error);
      return [];
    }
  }

  /**
   * Cria nova instância
   */
  async createInstance(clientId: string, instanceName: string, description?: string): Promise<ClientInstance> {
    const businessToken = await this.getBusinessToken(clientId);
    
    const response = await this.makeRequest<{ data: any }>(
      '/api/v2/instance',
      {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          integration: 'WHATSAPP-BAILEYS'
        })
      },
      businessToken
    );

    return {
      instanceId: response.data.instanceId,
      instanceName: response.data.instanceName,
      status: 'close',
      businessId: response.data.businessId
    };
  }

  /**
   * Conecta instância e obtém QR Code
   */
  async connectInstance(clientId: string, instanceName: string): Promise<QRCodeResponse | null> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<{ data: { code: string; base64: string } }>(
        `/api/v2/instance/connect/${instanceName}`,
        { method: 'POST' },
        businessToken
      );
      
      return {
        code: response.data.code,
        base64: response.data.base64
      };
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      return null;
    }
  }

  /**
   * Desconecta instância
   */
  async disconnectInstance(clientId: string, instanceName: string): Promise<boolean> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      await this.makeRequest(
        `/api/v2/instance/${instanceName}/logout`,
        { method: 'POST' },
        businessToken
      );
      return true;
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      return false;
    }
  }

  /**
   * Exclui instância
   */
  async deleteInstance(clientId: string, instanceName: string): Promise<boolean> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      await this.makeRequest(
        `/api/v2/instance/${instanceName}`,
        { method: 'DELETE' },
        businessToken
      );
      return true;
    } catch (error) {
      console.error('Erro ao excluir instância:', error);
      return false;
    }
  }

  /**
   * Obtém estado da conexão via getInstance (v2.2.1)
   */
  async getConnectionState(clientId: string, instanceName: string): Promise<ConnectionState | null> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<{ data: any }>(
        `/api/v2/instance/${instanceName}`,
        { method: 'GET' },
        businessToken
      );
      
      return {
        instance: response.data.instanceId,
        state: response.data.status || 'close'
      };
    } catch (error) {
      console.error('Erro ao obter estado da conexão:', error);
      return null;
    }
  }

  // ========== CONFIGURAÇÃO DE WEBHOOK ==========

  /**
   * Configura webhook para a instância
   */
  async setWebhook(clientId: string, instanceName: string, webhookUrl: string): Promise<boolean> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      await this.makeRequest(
        `/webhook/set/${instanceName}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            enabled: true,
            url: webhookUrl,
            events: [
              'qrcode.updated',
              'connection.update',
              'messages.upsert',
              'chats.upsert',
              'contacts.upsert'
            ],
            webhook_by_events: true,
            webhook_base64: false
          })
        },
        businessToken
      );
      return true;
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
      return false;
    }
  }

  /**
   * Obtém configuração do webhook
   */
  async getWebhook(clientId: string, instanceName: string): Promise<WebhookConfig | null> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<WebhookConfig>(
        `/webhook/find/${instanceName}`,
        { method: 'GET' },
        businessToken
      );
      return response;
    } catch (error) {
      console.error('Erro ao obter webhook:', error);
      return null;
    }
  }

  // ========== ENVIO DE MENSAGENS ==========

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(clientId: string, instanceName: string, number: string, text: string): Promise<boolean> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      await this.makeRequest(
        `/message/sendText/${instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify({ number, text })
        },
        businessToken
      );
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return false;
    }
  }

  /**
   * Envia mídia
   */
  async sendMedia(clientId: string, instanceName: string, data: SendMessageData): Promise<boolean> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      await this.makeRequest(
        `/message/sendMedia/${instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        businessToken
      );
      return true;
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      return false;
    }
  }

  /**
   * Envia áudio do WhatsApp
   */
  async sendWhatsAppAudio(clientId: string, instanceName: string, number: string, audio: string): Promise<boolean> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      await this.makeRequest(
        `/message/sendWhatsAppAudio/${instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify({ number, audio })
        },
        businessToken
      );
      return true;
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      return false;
    }
  }

  // ========== CONVERSAS E CONTATOS ==========

  /**
   * Busca conversas
   */
  async findChats(clientId: string, instanceName: string): Promise<ChatInfo[]> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<ChatInfo[]>(
        `/chat/findChats/${instanceName}`,
        { method: 'GET' },
        businessToken
      );
      return response;
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      return [];
    }
  }

  /**
   * Busca mensagens de uma conversa
   */
  async findMessages(clientId: string, instanceName: string, remoteJid: string = ''): Promise<MessageInfo[]> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<MessageInfo[]>(
        `/chat/findMessages/${instanceName}`,
        {
          method: 'POST',
          body: JSON.stringify({ remoteJid })
        },
        businessToken
      );
      return response;
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Busca contatos
   */
  async findContacts(clientId: string, instanceName: string): Promise<any[]> {
    const businessToken = await this.getBusinessToken(clientId);
    
    try {
      const response = await this.makeRequest<any[]>(
        `/chat/findContacts/${instanceName}`,
        { method: 'POST' },
        businessToken
      );
      return response;
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      return [];
    }
  }

  // ========== UTILITÁRIOS ==========

  /**
   * Verifica se uma instância existe no Supabase
   */
  async instanceExistsInDatabase(instanceId: string): Promise<boolean> {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('instance_id', instanceId)
      .single();
    
    return !!data;
  }

  /**
   * Atualiza status da instância no Supabase
   */
  async updateInstanceStatus(instanceId: string, status: string, phoneNumber?: string): Promise<void> {
    const updates: any = { 
      status,
      updated_at: new Date().toISOString()
    };
    
    if (phoneNumber) {
      updates.phone_number = phoneNumber;
    }
    
    await supabase
      .from('whatsapp_instances')
      .update(updates)
      .eq('instance_id', instanceId);
  }

  /**
   * Salva QR Code no Supabase
   */
  async saveQRCode(instanceId: string, qrCode: string): Promise<void> {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrCode,
        has_qr_code: true,
        qr_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
        status: 'qr_ready',
        updated_at: new Date().toISOString()
      })
      .eq('instance_id', instanceId);
  }
}

// Singleton instance
const clientYumerService = new ClientYumerService();

export default clientYumerService;