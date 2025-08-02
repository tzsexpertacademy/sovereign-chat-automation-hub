/**
 * SERVIÇO DE DEBUG PARA SISTEMA DE BLOCOS
 * Comando especial: /debugbloco - para testar isoladamente
 */

import { supabase } from "@/integrations/supabase/client";
import { messageChunksService } from "./messageChunksService";
import { smartLogs } from "./smartLogsService";
import { ticketsService } from "./ticketsService";

export const debugBlocoService = {
  /**
   * COMANDO ESPECIAL: /debugbloco
   * Testa o sistema de blocos sem afetar conversas reais
   */
  async handleDebugCommand(
    ticketId: string,
    clientId: string,
    instanceId: string,
    chatId: string
  ): Promise<void> {
    // LOGS ROBUSTOS - com fallback caso smartLogs falhe
    try {
      smartLogs.info('MESSAGE', '🚨 COMANDO /debugbloco EXECUTADO', {
        ticketId,
        clientId,
        instanceId,
        chatId
      });
    } catch (logError) {
      console.warn('⚠️ smartLogs indisponível, usando console direto:', logError);
    }

    console.log('🚨 [DEBUG-BLOCO] COMANDO EXECUTADO', {
      ticketId,
      clientId,
      instanceId,
      chatId,
      timestamp: new Date().toISOString()
    });

    try {
      // 1. BUSCAR ASSISTENTE DO TICKET
      const ticket = await ticketsService.getTicketById(ticketId);
      
      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      const assistantId = ticket.assigned_assistant_id;
      
      smartLogs.info('MESSAGE', '🎯 DADOS DO TICKET', {
        ticketId,
        assistantId,
        hasAssistant: !!assistantId,
        assignedQueueId: ticket.assigned_queue_id
      });

      // 2. CARREGAR CONFIGURAÇÕES DO ASSISTENTE
      if (assistantId) {
        const { data: assistant, error } = await supabase
          .from('assistants')
          .select('name, advanced_settings')
          .eq('id', assistantId)
          .single();

        if (assistant) {
          smartLogs.info('MESSAGE', '🤖 ASSISTENTE ENCONTRADO', {
            assistantId,
            name: assistant.name,
            advanced_settings: assistant.advanced_settings
          });
        }
      }

      // 3. TESTAR SISTEMA DE BLOCOS COM MENSAGEM LONGA
      const testMessage = `
Esta é uma mensagem de teste para verificar se o sistema de blocos está funcionando corretamente. 
A mensagem precisa ter mais de 350 caracteres para ser dividida automaticamente em blocos menores. 
Cada bloco deve ser enviado com um delay de 3 segundos entre eles, simulando uma digitação humana realista. 
O sistema deve exibir indicadores de digitação (typing indicators) durante o processo.
Esta é uma funcionalidade crítica para o CRM Yumer e deve funcionar perfeitamente!
      `.trim();

      smartLogs.info('MESSAGE', '📝 TESTANDO MENSAGEM LONGA', {
        messageLength: testMessage.length,
        shouldSplit: testMessage.length > 350,
        assistantId
      });

      // 4. EXECUTAR TESTE DO SISTEMA DE BLOCOS COM CALLBACKS ROBUSTOS
      console.log('🔥 [DEBUG-BLOCO] Iniciando teste com messageChunksService', {
        messageLength: testMessage.length,
        assistantId,
        instanceId,
        chatId
      });

      const result = await messageChunksService.sendMessageInChunks({
        instanceId,
        chatId,
        message: testMessage,
        clientId,
        assistantId,
        source: 'ai',
        onProgress: (sent, total) => {
          console.log(`📊 [DEBUG-BLOCO] PROGRESSO: ${sent}/${total} blocos enviados`);
          try {
            smartLogs.info('MESSAGE', `📊 PROGRESSO: ${sent}/${total} blocos enviados`);
          } catch (e) {
            // Ignorar erro de log
          }
        },
        onTypingStart: () => {
          console.log('⌨️ [DEBUG-BLOCO] TYPING START DETECTADO');
          try {
            smartLogs.info('MESSAGE', '⌨️ TYPING START DETECTADO');
          } catch (e) {
            // Ignorar erro de log
          }
        },
        onTypingStop: () => {
          console.log('✋ [DEBUG-BLOCO] TYPING STOP DETECTADO');
          try {
            smartLogs.info('MESSAGE', '✋ TYPING STOP DETECTADO');
          } catch (e) {
            // Ignorar erro de log
          }
        }
      });

      // 5. RESULTADO DO TESTE
      smartLogs.info('MESSAGE', '✅ TESTE DE BLOCOS CONCLUÍDO', {
        success: result.success,
        totalChunks: result.totalChunks,
        sentChunks: result.sentChunks,
        messageIds: result.messageIds,
        errors: result.errors
      });

      // 6. SALVAR RESULTADO NO BANCO PARA ANÁLISE
      if (result.success) {
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `debug_${Date.now()}`,
          from_me: true,
          sender_name: '🚨 DEBUG BLOCOS',
          content: `✅ TESTE CONCLUÍDO: ${result.sentChunks}/${result.totalChunks} blocos enviados com sucesso!`,
          message_type: 'text',
          is_internal_note: true,
          is_ai_response: false,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error: any) {
      console.error('❌ [DEBUG-BLOCO] ERRO NO TESTE DE BLOCOS:', error);
      
      try {
        smartLogs.error('MESSAGE', '❌ ERRO NO TESTE DE BLOCOS', { error: error.message });
      } catch (logError) {
        console.warn('⚠️ smartLogs erro:', logError);
      }
      
      // Salvar erro também - com try/catch
      try {
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `debug_error_${Date.now()}`,
          from_me: true,
          sender_name: '🚨 DEBUG ERRO',
          content: `❌ ERRO NO TESTE: ${error.message}`,
          message_type: 'text',
          is_internal_note: true,
          is_ai_response: false,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.error('❌ [DEBUG-BLOCO] Erro ao salvar mensagem de erro:', saveError);
      }
    }
  },

  /**
   * VERIFICAR CONFIGURAÇÕES DO ASSISTENTE
   */
  async checkAssistantConfig(assistantId: string): Promise<any> {
    try {
      const { data: assistant, error } = await supabase
        .from('assistants')
        .select('*')
        .eq('id', assistantId)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar assistente: ${error.message}`);
      }

      const settings = typeof assistant.advanced_settings === 'string' 
        ? JSON.parse(assistant.advanced_settings)
        : assistant.advanced_settings;

      return {
        assistant: {
          id: assistant.id,
          name: assistant.name,
          advanced_settings: settings
        },
        messageHandling: settings?.messageHandling || null,
        typing: settings?.typing || null,
        analysis: {
          hasMessageHandling: !!settings?.messageHandling,
          splitEnabled: !!settings?.messageHandling?.splitLongMessages,
          maxChars: settings?.messageHandling?.maxCharsPerChunk || 'default',
          delay: settings?.messageHandling?.delayBetweenChunks || 'default'
        }
      };

    } catch (error: any) {
      smartLogs.error('MESSAGE', 'Erro ao verificar configurações', { assistantId, error });
      throw error;
    }
  }
};