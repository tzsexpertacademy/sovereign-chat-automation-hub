// Stub para compatibilidade - agora use yumerApiService
import { yumerApiService } from './yumerApiService';

console.warn('⚠️ codechatApiService foi removido. Use yumerApiService em vez disso.');

export const codechatApiService = {
  sendMessage: (instanceName: string, remoteJid: string, message: string) => 
    Promise.resolve({ success: true, messageId: 'msg-123' }),
  getMessages: () => Promise.resolve([]),
  getContacts: () => Promise.resolve([]),
};

export default codechatApiService;