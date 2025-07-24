
/**
 * LEGACY COMPATIBILITY SERVICE
 * Redirecionando para yumerApiV2Service mantendo compatibilidade total
 */

import yumerApiV2 from './yumerApiV2Service';

export interface InstanceDetails {
  success: boolean;
  id: string;
  instanceName: string;
  status: string;
  connectionStatus: string;
  ownerJid: string;
  profileName?: string;
  Auth: { jwt: string };
  base64?: string;
  qrCode?: string;
  Whatsapp: {
    qr?: string;
    qrCode?: string;
    connection: string;
  };
  error?: string;
}

export interface ConnectResult {
  success?: boolean;
  base64?: string;
  qrCode?: string;
  error?: string;
  [key: string]: any;
}

export class CodechatQRService {
  async getQRCodeSimple(instanceName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const result = await yumerApiV2.getQRCode(instanceName);
      return { success: true, qrCode: result.base64 };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getQRCode(instanceName: string) {
    return this.getQRCodeSimple(instanceName);
  }

  async getInstanceDetails(instanceName: string): Promise<InstanceDetails> {
    try {
      const instances = await yumerApiV2.listInstances();
      const instance = instances.find(i => i.instanceName === instanceName);
      if (instance) {
        return {
          success: true,
          id: instance.instanceName,
          instanceName: instance.instanceName,
          status: instance.status || 'close',
          connectionStatus: instance.status === 'open' ? 'ONLINE' : 'OFFLINE',
          ownerJid: instance.owner || '',
          profileName: instance.profileName,
          Auth: { jwt: 'legacy-compat' },
          base64: undefined,
          qrCode: undefined,
          Whatsapp: {
            qr: undefined,
            qrCode: undefined,
            connection: instance.status || 'close'
          }
        };
      }
      throw new Error('Instance not found');
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message,
        id: instanceName,
        instanceName,
        status: 'error',
        connectionStatus: 'OFFLINE',
        ownerJid: '',
        Auth: { jwt: '' },
        Whatsapp: { connection: 'close' }
      };
    }
  }

  async createInstance(instanceName: string, description?: string): Promise<ConnectResult> {
    try {
      const result = await yumerApiV2.createInstance(instanceName);
      return {
        success: true,
        ...result,
        base64: undefined,
        qrCode: undefined
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        base64: undefined,
        qrCode: undefined
      };
    }
  }

  async getInstanceStatus(instanceName: string) {
    try {
      const result = await yumerApiV2.getConnectionState(instanceName);
      return {
        ...result,
        statusReason: 'Connection status from v2.2.1 API'
      };
    } catch (error) {
      throw error;
    }
  }

  async connectInstance(instanceName: string): Promise<ConnectResult> {
    try {
      const result = await yumerApiV2.connectInstance(instanceName);
      // Tentar obter QR Code imediatamente após conectar
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
        const qrResult = await yumerApiV2.getQRCode(instanceName);
        return {
          ...result,
          success: true,
          base64: qrResult.base64,
          qrCode: qrResult.base64
        };
      } catch (qrError) {
        return {
          ...result,
          success: true,
          base64: undefined,
          qrCode: undefined
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        base64: undefined,
        qrCode: undefined
      };
    }
  }

  async disconnectInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await yumerApiV2.logoutInstance(instanceName);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
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
