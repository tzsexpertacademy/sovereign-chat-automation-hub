/**
 * LEGACY COMPATIBILITY SERVICE
 * Redirecionando para yumerApiV2Service
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

  async createInstance(instanceName: string) {
    try {
      return await yumerApiV2.createInstance(instanceName);
    } catch (error) {
      throw error;
    }
  }

  async getInstanceStatus(instanceName: string) {
    try {
      return await yumerApiV2.getConnectionState(instanceName);
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

  async deleteInstance(instanceName: string) {
    try {
      return await yumerApiV2.deleteInstance(instanceName);
    } catch (error) {
      throw error;
    }
  }
}

export const codechatQRService = new CodechatQRService();