/**
 * @deprecated Usar unifiedYumerService para novas implementações
 * Este arquivo redireciona para o serviço unificado
 */

import unifiedYumerService from './unifiedYumerService';

// Re-export tipos para compatibilidade
export interface YumerInstance {
  id: number;
  name: string;
  description?: string;
  connectionStatus: string;
  ownerJid?: string;
  profilePicUrl?: string;
  Auth: {
    token: string;
  };
}

export interface YumerMessage {
  id: number;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  messageType: string;
  content: any;
  messageTimestamp: number;
  device: string;
}

export interface YumerChat {
  id: string;
  name?: string;
  isGroup: boolean;
  lastMessage?: string;
  unreadCount: number;
}

// Export do objeto para compatibilidade - redireciona para unifiedYumerService
export const yumerWhatsappService = {
  configureWebhook: (instanceId: string) => unifiedYumerService.configureWebhook(instanceId),
  getWebhookConfig: (instanceId: string) => unifiedYumerService.getWebhookConfig(instanceId),
  getChats: (instanceId: string) => unifiedYumerService.getChats(instanceId),
  getChatMessages: (instanceId: string, chatId: string, options?: any) => unifiedYumerService.getChatMessages(instanceId, chatId, options),
  sendMessage: (instanceId: string, chatId: string, message: string) => unifiedYumerService.sendMessage(instanceId, chatId, message),
  ensureWebhookConfigured: (instanceId: string) => unifiedYumerService.ensureWebhookConfigured(instanceId),
  testConnection: (instanceId: string) => unifiedYumerService.testConnection(instanceId)
};

export default unifiedYumerService;