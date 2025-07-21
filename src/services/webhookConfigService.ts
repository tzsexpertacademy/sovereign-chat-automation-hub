
import { yumerWhatsappService } from './yumerWhatsappService';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  events: {
    messagesUpsert: boolean;
    messagesSet: boolean;
    messagesUpdated: boolean;
    connectionUpdated: boolean;
    qrcodeUpdated: boolean;
    statusInstance: boolean;
    sendMessage: boolean;
    chatsUpsert: boolean;
    chatsUpdated: boolean;
    chatsDeleted: boolean;
    contactsUpsert: boolean;
    contactsUpdated: boolean;
    groupsUpsert: boolean;
    groupsUpdated: boolean;
    presenceUpdated: boolean;
    refreshToken: boolean;
  };
}

export const webhookConfigService = {
  // Configurar webhook na instância
  async configureWebhook(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔧 [WEBHOOK-CONFIG] Configurando webhook para instância: ${instanceId}`);
      
      const webhookUrl = 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/codechat-webhook';
      
      const webhookConfig: WebhookConfig = {
        enabled: true,
        url: webhookUrl,
        events: {
          messagesUpsert: true,
          messagesSet: false,
          messagesUpdated: true,
          connectionUpdated: true,
          qrcodeUpdated: true,
          statusInstance: true,
          sendMessage: true,
          chatsUpsert: true,
          chatsUpdated: true,
          chatsDeleted: true,
          contactsUpsert: true,
          contactsUpdated: true,
          groupsUpsert: true,
          groupsUpdated: true,
          presenceUpdated: false,
          refreshToken: true
        }
      };

      const response = await yumerWhatsappService.configureWebhook(instanceId, webhookConfig);
      
      if (response.success) {
        console.log(`✅ [WEBHOOK-CONFIG] Webhook configurado com sucesso para: ${instanceId}`);
        
        // Salvar configuração no banco
        await supabase
          .from('whatsapp_instances')
          .update({
            webhook_url: webhookUrl,
            webhook_enabled: true,
            updated_at: new Date().toISOString()
          })
          .eq('instance_id', instanceId);
        
        return { success: true };
      } else {
        console.error(`❌ [WEBHOOK-CONFIG] Erro ao configurar webhook:`, response.error);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error(`❌ [WEBHOOK-CONFIG] Erro crítico:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  },

  // Verificar status do webhook
  async verifyWebhook(instanceId: string): Promise<{ isConfigured: boolean; config?: WebhookConfig }> {
    try {
      console.log(`🔍 [WEBHOOK-VERIFY] Verificando webhook para: ${instanceId}`);
      
      const response = await yumerWhatsappService.getWebhookConfig(instanceId);
      
      if (response.success && response.data) {
        const isCorrectlyConfigured = 
          response.data.enabled === true &&
          response.data.url.includes('codechat-webhook') &&
          response.data.events?.messagesUpsert === true;
        
        console.log(`📊 [WEBHOOK-VERIFY] Status: ${isCorrectlyConfigured ? 'Configurado' : 'Incorreto'}`);
        
        return {
          isConfigured: isCorrectlyConfigured,
          config: response.data
        };
      }
      
      console.log(`⚠️ [WEBHOOK-VERIFY] Webhook não configurado para: ${instanceId}`);
      return { isConfigured: false };
    } catch (error) {
      console.error(`❌ [WEBHOOK-VERIFY] Erro ao verificar webhook:`, error);
      return { isConfigured: false };
    }
  },

  // Auto-configurar webhook se necessário
  async ensureWebhookConfigured(instanceId: string): Promise<boolean> {
    console.log(`🔄 [WEBHOOK-ENSURE] Garantindo webhook para: ${instanceId}`);
    
    const verification = await this.verifyWebhook(instanceId);
    
    if (!verification.isConfigured) {
      console.log(`🔧 [WEBHOOK-ENSURE] Webhook não configurado, configurando agora...`);
      const result = await this.configureWebhook(instanceId);
      return result.success;
    }
    
    console.log(`✅ [WEBHOOK-ENSURE] Webhook já configurado corretamente`);
    return true;
  },

  // Testar webhook com mensagem de teste
  async testWebhook(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🧪 [WEBHOOK-TEST] Testando webhook para: ${instanceId}`);
      
      // Enviar uma mensagem de teste para verificar se o webhook funciona
      const testMessage = `🧪 Teste de webhook - ${new Date().toISOString()}`;
      
      const response = await yumerWhatsappService.sendMessage(
        instanceId,
        instanceId, // Enviar para si mesmo
        testMessage
      );
      
      if (response.success) {
        console.log(`✅ [WEBHOOK-TEST] Mensagem de teste enviada`);
        return { success: true };
      } else {
        console.error(`❌ [WEBHOOK-TEST] Erro ao enviar mensagem de teste:`, response.error);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error(`❌ [WEBHOOK-TEST] Erro no teste:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }
};
