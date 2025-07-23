/**
 * LEGACY COMPATIBILITY SERVICE
 * Redirecionando para yumerApiV2Service mantendo compatibilidade total
 */

import yumerApiV2 from './yumerApiV2Service';

export class CodechatQRService {
  async getQRCodeSimple(instanceName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const result = await yumerApiV2.getQRCode(instanceName);
      return { success: true, qrCode: result.qrcode?.code };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getQRCode(instanceName: string) {
    return this.getQRCodeSimple(instanceName);
  }

  async getInstanceDetails(instanceName: string) {
    try {
      const instances = await yumerApiV2.listInstances();
      const instance = instances.find(i => i.instanceName === instanceName);
      if (instance) {
        return {
          success: true,
          id: instance.instanceName,
          instanceName: instance.instanceName,
          status: instance.status,
          connectionStatus: instance.status || 'close',
          ownerJid: instance.owner,
          profileName: instance.profileName,
          Auth: { jwt: 'legacy-compat' },
          base64: null,
          qrCode: null,
          Whatsapp: {
            qr: null,
            qrCode: null,
            connection: instance.status || 'close'
          },
          ...instance
        };
      }
      throw new Error('Instance not found');
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createInstance(instanceName: string, description?: string) {
    try {
      const result = await yumerApiV2.createInstance(instanceName);
      return {
        success: true,
        ...result,
        qrCode: null,
        error: undefined
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        qrCode: undefined
      };
    }
  }

  async getInstanceStatus(instanceName: string) {
    try {
      const result = await yumerApiV2.getConnectionState(instanceName);
      return {
        ...result,
        statusReason: 'Connection status from v2.2.1 API' // Compatibilidade
      };
    } catch (error) {
      throw error;
    }
  }

  async connectInstance(instanceName: string) {
    try {
      return await yumerApiV2.connectInstance(instanceName);
    } catch (error) {
      throw error;
    }
  }

  async disconnectInstance(instanceName: string) {
    try {
      return await yumerApiV2.logoutInstance(instanceName);
    } catch (error) {
      throw error;
    }
  }

  async deleteInstance(instanceName: string) {
    try {
      return await yumerApiV2.deleteInstance(instanceName);
    } catch (error) {
      throw error;
    }
  }

  async checkInstanceExists(instanceName: string) {
    try {
      const instances = await yumerApiV2.listInstances();
      const exists = instances.some(i => i.instanceName === instanceName);
      return { exists, details: exists ? instances.find(i => i.instanceName === instanceName) : null };
    } catch (error: any) {
      return { exists: false, error: error.message };
    }
  }

  async getAllInstances() {
    try {
      return await yumerApiV2.listInstances();
    } catch (error) {
      throw error;
    }
  }
}

export const codechatQRService = new CodechatQRService();