
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useEmotionDetection } from './useEmotionDetection';

export const useAutoReactions = (clientId: string) => {
  const [isReacting, setIsReacting] = useState(false);
  const { detectEmotion } = useEmotionDetection();

  const sendAutoReaction = useCallback(async (messageText: string, chatId: string, messageId: string) => {
    if (!clientId || isReacting) return;

    try {
      setIsReacting(true);
      
      // Detectar emoção na mensagem
      const emotion = detectEmotion(messageText);
      
      if (emotion && emotion.confidence > 0.3) {
        console.log(`🎭 Emoção detectada: ${emotion.emotion} (${emotion.confidence}) - ${emotion.emoji}`);
        
        // Delay natural entre 1-3 segundos
        const delay = Math.random() * 2000 + 1000;
        
        setTimeout(async () => {
          try {
            // Enviar reação via WhatsApp
            await whatsappService.sendReaction(clientId, chatId, messageId, emotion.emoji);
            console.log(`✅ Reação automática enviada: ${emotion.emoji}`);
          } catch (error) {
            console.error('❌ Erro ao enviar reação automática:', error);
          } finally {
            setIsReacting(false);
          }
        }, delay);
        
        return emotion;
      }
    } catch (error) {
      console.error('❌ Erro na detecção de emoção:', error);
      setIsReacting(false);
    }
    
    return null;
  }, [clientId, isReacting, detectEmotion]);

  return {
    sendAutoReaction,
    isReacting
  };
};
