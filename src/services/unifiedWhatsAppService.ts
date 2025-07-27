/**
 * SERVIÇO UNIFICADO WHATSAPP v2.2.1
 * Conecta todas as camadas - SEM FALLBACKS OU MOCKS
 * Usa diretamente yumerApiV2Service para todas as operações
 */

import yumerApiV2 from './yumerApiV2Service';
import { supabase } from '@/integrations/supabase/client';
import instanceStatusSyncService from './instanceStatusSyncService';

export interface UnifiedWhatsAppMessage {
  instanceId: string;
  chatId: string;
  text: string;
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording' | 'available' | 'unavailable';
    humanized?: boolean;
    personality?: string;
    externalAttributes?: Record<string, any>;
  };
}

export interface UnifiedWhatsAppResult {
  success: boolean;
  messageId?: string;
  timestamp: number;
  error?: string;
  details?: any;
}

class UnifiedWhatsAppService {
  
  /**
   * Envia mensagem de texto usando API real v2.2.1
   */
  async sendTextMessage(message: UnifiedWhatsAppMessage): Promise<UnifiedWhatsAppResult> {
    try {
      console.log('📤 [UNIFIED] Enviando mensagem real:', {
        instanceId: message.instanceId,
        chatId: message.chatId,
        textLength: message.text.length,
        humanized: message.options?.humanized
      });

      // Configurar opções humanizadas
      const sendOptions = {
        delay: message.options?.delay || 1200,
        presence: message.options?.presence || 'composing',
        externalAttributes: {
          source: 'unified-whatsapp-service',
          humanized: message.options?.humanized || false,
          personality: message.options?.personality || 'default',
          timestamp: Date.now(),
          ...message.options?.externalAttributes
        }
      };

      // Enviar via API real CodeChat v2.2.1
      const result = await yumerApiV2.sendText(
        message.instanceId,
        message.chatId,
        message.text,
        sendOptions
      );

      console.log('✅ [UNIFIED] Mensagem enviada com sucesso:', result);

      return {
        success: true,
        messageId: result.key?.id || `msg_${Date.now()}`,
        timestamp: Date.now(),
        details: result
      };

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao enviar mensagem:', error);
      
      return {
        success: false,
        timestamp: Date.now(),
        error: error.message || 'Erro desconhecido',
        details: error
      };
    }
  }

  /**
   * Envia mídia usando API real v2.2.1
   */
  async sendMediaMessage(
    instanceId: string, 
    chatId: string, 
    mediaUrl: string, 
    caption?: string,
    options?: Record<string, any>
  ): Promise<UnifiedWhatsAppResult> {
    try {
      console.log('📷 [UNIFIED] Enviando mídia real:', {
        instanceId,
        chatId,
        mediaUrl,
        caption
      });

      const result = await yumerApiV2.sendMedia(instanceId, {
        number: chatId,
        media: {
          media: mediaUrl,
          mediatype: 'image', // Determinar tipo baseado na URL/arquivo
          caption
        },
        options: {
          delay: options?.delay || 1500,
          presence: 'composing',
          externalAttributes: {
            source: 'unified-whatsapp-service',
            mediaType: 'media',
            timestamp: Date.now(),
            ...options?.externalAttributes
          }
        }
      });

      return {
        success: true,
        messageId: result.key?.id || `media_${Date.now()}`,
        timestamp: Date.now(),
        details: result
      };

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao enviar mídia:', error);
      
      return {
        success: false,
        timestamp: Date.now(),
        error: error.message || 'Erro ao enviar mídia',
        details: error
      };
    }
  }

  /**
   * Envia botões interativos usando API real v2.2.1
   */
  async sendButtons(
    instanceId: string,
    chatId: string,
    title: string,
    text: string,
    buttons: Array<{ type: string; displayText: string; id: string }>
  ): Promise<UnifiedWhatsAppResult> {
    try {
      console.log('🔘 [UNIFIED] Enviando botões interativos:', {
        instanceId,
        chatId,
        title,
        buttonsCount: buttons.length
      });

      const result = await yumerApiV2.sendButtons(
        instanceId,
        chatId,
        title,
        text,
        buttons
      );

      return {
        success: true,
        messageId: result.key?.id || `buttons_${Date.now()}`,
        timestamp: Date.now(),
        details: result
      };

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao enviar botões:', error);
      
      return {
        success: false,
        timestamp: Date.now(),
        error: error.message || 'Erro ao enviar botões',
        details: error
      };
    }
  }

  /**
   * Obtém status real da instância
   */
  async getInstanceStatus(instanceId: string): Promise<{
    status: string;
    connected: boolean;
    phone?: string;
    profileName?: string;
    error?: string;
  }> {
    try {
      console.log('📊 [UNIFIED] Verificando status real da instância:', instanceId);

      // Verificar no banco de dados primeiro
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select('status, phone_number')
        .eq('instance_id', instanceId)
        .single();

      // Verificar status real na API v2.2.1
      const connectionState = await yumerApiV2.getConnectionState(instanceId);
      const instanceInfo = await yumerApiV2.getInstance(instanceId);

      const realStatus = connectionState.state;
      const isConnected = realStatus === 'open';

      // Sincronizar se houver diferença
      if (instanceData && instanceData.status !== realStatus) {
        console.log(`🔄 [UNIFIED] Sincronizando status: ${instanceData.status} → ${realStatus}`);
        await instanceStatusSyncService.syncInstanceStatus(instanceId);
      }

      return {
        status: realStatus,
        connected: isConnected,
        phone: instanceInfo.owner || instanceData?.phone_number,
        profileName: instanceInfo.profileName
      };

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao verificar status:', error);
      
      return {
        status: 'unknown',
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Conecta instância gerando QR Code
   */
  async connectInstance(instanceId: string): Promise<{
    success: boolean;
    qrCode?: string;
    status?: string;
    error?: string;
  }> {
    try {
      console.log('🔌 [UNIFIED] Conectando instância real:', instanceId);

      // Obter QR Code real da API
      const qrResult = await yumerApiV2.getQRCode(instanceId);
      
      if (qrResult.base64) {
        console.log('📱 [UNIFIED] QR Code obtido com sucesso');
        
        // Atualizar no banco de dados
        await supabase
          .from('whatsapp_instances')
          .update({
            qr_code: qrResult.base64,
            has_qr_code: true,
            qr_expires_at: new Date(Date.now() + 45000).toISOString(), // 45s
            status: 'qr_ready',
            updated_at: new Date().toISOString()
          })
          .eq('instance_id', instanceId);

        // Iniciar monitoramento de status
        instanceStatusSyncService.startContinuousSync(instanceId);

        return {
          success: true,
          qrCode: qrResult.base64,
          status: 'qr_ready'
        };
      }

      throw new Error('QR Code não obtido da API');

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao conectar instância:', error);
      
      return {
        success: false,
        error: error.message || 'Erro ao conectar instância'
      };
    }
  }

  /**
   * Desconecta instância
   */
  async disconnectInstance(instanceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('🔌 [UNIFIED] Desconectando instância:', instanceId);

      await yumerApiV2.logoutInstance(instanceId);
      
      // Atualizar no banco de dados
      await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          has_qr_code: false,
          qr_expires_at: null,
          phone_number: null,
          updated_at: new Date().toISOString()
        })
        .eq('instance_id', instanceId);

      // Parar monitoramento
      instanceStatusSyncService.stopContinuousSync(instanceId);

      return { success: true };

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao desconectar instância:', error);
      
      return {
        success: false,
        error: error.message || 'Erro ao desconectar instância'
      };
    }
  }

  /**
   * Lista todas as instâncias do cliente
   */
  async getClientInstances(clientId: string): Promise<Array<{
    instanceId: string;
    status: string;
    connected: boolean;
    phone?: string;
    qrCode?: string;
    hasQrCode: boolean;
  }>> {
    try {
      console.log('📋 [UNIFIED] Buscando instâncias do cliente:', clientId);

      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!instances) return [];

      // Verificar status real de cada instância
      const enrichedInstances = await Promise.all(
        instances.map(async (instance) => {
          const status = await this.getInstanceStatus(instance.instance_id);
          
          return {
            instanceId: instance.instance_id,
            status: status.status,
            connected: status.connected,
            phone: status.phone || instance.phone_number,
            qrCode: instance.qr_code,
            hasQrCode: instance.has_qr_code && !!instance.qr_code
          };
        })
      );

      console.log(`✅ [UNIFIED] ${enrichedInstances.length} instâncias carregadas`);
      return enrichedInstances;

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao buscar instâncias:', error);
      return [];
    }
  }

  /**
   * Configurar webhook para instância
   */
  async configureWebhook(instanceId: string): Promise<boolean> {
    try {
      console.log('🔗 [UNIFIED] Configurando webhook real:', instanceId);
      
      const result = await yumerApiV2.configureInstanceWebhook(instanceId);
      
      if (result) {
        console.log('✅ [UNIFIED] Webhook configurado com sucesso');
      }
      
      return result;

    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao configurar webhook:', error);
      return false;
    }
  }
}

// Export singleton
export const unifiedWhatsAppService = new UnifiedWhatsAppService();
export default unifiedWhatsAppService;