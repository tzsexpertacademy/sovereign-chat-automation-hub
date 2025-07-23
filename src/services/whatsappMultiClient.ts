
/**
 * LEGACY COMPATIBILITY SERVICE
 * Este serviço mantém compatibilidade TOTAL com código existente
 * Redirecionando para o novo yumerApiV2Service
 */

import yumerApiV2 from './yumerApiV2Service';

export interface WhatsAppClient {
  instanceId: string;
  instanceName: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_ready';
  phone?: string;
  profileName?: string;
  // Propriedades legacy necessárias para compatibilidade
  clientId: string;
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
}

export interface SendMessageOptions {
  to: string;
  message: string;
  instanceId?: string;
}

export interface SendMessageResult {
  success: boolean;
  error?: string;
  details?: any;
  messageId?: string;
  timestamp?: number;
}

export interface SendMediaOptions {
  to: string;
  media: string;
  caption?: string;
  instanceId?: string;
}

export interface SendMediaResult {
  success: boolean;
  error?: string;
  details?: any;
}

export interface QueuedMessage {
  id: string;
  to: string;
  message: string;
  timestamp: number;
  from?: string;
  body?: string;
}

export class WhatsAppMultiClient {
  private apiKey: string = '';
  private clients: WhatsAppClient[] = [];
  private statusListeners: Array<(client: WhatsAppClient) => void> = [];
  private socket: any = null;

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    yumerApiV2.setGlobalApiKey(apiKey);
  }

  async getClients(): Promise<WhatsAppClient[]> {
    try {
      const instances = await yumerApiV2.listInstances();
      this.clients = instances.map(instance => ({
        instanceId: instance.instanceName,
        instanceName: instance.instanceName,
        clientId: instance.instanceName,
        status: this.mapStatus(instance.status || 'close'),
        phone: instance.owner,
        phoneNumber: instance.owner,
        profileName: instance.profileName,
        hasQrCode: false,
        qrCode: undefined
      }));
      return this.clients;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error getting clients:', error);
      return [];
    }
  }

  // Alias para compatibilidade
  async getAllClients(): Promise<WhatsAppClient[]> {
    return this.getClients();
  }

  private mapStatus(apiStatus: string): 'connected' | 'disconnected' | 'connecting' | 'qr_ready' {
    switch (apiStatus) {
      case 'open': return 'connected';
      case 'connecting': return 'connecting';
      case 'qr_ready': return 'qr_ready';
      default: return 'disconnected';
    }
  }

  async createInstance(instanceName: string): Promise<boolean> {
    try {
      await yumerApiV2.createInstance(instanceName);
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error creating instance:', error);
      return false;
    }
  }

  async connectInstance(instanceName: string): Promise<boolean> {
    try {
      await yumerApiV2.connectInstance(instanceName);
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error connecting instance:', error);
      return false;
    }
  }

  // Métodos legacy necessários para compatibilidade
  async connectClient(clientId: string): Promise<boolean> {
    return this.connectInstance(clientId);
  }

  async disconnectClient(clientId: string): Promise<boolean> {
    try {
      await yumerApiV2.logoutInstance(clientId);
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error disconnecting client:', error);
      return false;
    }
  }

  async getQRCode(instanceName: string): Promise<string | null> {
    try {
      const result = await yumerApiV2.getQRCode(instanceName);
      return result.qrcode?.code || null;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error getting QR code:', error);
      return null;
    }
  }

  // MÉTODO PRINCIPAL: sendTextMessage (compatível com TicketChatInterface)
  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    try {
      if (!options.instanceId) {
        return { success: false, error: 'Instance ID is required' };
      }
      const result = await yumerApiV2.sendText(options.instanceId, options.to, options.message);
      return {
        success: true,
        messageId: result?.key?.id || `msg-${Date.now()}`,
        timestamp: Date.now(),
        details: result
      };
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }

  // MÉTODO LEGACY: sendMessage (3 parâmetros para compatibilidade)
  async sendMessage(instanceId: string, to: string, message: string): Promise<SendMessageResult>;
  async sendMessage(options: SendMessageOptions): Promise<boolean>;
  async sendMessage(
    instanceIdOrOptions: string | SendMessageOptions, 
    to?: string, 
    message?: string
  ): Promise<SendMessageResult | boolean> {
    // Se foi chamado com 3 parâmetros (instanceId, to, message)
    if (typeof instanceIdOrOptions === 'string' && to && message) {
      const result = await this.sendTextMessage({
        instanceId: instanceIdOrOptions,
        to,
        message
      });
      return result;
    }
    
    // Se foi chamado com objeto options
    if (typeof instanceIdOrOptions === 'object') {
      const result = await this.sendTextMessage(instanceIdOrOptions);
      return result.success;
    }
    
    return { success: false, error: 'Invalid parameters' };
  }

  async sendMedia(instanceId: string, to: string, file: File, caption?: string): Promise<SendMediaResult>;
  async sendMedia(options: SendMediaOptions): Promise<boolean>;
  async sendMedia(
    instanceIdOrOptions: string | SendMediaOptions,
    to?: string,
    fileOrMedia?: File | string,
    caption?: string
  ): Promise<SendMediaResult | boolean> {
    try {
      let instanceId: string;
      let targetTo: string;
      let media: string;
      let mediaCaption: string | undefined;

      if (typeof instanceIdOrOptions === 'string' && to && fileOrMedia) {
        instanceId = instanceIdOrOptions;
        targetTo = to;
        mediaCaption = caption;
        
        if (fileOrMedia instanceof File) {
          // Convert File to base64
          media = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(fileOrMedia);
          });
        } else {
          media = fileOrMedia;
        }
      } else if (typeof instanceIdOrOptions === 'object') {
        instanceId = instanceIdOrOptions.instanceId || '';
        targetTo = instanceIdOrOptions.to;
        media = instanceIdOrOptions.media;
        mediaCaption = instanceIdOrOptions.caption;
      } else {
        return { success: false, error: 'Invalid parameters' };
      }

      await yumerApiV2.sendMedia(instanceId, {
        number: targetTo,
        media: {
          mediatype: 'image',
          media: media,
          caption: mediaCaption
        }
      });

      return typeof instanceIdOrOptions === 'string' ? 
        { success: true } : 
        true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error sending media:', error);
      return typeof instanceIdOrOptions === 'string' ? 
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' } : 
        false;
    }
  }

  async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      await yumerApiV2.deleteInstance(instanceName);
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error deleting instance:', error);
      return false;
    }
  }

  async getInstanceStatus(instanceName: string): Promise<string> {
    try {
      const result = await yumerApiV2.getConnectionState(instanceName);
      return result.state;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error getting status:', error);
      return 'close';
    }
  }

  // Métodos legacy para compatibilidade com componentes antigos
  async getClientStatus(clientId: string): Promise<string> {
    return this.getInstanceStatus(clientId);
  }

  async testConnection(): Promise<boolean> {
    try {
      await yumerApiV2.listInstances();
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Test connection failed:', error);
      return false;
    }
  }

  async checkServerHealth(): Promise<boolean> {
    return this.testConnection();
  }

  // Métodos de socket/realtime para compatibilidade (simulados)
  connectSocket(): any {
    console.log('[WhatsAppMultiClient] Socket connection simulated for compatibility');
    this.socket = {
      on: (event: string, callback: Function) => {
        console.log(`[WhatsAppMultiClient] Socket event ${event} registered`);
      },
      emit: (event: string, data: any) => {
        console.log(`[WhatsAppMultiClient] Socket emit ${event}:`, data);
      }
    };
    return this.socket;
  }

  disconnect(): void {
    console.log('[WhatsAppMultiClient] Disconnect simulated for compatibility');
    this.socket = null;
  }

  joinClientRoom(clientId: string): void {
    console.log(`[WhatsAppMultiClient] Joined room for client ${clientId} (simulated)`);
  }

  onClientStatus(callback: (client: WhatsAppClient) => void): void {
    this.statusListeners.push(callback);
  }

  offClientStatus(callback: (client: WhatsAppClient) => void): void {
    const index = this.statusListeners.indexOf(callback);
    if (index > -1) {
      this.statusListeners.splice(index, 1);
    }
  }
}

// Exportações para compatibilidade
export const whatsappService = new WhatsAppMultiClient();
export const whatsappMultiClient = new WhatsAppMultiClient();
export default whatsappMultiClient;
