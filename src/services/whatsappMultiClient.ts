/**
 * LEGACY COMPATIBILITY SERVICE
 * Este serviço mantém compatibilidade com código existente
 * Redirecionando para o novo yumerApiV2Service
 */

import yumerApiV2 from './yumerApiV2Service';

export interface WhatsAppClient {
  instanceId: string;
  instanceName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  phone?: string;
  profileName?: string;
}

export interface SendMessageOptions {
  to: string;
  message: string;
  instanceId?: string;
}

export interface SendMediaOptions {
  to: string;
  media: string;
  caption?: string;
  instanceId?: string;
}

export class WhatsAppMultiClient {
  private apiKey: string = '';

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    yumerApiV2.setGlobalApiKey(apiKey);
  }

  async getClients(): Promise<WhatsAppClient[]> {
    try {
      const instances = await yumerApiV2.listInstances();
      return instances.map(instance => ({
        instanceId: instance.instanceName,
        instanceName: instance.instanceName,
        status: instance.status === 'open' ? 'connected' : 
                instance.status === 'connecting' ? 'connecting' : 'disconnected',
        phone: instance.owner,
        profileName: instance.profileName
      }));
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error getting clients:', error);
      return [];
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

  async getQRCode(instanceName: string): Promise<string | null> {
    try {
      const result = await yumerApiV2.getQRCode(instanceName);
      return result.qrcode?.code || null;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error getting QR code:', error);
      return null;
    }
  }

  async sendTextMessage(options: SendMessageOptions): Promise<boolean> {
    try {
      if (!options.instanceId) return false;
      await yumerApiV2.sendText(options.instanceId, options.to, options.message);
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error sending message:', error);
      return false;
    }
  }

  async sendMedia(options: SendMediaOptions): Promise<boolean> {
    try {
      if (!options.instanceId) return false;
      await yumerApiV2.sendMedia(options.instanceId, {
        number: options.to,
        media: {
          mediatype: 'image',
          media: options.media,
          caption: options.caption
        }
      });
      return true;
    } catch (error) {
      console.error('[WhatsAppMultiClient] Error sending media:', error);
      return false;
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
}

// Singleton instance para compatibilidade
export const whatsappMultiClient = new WhatsAppMultiClient();
export default whatsappMultiClient;