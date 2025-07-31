/**
 * SERVIÇO UNIFICADO DE MENSAGENS - VERSÃO SIMPLIFICADA
 * 
 * Este é o ÚNICO serviço que deve ser usado para TODOS os envios de mensagem,
 * tanto manual quanto da IA. Elimina duplicações e conflitos.
 */

import { supabase } from "@/integrations/supabase/client";
import yumerApiV2Service from "./yumerApiV2Service";
import { businessTokenService } from "./businessTokenService";

export interface UnifiedMessageOptions {
  instanceId: string;
  chatId: string;
  message: string;
  clientId?: string;
  source?: 'manual' | 'ai' | 'automation';
  delay?: number;
  presence?: 'composing' | 'recording' | 'available';
  humanized?: boolean;
}

export interface UnifiedMessageResult {
  success: boolean;
  messageId?: string;
  timestamp: number;
  error?: string;
  details?: any;
}

class UnifiedMessageService {
  
  /**
   * MÉTODO PRINCIPAL - ÚNICO PONTO DE ENVIO PARA TUDO
   * ESTRATÉGIA HÍBRIDA: SEMPRE REST para envio (nunca WebSocket)
   */
  async sendMessage(options: UnifiedMessageOptions): Promise<UnifiedMessageResult> {
    try {
      console.log('📤 [UNIFIED-MSG] Enviando mensagem:', {
        instanceId: options.instanceId,
        chatId: options.chatId,
        messageLength: options.message.length,
        source: options.source || 'manual',
        humanized: options.humanized
      });

      // 1. RESOLVER INSTANCE ID REAL
      const realInstanceId = await this.resolveRealInstanceId(options.instanceId);
      if (!realInstanceId) {
        throw new Error(`Instance ID inválido ou não encontrado: ${options.instanceId}`);
      }

      // 2. GARANTIR BUSINESS TOKEN VÁLIDO
      if (options.clientId) {
        await this.ensureValidBusinessToken(options.clientId);
      }

      // 3. CONFIGURAR OPÇÕES DE ENVIO
      const sendOptions = {
        delay: options.delay || 1200,
        presence: options.presence || 'composing',
        externalAttributes: `source=${options.source || 'manual'};humanized=${options.humanized || false};timestamp=${Date.now()}`
      };

      // 4. ENVIAR VIA YUMER API V2 - SEMPRE REST (ESTRATÉGIA HÍBRIDA)
      console.log('📤 [UNIFIED-MSG] *** ENVIANDO VIA REST API (ESTRATÉGIA HÍBRIDA) ***:', {
        originalId: options.instanceId,
        realInstanceId,
        chatId: options.chatId,
        strategy: 'HYBRID: REST for sending'
      });

      const result = await yumerApiV2Service.sendText(
        realInstanceId,
        options.chatId,
        options.message,
        sendOptions
      );

      console.log('✅ [UNIFIED-MSG] Mensagem enviada com sucesso:', result);

      return {
        success: true,
        messageId: result.key?.id || `unified_msg_${Date.now()}`,
        timestamp: Date.now(),
        details: result
      };

    } catch (error: any) {
      console.error('❌ [UNIFIED-MSG] Erro ao enviar mensagem:', error);
      
      return {
        success: false,
        timestamp: Date.now(),
        error: error.message || 'Erro desconhecido no envio',
        details: error
      };
    }
  }

  /**
   * RESOLVER ID REAL DA INSTÂNCIA (UUID -> instance_id real)
   */
  private async resolveRealInstanceId(instanceId: string): Promise<string | null> {
    try {
      // Se é UUID (interno do Supabase), buscar o instance_id real
      if (instanceId.includes('-')) {
        console.log('🔍 [UNIFIED-MSG] Resolvendo ID interno para real:', instanceId);
        
        const { data, error } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('id', instanceId)
          .single();
        
        if (error || !data) {
          console.error('❌ [UNIFIED-MSG] Erro ao resolver instance_id:', error);
          return null;
        }
        
        console.log('✅ [UNIFIED-MSG] ID resolvido:', {
          internal: instanceId,
          real: data.instance_id
        });
        
        return data.instance_id;
      }
      
      // Se já é um instance_id real, retornar diretamente
      return instanceId;
      
    } catch (error) {
      console.error('❌ [UNIFIED-MSG] Erro ao resolver instance_id:', error);
      return null;
    }
  }

  /**
   * GARANTIR BUSINESS TOKEN VÁLIDO
   */
  private async ensureValidBusinessToken(clientId: string): Promise<void> {
    try {
      console.log('🔐 [UNIFIED-MSG] Verificando business token para cliente:', clientId);
      
      const result = await businessTokenService.ensureValidToken(clientId);
      
      if (!result.success) {
        console.error('❌ [UNIFIED-MSG] Falha ao garantir token válido:', result.error);
        throw new Error(`Business token inválido: ${result.error}`);
      }
      
      console.log('✅ [UNIFIED-MSG] Business token válido confirmado');
      
    } catch (error) {
      console.error('❌ [UNIFIED-MSG] Erro ao verificar business token:', error);
      throw error;
    }
  }

  /**
   * MÉTODO DE CONVENIÊNCIA PARA IA
   */
  async sendAIMessage(instanceId: string, chatId: string, message: string, clientId?: string): Promise<UnifiedMessageResult> {
    return this.sendMessage({
      instanceId,
      chatId,
      message,
      clientId,
      source: 'ai',
      humanized: true,
      delay: Math.floor(Math.random() * 1000 + 800),
      presence: 'composing'
    });
  }

  /**
   * MÉTODO DE CONVENIÊNCIA PARA ENVIO MANUAL
   */
  async sendManualMessage(instanceId: string, chatId: string, message: string, clientId?: string): Promise<UnifiedMessageResult> {
    return this.sendMessage({
      instanceId,
      chatId,
      message,
      clientId,
      source: 'manual',
      humanized: false,
      delay: 0
    });
  }
}

export const unifiedMessageService = new UnifiedMessageService();