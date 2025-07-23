
// Serviço simplificado para compatibilidade com código legado
// Usa exclusivamente yumerApiService internamente
import { yumerApiService } from './yumerApiService';
import type {
  SendTextMessageRequest,
  SendMediaMessageRequest,
  WebhookSetRequest,
  WhatsAppNumbersRequest
} from './yumerApiService';

class YumerWhatsappService {
  // Método para configurar webhook automaticamente
  async ensureWebhookConfigured(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!instanceJWT) {
        throw new Error('Instance JWT is required');
      }

      const webhookConfig: WebhookSetRequest = {
        enabled: true,
        url: import.meta.env.VITE_YUMER_WEBHOOK_URL || 'https://webhook.site/test',
        events: {
          qrcodeUpdated: true,
          messagesUpsert: true,
          messagesUpdated: true,
          sendMessage: true,
          contactsUpsert: true,
          chatsUpsert: true,
          chatsUpdated: true,
          connectionUpdated: true,
          statusInstance: true,
          refreshToken: true
        }
      };

      await yumerApiService.setWebhook(instanceId, webhookConfig, instanceJWT);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Método para enviar mensagem de texto
  async sendMessage(instanceId: string, chatId: string, message: string, instanceJWT?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!instanceJWT) {
        throw new Error('Instance JWT is required');
      }

      const messageData: SendTextMessageRequest = {
        number: chatId,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: message
        }
      };

      const data = await yumerApiService.sendTextMessage(instanceId, messageData, instanceJWT);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Método para testar conexão
  async testConnection(instanceId: string, instanceJWT?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!instanceJWT) {
        throw new Error('Instance JWT is required');
      }

      await yumerApiService.getConnectionState(instanceId, instanceJWT);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Método para validar números do WhatsApp
  async validateNumbers(instanceId: string, numbers: string[], instanceJWT?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!instanceJWT) {
        throw new Error('Instance JWT is required');
      }

      const data = await yumerApiService.validateWhatsAppNumbers(instanceId, { numbers }, instanceJWT);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Métodos vazios para compatibilidade com código legado
  async getChats(instanceId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    console.warn('getChats: Not implemented in Yumer API v2');
    return { success: false, error: 'Not implemented in Yumer API v2' };
  }

  async getChatMessages(instanceId: string, chatId: string, options?: any): Promise<{ success: boolean; data?: any[]; error?: string }> {
    console.warn('getChatMessages: Not implemented in Yumer API v2');
    return { success: false, error: 'Not implemented in Yumer API v2' };
  }

  async configureWebhook(instanceId: string, config?: any): Promise<{ success: boolean; data?: any; error?: string }> {
    console.warn('configureWebhook: Use ensureWebhookConfigured instead');
    return this.ensureWebhookConfigured(instanceId);
  }

  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.warn('getWebhookConfig: Not implemented in current version');
    return { success: false, error: 'Not implemented' };
  }
}

// Instância única do service
export const yumerWhatsappService = new YumerWhatsappService();
export default yumerWhatsappService;

// Re-export para compatibilidade
export { yumerApiService };
