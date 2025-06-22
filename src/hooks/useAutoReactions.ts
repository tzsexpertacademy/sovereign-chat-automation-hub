
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useToast } from './use-toast';

export const useAutoReactions = (clientId: string) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const { toast } = useToast();

  const sendReaction = useCallback(async (chatId: string, messageId: string, reaction: string) => {
    if (!isEnabled) return;

    try {
      await whatsappService.sendReaction(clientId, messageId, reaction);
      console.log(`✅ Reação ${reaction} enviada para mensagem ${messageId}`);
    } catch (error) {
      console.error('❌ Erro ao enviar reação:', error);
      toast({
        title: "Erro ao enviar reação",
        description: "Não foi possível enviar a reação",
        variant: "destructive"
      });
    }
  }, [clientId, isEnabled, toast]);

  const sendAutoReply = useCallback(async (chatId: string, message: string) => {
    if (!isEnabled) return;

    try {
      // Corrigido: removido o terceiro parâmetro hasFile
      await whatsappService.sendMessage(clientId, chatId, message);
      console.log(`✅ Resposta automática enviada para ${chatId}`);
    } catch (error) {
      console.error('❌ Erro ao enviar resposta automática:', error);
      toast({
        title: "Erro na resposta automática",
        description: "Não foi possível enviar resposta automática",
        variant: "destructive"
      });
    }
  }, [clientId, isEnabled, toast]);

  const processMessage = useCallback(async (messageData: any) => {
    if (!isEnabled || messageData.fromMe) return;

    const messageText = messageData.body?.toLowerCase() || '';
    
    // Reações automáticas baseadas no conteúdo
    if (messageText.includes('obrigad')) {
      await sendReaction(messageData.chatId, messageData.id, '👍');
    } else if (messageText.includes('oi') || messageText.includes('olá')) {
      await sendReaction(messageData.chatId, messageData.id, '👋');
    } else if (messageText.includes('❤') || messageText.includes('💖')) {
      await sendReaction(messageData.chatId, messageData.id, '❤️');
    }
    
    // Respostas automáticas
    if (messageText.includes('horário') || messageText.includes('horario')) {
      await sendAutoReply(messageData.chatId, 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.');
    }
  }, [isEnabled, sendReaction, sendAutoReply]);

  return {
    isEnabled,
    setIsEnabled,
    processMessage,
    sendReaction,
    sendAutoReply
  };
};
