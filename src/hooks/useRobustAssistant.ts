
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';
import { assistantMonitoringService } from '@/services/assistantMonitoringService';

interface AssistantConfig {
  clientId: string;
  maxRetries: number;
  timeoutMs: number;
  fallbackResponse: string;
}

export const useRobustAssistant = (config: AssistantConfig) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef<Map<string, number>>(new Map());

  const processWithAssistant = useCallback(async (
    messageData: any,
    ticketId: string,
    allMessages: any[] = []
  ) => {
    const messageKey = `${ticketId}_${Date.now()}`;
    const startTime = Date.now();
    
    // PROTEÇÃO: Evitar processamento duplicado
    if (processingRef.current.has(ticketId)) {
      console.log('🛡️ PROTEÇÃO: Ticket já sendo processado:', ticketId);
      return;
    }

    processingRef.current.add(ticketId);
    setIsProcessing(true);

    // REGISTRAR INÍCIO DO PROCESSAMENTO
    assistantMonitoringService.recordMessageReceived();

    try {
      console.log('🤖 ===== INICIANDO PROCESSAMENTO BLINDADO =====');
      console.log('📋 Ticket:', ticketId);
      console.log('📨 Mensagens:', allMessages.length);

      // VALIDAÇÃO CRÍTICA: Verificar se os dados essenciais existem
      if (!messageData?.from || !ticketId || !config.clientId) {
        throw new Error('Dados essenciais faltando para processamento');
      }

      const result = await processWithTimeout(
        () => executeAssistantLogic(messageData, ticketId, allMessages),
        config.timeoutMs
      );

      if (!result.success) {
        throw new Error(result.error || 'Falha no processamento do assistente');
      }

      console.log('✅ PROCESSAMENTO BLINDADO CONCLUÍDO COM SUCESSO');
      
      // REGISTRAR SUCESSO
      const processingTime = Date.now() - startTime;
      assistantMonitoringService.recordMessageProcessed(processingTime);
      assistantMonitoringService.recordMessageSent();
      
      retryCountRef.current.delete(messageKey);

    } catch (error) {
      console.error('❌ ERRO NO PROCESSAMENTO BLINDADO:', error);
      
      // REGISTRAR ERRO
      assistantMonitoringService.recordError(error as Error);
      
      // SISTEMA DE RETRY
      const retryCount = retryCountRef.current.get(messageKey) || 0;
      if (retryCount < config.maxRetries) {
        console.log(`🔄 TENTATIVA ${retryCount + 1}/${config.maxRetries} para ${messageKey}`);
        retryCountRef.current.set(messageKey, retryCount + 1);
        
        // Retry com delay exponencial
        setTimeout(() => {
          processWithAssistant(messageData, ticketId, allMessages);
        }, Math.pow(2, retryCount) * 1000);
        
        return;
      }

      // FALLBACK FINAL: Enviar resposta padrão
      console.log('🛡️ ATIVANDO FALLBACK: Enviando resposta padrão');
      await sendFallbackResponse(messageData, ticketId);
      
    } finally {
      processingRef.current.delete(ticketId);
      setIsProcessing(false);
    }
  }, [config]);

  const processWithTimeout = async (
    operation: () => Promise<any>,
    timeoutMs: number
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, error: 'Timeout no processamento' });
      }, timeoutMs);

      operation()
        .then((data) => {
          clearTimeout(timer);
          resolve({ success: true, data });
        })
        .catch((error) => {
          clearTimeout(timer);
          resolve({ success: false, error: error.message });
        });
    });
  };

  const executeAssistantLogic = async (
    messageData: any,
    ticketId: string,
    allMessages: any[]
  ) => {
    // BUSCAR CONFIGURAÇÕES COM FALLBACK E VALIDAÇÃO ROBUSTA
    const [queuesResult, aiConfigResult, instancesResult] = await Promise.allSettled([
      supabase.from('queues').select('*, assistants(*)').eq('client_id', config.clientId).eq('is_active', true),
      supabase.from('client_ai_configs').select('*').eq('client_id', config.clientId).single(),
      supabase.from('whatsapp_instances').select('instance_id').eq('client_id', config.clientId).eq('status', 'connected').limit(1)
    ]);

    // VALIDAR RESULTADOS COM PROTEÇÕES APRIMORADAS
    const queuesData = queuesResult.status === 'fulfilled' && queuesResult.value.data ? queuesResult.value.data : [];
    const aiConfigData = aiConfigResult.status === 'fulfilled' && aiConfigResult.value.data ? aiConfigResult.value.data : null;
    const instancesData = instancesResult.status === 'fulfilled' && instancesResult.value.data ? instancesResult.value.data : [];

    // VALIDAÇÕES CRÍTICAS COM MENSAGENS DETALHADAS
    if (!aiConfigData?.openai_api_key) {
      throw new Error('CRÍTICO: Configuração de IA não encontrada ou chave API faltando');
    }

    const activeQueue = queuesData.find(q => q.assistants?.is_active);
    if (!activeQueue?.assistants) {
      throw new Error('CRÍTICO: Nenhuma fila ativa com assistente encontrada');
    }

    if (instancesData.length === 0) {
      throw new Error('CRÍTICO: Nenhuma instância WhatsApp conectada');
    }

    const assistant = activeQueue.assistants;
    const instanceId = instancesData[0].instance_id;

    console.log('🤖 CONFIGURAÇÃO VALIDADA:', {
      assistant: assistant.name,
      queue: activeQueue.name,
      instance: instanceId,
      hasApiKey: !!aiConfigData.openai_api_key
    });

    // BUSCAR CONTEXTO COM PROTEÇÃO APRIMORADA
    let ticketMessages = [];
    try {
      ticketMessages = await ticketsService.getTicketMessages(ticketId, 20);
      console.log('📚 CONTEXTO carregado:', ticketMessages.length, 'mensagens');
    } catch (error) {
      console.warn('⚠️ Erro ao buscar contexto, continuando sem:', error);
    }

    // PREPARAR MENSAGEM PARA IA COM VALIDAÇÃO
    const currentContent = allMessages
      .filter(msg => !msg.fromMe)
      .map(msg => {
        const content = msg.body || msg.caption || '[Mídia]';
        return content.trim();
      })
      .filter(content => content.length > 0)
      .join('\n');

    if (!currentContent.trim()) {
      throw new Error('CRÍTICO: Nenhum conteúdo válido para processar');
    }

    console.log('📝 CONTEÚDO preparado:', currentContent.substring(0, 100) + '...');

    // CONFIGURAÇÕES DO ASSISTENTE COM VALIDAÇÃO ROBUSTA
    let settings = { temperature: 0.7, max_tokens: 1000 };
    try {
      if (assistant.advanced_settings) {
        const parsed = typeof assistant.advanced_settings === 'string' 
          ? JSON.parse(assistant.advanced_settings)
          : assistant.advanced_settings;
        
        settings = {
          temperature: Math.max(0, Math.min(2, parsed.temperature || 0.7)),
          max_tokens: Math.max(100, Math.min(4000, parsed.max_tokens || 1000))
        };
      }
    } catch (error) {
      console.warn('⚠️ Erro no parse das configurações, usando padrão:', error);
    }

    // CONSTRUIR CONTEXTO PARA IA COM LIMITE ROBUSTO
    const contextMessages = ticketMessages
      .slice(-8) // Últimas 8 mensagens
      .map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: (msg.content || '').substring(0, 1000) // Limitar tamanho
      }))
      .filter(msg => msg.content.trim().length > 0);

    const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nVocê está respondendo mensagens do WhatsApp. Seja direto, útil e mantenha o contexto da conversa.`;

    const messages = [
      { role: 'system', content: systemPrompt.substring(0, 2000) },
      ...contextMessages,
      { role: 'user', content: currentContent.substring(0, 2000) }
    ];

    console.log('🚀 ENVIANDO para OpenAI:', {
      model: assistant.model || 'gpt-4o-mini',
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      messagesCount: messages.length
    });

    // CHAMAR OPENAI COM PROTEÇÃO APRIMORADA
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfigData.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: messages,
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API Error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida da OpenAI API');
      }

      const assistantResponse = data.choices[0].message.content;

      if (!assistantResponse?.trim()) {
        throw new Error('Resposta vazia da OpenAI API');
      }

      console.log('✅ RESPOSTA da OpenAI recebida:', assistantResponse.length, 'caracteres');

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout na chamada da OpenAI API');
      }
      throw error;
    }

    // VALIDAR RESPOSTA ANTES DE ENVIAR
    const finalResponse = data.choices[0].message.content.trim();
    if (finalResponse.length === 0) {
      throw new Error('Resposta final vazia após processamento');
    }

    // ENVIAR RESPOSTA COM PROTEÇÃO APRIMORADA
    console.log('📤 ENVIANDO resposta para WhatsApp...');
    const sendResult = await whatsappService.sendMessage(instanceId, messageData.from, finalResponse);
    
    if (!sendResult.success) {
      throw new Error(`Falha ao enviar mensagem WhatsApp: ${sendResult.error}`);
    }

    console.log('✅ MENSAGEM enviada com sucesso para WhatsApp');

    // SALVAR NO TICKET COM PROTEÇÃO APRIMORADA
    try {
      const aiMessageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: aiMessageId,
        from_me: true,
        sender_name: `🤖 ${assistant.name}`,
        content: finalResponse,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: true,
        ai_confidence_score: 0.9,
        processing_status: 'completed',
        timestamp: new Date().toISOString()
      });

      console.log('✅ MENSAGEM IA salva no ticket com sucesso');
    } catch (error) {
      console.error('⚠️ Erro ao salvar no ticket (não crítico):', error);
      // Não interromper o fluxo, mensagem já foi enviada
    }

    return finalResponse;
  };

  const sendFallbackResponse = async (messageData: any, ticketId: string) => {
    try {
      console.log('🛡️ EXECUTANDO FALLBACK ROBUSTO...');
      
      // Buscar instância disponível com retry
      let instances = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data } = await supabase
            .from('whatsapp_instances')
            .select('instance_id')
            .eq('client_id', config.clientId)
            .eq('status', 'connected')
            .limit(1);
          
          instances = data;
          break;
        } catch (error) {
          console.warn(`⚠️ Tentativa ${attempt + 1} falhou ao buscar instâncias:`, error);
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!instances || instances.length === 0) {
        console.error('❌ FALLBACK CRÍTICO: Nenhuma instância disponível');
        return;
      }

      const instanceId = instances[0].instance_id;
      
      console.log('🛡️ ENVIANDO RESPOSTA FALLBACK via instância:', instanceId);
      const result = await whatsappService.sendMessage(
        instanceId, 
        messageData.from, 
        config.fallbackResponse
      );

      if (result.success) {
        console.log('✅ FALLBACK enviado com sucesso');
        
        // Registrar envio de fallback
        assistantMonitoringService.recordMessageSent();
        
        // Salvar resposta fallback no ticket
        try {
          const fallbackMessageId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await ticketsService.addTicketMessage({
            ticket_id: ticketId,
            message_id: fallbackMessageId,
            from_me: true,
            sender_name: '🤖 Assistente (Fallback)',
            content: config.fallbackResponse,
            message_type: 'text',
            is_internal_note: false,
            is_ai_response: true,
            processing_status: 'completed',
            timestamp: new Date().toISOString()
          });

          console.log('✅ FALLBACK salvo no ticket');
        } catch (error) {
          console.error('⚠️ Erro ao salvar fallback no ticket:', error);
        }
      } else {
        console.error('❌ FALLBACK CRÍTICO: Falha ao enviar resposta padrão:', result.error);
      }
    } catch (error) {
      console.error('❌ ERRO CRÍTICO NO FALLBACK:', error);
      assistantMonitoringService.recordError(error as Error);
    }
  };

  return {
    processWithAssistant,
    isProcessing,
    getHealthStatus: () => assistantMonitoringService.getHealthStatus(),
    getDetailedReport: () => assistantMonitoringService.getDetailedReport()
  };
};
