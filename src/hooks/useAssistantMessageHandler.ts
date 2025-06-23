
import { useCallback } from 'react';
import { useMessageProcessor } from './useMessageProcessor';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';

interface MessageData {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  type: string;
  fromMe: boolean;
}

export const useAssistantMessageHandler = (clientId: string) => {
  const { processMessage, isProcessing } = useMessageProcessor();

  const handleIncomingMessage = useCallback(async (
    message: MessageData,
    ticketId: string,
    assistantId?: string
  ) => {
    // Não processar mensagens próprias
    if (message.fromMe) {
      console.log('⏭️ Ignorando mensagem própria');
      return;
    }

    // Verificar se tem assistente configurado
    if (!assistantId) {
      console.log('⚠️ Nenhum assistente configurado para esta conversa');
      return;
    }

    try {
      console.log('📨 Processando mensagem recebida:', {
        messageId: message.id,
        from: message.from,
        content: message.body?.substring(0, 50)
      });

      // Processar com assistente
      const result = await processMessage({
        messageText: message.body,
        assistantId,
        chatId: message.from,
        instanceId: clientId, // Usando clientId como instanceId
        messageId: message.id,
        isAudioMessage: message.type === 'audio'
      });

      if (result?.response && result.success) {
        console.log('🤖 Enviando resposta do assistente...');

        // Enviar resposta via WhatsApp
        const success = await whatsappService.sendMessage(
          clientId,
          message.from,
          result.response,
          result.isAudio ? 'audio' : 'text'
        );

        if (success) {
          console.log('✅ Resposta enviada com sucesso');
          
          // Adicionar resposta ao ticket
          await ticketsService.addMessageToTicket(ticketId, {
            message_id: `ai_${Date.now()}`,
            content: result.response,
            message_type: result.isAudio ? 'audio' : 'text',
            from_me: true,
            is_ai_response: true,
            timestamp: new Date().toISOString(),
            sender_name: 'Assistente IA'
          });
        } else {
          console.error('❌ Falha ao enviar resposta');
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [processMessage, clientId]);

  return {
    handleIncomingMessage,
    isProcessing
  };
};
