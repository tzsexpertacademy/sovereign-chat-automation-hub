// Stub para compatibilidade - agora use yumerApiService
import { yumerApiService } from './yumerApiService';

console.warn('⚠️ codechatQRService foi removido. Use yumerApiService em vez disso.');

export const codechatQRService = {
  createInstance: (name: string) => Promise.resolve({ success: true, instanceName: name }),
  deleteInstance: (name: string) => Promise.resolve({ success: true }),
  getInstanceStatus: (name: string) => Promise.resolve({ status: 'open', qrcode: null }),
  getInstanceDetails: (name: string) => Promise.resolve({ status: 'open', qrcode: null }),
  getQRCode: (name: string) => yumerApiService.getQRCode(name, 'base64'),
  getQRCodeSimple: (name: string) => yumerApiService.getQRCode(name, 'base64'),
  connectInstance: (name: string) => yumerApiService.connectInstance(name, 'qr'),
  disconnectInstance: (name: string) => Promise.resolve({ success: true }),
  checkInstanceExists: () => Promise.resolve(true),
};

export default codechatQRService;