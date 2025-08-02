/**
 * SERVIÇO DE DEBUG PARA SISTEMA DE ÁUDIO TTS
 * Comando especial: /debugaudio - para testar comandos de áudio isoladamente
 */

import { supabase } from "@/integrations/supabase/client";
import { smartLogs } from "./smartLogsService";
import { ticketsService } from "./ticketsService";

export const debugAudioService = {
  /**
   * COMANDO ESPECIAL: /debugaudio
   * Testa diferentes formatos de comando audio: sem afetar conversas reais
   */
  async handleDebugCommand(
    ticketId: string,
    clientId: string,
    instanceId: string,
    chatId: string
  ): Promise<void> {
    // LOGS ROBUSTOS - com fallback caso smartLogs falhe
    try {
      smartLogs.info('MESSAGE', '🎵 COMANDO /debugaudio EXECUTADO', {
        ticketId,
        clientId,
        instanceId,
        chatId
      });
    } catch (logError) {
      console.warn('⚠️ smartLogs indisponível, usando console direto:', logError);
    }

    console.log('🎵 [DEBUG-AUDIO] COMANDO EXECUTADO', {
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
      let assistantConfig = null;
      if (assistantId) {
        const { data: assistant, error } = await supabase
          .from('assistants')
          .select('name, advanced_settings')
          .eq('id', assistantId)
          .single();

        if (assistant) {
          assistantConfig = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;

          smartLogs.info('MESSAGE', '🤖 ASSISTENTE ENCONTRADO', {
            assistantId,
            name: assistant.name,
            hasElevenLabs: !!assistantConfig?.eleven_labs_api_key,
            hasFishAudio: !!assistantConfig?.fish_audio_api_key,
            audioProvider: assistantConfig?.audio_provider
          });
        }
      }

      // 3. TESTAR DIFERENTES FORMATOS DE COMANDO AUDIO
      const testFormats = [
        'audio: "Teste com aspas simples"',
        'audio:"Teste com aspas coladas"',
        'audio: teste sem aspas',
        'audio:teste sem aspas e sem espaço',
        'Por favor, me envie um audio: "Teste em contexto com aspas"',
        'Gere um audio: teste em contexto sem aspas',
        'audio: "Teste com emoji 😄 e caracteres especiais!"',
        'audio: Teste simples sem aspas mas com espaços'
      ];

      // 4. SIMULAR PROCESSAMENTO AI ASSISTANT
      for (let i = 0; i < testFormats.length; i++) {
        const testMessage = testFormats[i];
        
        console.log(`🎵 [DEBUG-AUDIO] Testando formato ${i + 1}/${testFormats.length}: ${testMessage}`);
        
        try {
          // Simular chamada da AI Assistant Process
          const response = await supabase.functions.invoke('ai-assistant-process', {
            body: {
              ticketId,
              messages: [{
                content: testMessage,
                messageId: `debug_audio_${Date.now()}_${i}`,
                timestamp: new Date().toISOString(),
                phoneNumber: '554796451886',
                customerName: 'Debug Audio Test'
              }],
              context: {
                chatId,
                customerName: 'Debug Audio Test',
                phoneNumber: '554796451886',
                batchInfo: `Teste de formato ${i + 1}`
              }
            }
          });

          if (response.error) {
            console.error(`❌ [DEBUG-AUDIO] Erro no teste ${i + 1}:`, response.error);
          } else {
            console.log(`✅ [DEBUG-AUDIO] Teste ${i + 1} executado com sucesso`);
          }

          // Delay entre testes
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error: any) {
          console.error(`❌ [DEBUG-AUDIO] Erro no teste ${i + 1}:`, error);
        }
      }

      // 5. RESULTADO DO TESTE
      smartLogs.info('MESSAGE', '✅ TESTE DE ÁUDIO CONCLUÍDO', {
        totalTests: testFormats.length,
        assistantConfig: {
          hasElevenLabs: !!assistantConfig?.eleven_labs_api_key,
          hasFishAudio: !!assistantConfig?.fish_audio_api_key,
          audioProvider: assistantConfig?.audio_provider
        }
      });

      // 6. SALVAR RESULTADO NO BANCO PARA ANÁLISE
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: `debug_audio_${Date.now()}`,
        from_me: true,
        sender_name: '🎵 DEBUG ÁUDIO',
        content: `✅ TESTE DE ÁUDIO CONCLUÍDO: ${testFormats.length} formatos testados!
        
📋 FORMATOS TESTADOS:
${testFormats.map((format, index) => `${index + 1}. ${format}`).join('\n')}

🤖 CONFIGURAÇÃO DO ASSISTENTE:
- ElevenLabs: ${assistantConfig?.eleven_labs_api_key ? '✅ Configurado' : '❌ Não configurado'}
- Fish Audio: ${assistantConfig?.fish_audio_api_key ? '✅ Configurado' : '❌ Não configurado'}
- Provider: ${assistantConfig?.audio_provider || 'Não definido'}`,
        message_type: 'text',
        is_internal_note: true,
        is_ai_response: false,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ [DEBUG-AUDIO] ERRO NO TESTE DE ÁUDIO:', error);
      
      try {
        smartLogs.error('MESSAGE', '❌ ERRO NO TESTE DE ÁUDIO', { error: error.message });
      } catch (logError) {
        console.warn('⚠️ smartLogs erro:', logError);
      }
      
      // Salvar erro também
      try {
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `debug_audio_error_${Date.now()}`,
          from_me: true,
          sender_name: '🎵 DEBUG ÁUDIO ERRO',
          content: `❌ ERRO NO TESTE DE ÁUDIO: ${error.message}`,
          message_type: 'text',
          is_internal_note: true,
          is_ai_response: false,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.error('❌ [DEBUG-AUDIO] Erro ao salvar mensagem de erro:', saveError);
      }
    }
  },

  /**
   * TESTE SIMPLES - Enviar um comando direto
   */
  async testSingleAudioCommand(
    ticketId: string,
    audioCommand: string
  ): Promise<void> {
    try {
      console.log('🎵 [DEBUG-AUDIO] Testando comando simples:', audioCommand);

      const response = await supabase.functions.invoke('ai-assistant-process', {
        body: {
          ticketId,
          messages: [{
            content: audioCommand,
            messageId: `debug_simple_${Date.now()}`,
            timestamp: new Date().toISOString(),
            phoneNumber: '554796451886',
            customerName: 'Teste Simples'
          }],
          context: {
            chatId: '554796451886@s.whatsapp.net',
            customerName: 'Teste Simples',
            phoneNumber: '554796451886',
            batchInfo: 'Teste simples de comando'
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log('✅ [DEBUG-AUDIO] Comando simples executado com sucesso');

    } catch (error: any) {
      console.error('❌ [DEBUG-AUDIO] Erro no comando simples:', error);
      throw error;
    }
  }
};