
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';

interface QuotedMessage {
  id: string;
  body: string;
  author: string;
  timestamp: number;
}

export const useQuotedMessages = (clientId: string) => {
  const [processingQuoted, setProcessingQuoted] = useState(false);

  const handleQuotedMessage = useCallback(async (
    quotedMessage: QuotedMessage,
    newMessageText: string,
    chatId: string,
    ticketId: string
  ) => {
    if (!clientId || processingQuoted) return;

    try {
      setProcessingQuoted(true);
      console.log('📋 Processando mensagem marcada:', {
        quoted: quotedMessage.body,
        newMessage: newMessageText,
        chatId
      });

      // Buscar configurações de IA para processar a resposta
      const { aiConfigService } = await import('@/services/aiConfigService');
      const { assistantsService } = await import('@/services/assistantsService');
      const { queuesService } = await import('@/services/queuesService');

      const [aiConfig, queues] = await Promise.all([
        aiConfigService.getClientConfig(clientId),
        queuesService.getClientQueues(clientId)
      ]);

      if (!aiConfig) {
        console.log('⚠️ Nenhuma configuração de IA encontrada');
        return;
      }

      // Buscar fila ativa com assistente
      const activeQueue = queues.find((queue: any) => 
        queue.is_active && 
        queue.assistants && 
        queue.assistants.is_active
      );

      if (!activeQueue?.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        return;
      }

      const assistant = activeQueue.assistants;

      // Preparar prompt especial para mensagem marcada
      const contextPrompt = `
        O usuário marcou uma mensagem anterior e está se referindo a ela:
        
        Mensagem marcada: "${quotedMessage.body}"
        Nova mensagem: "${newMessageText}"
        
        Responda considerando o contexto da mensagem marcada e a nova mensagem do usuário.
      `;

      // Buscar histórico de mensagens
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      const recentMessages = ticketMessages
        .slice(-10)
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

      // Chamar IA com contexto da mensagem marcada
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: assistant.prompt + '\n\n' + contextPrompt
            },
            ...recentMessages,
            {
              role: 'user',
              content: newMessageText
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro da API OpenAI: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse && assistantResponse.trim()) {
        console.log('🤖 Resposta gerada para mensagem marcada:', assistantResponse.substring(0, 100) + '...');
        
        // Delay natural antes de responder
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Enviar resposta
        await whatsappService.sendMessage(clientId, chatId, assistantResponse);
        
        // Registrar no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `quoted_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: assistant.name,
          content: assistantResponse,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: true,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta à mensagem marcada enviada');
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem marcada:', error);
    } finally {
      setProcessingQuoted(false);
    }
  }, [clientId, processingQuoted]);

  return {
    handleQuotedMessage,
    processingQuoted
  };
};
