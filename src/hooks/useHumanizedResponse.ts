
import { useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface UseHumanizedResponseProps {
  clientId: string;
}

export const useHumanizedResponse = ({ clientId }: UseHumanizedResponseProps) => {
  
  // Calcula delay baseado no tamanho da mensagem (simula velocidade de digitação humana)
  const calculateTypingDelay = useCallback((text: string): number => {
    const wordsPerMinute = 40; // Velocidade média de digitação
    const charactersPerMinute = wordsPerMinute * 5; // ~5 caracteres por palavra
    const charactersPerSecond = charactersPerMinute / 60;
    
    const baseDelay = (text.length / charactersPerSecond) * 1000; // em ms
    
    // Adiciona variação aleatória para parecer mais humano (±20%)
    const variation = baseDelay * 0.2;
    const randomVariation = (Math.random() - 0.5) * 2 * variation;
    
    // Mínimo de 2 segundos, máximo de 30 segundos
    return Math.max(2000, Math.min(30000, baseDelay + randomVariation));
  }, []);

  // Determina se deve enviar como áudio baseado no conteúdo
  const shouldSendAsAudio = useCallback((text: string): boolean => {
    // Enviar como áudio se:
    // 1. Texto contém comando "audio:"
    // 2. Texto é muito longo (>200 caracteres)
    // 3. Contém emojis de áudio ou elementos expressivos
    
    if (text.toLowerCase().includes('audio:')) return true;
    if (text.length > 200) return true;
    
    const audioKeywords = ['haha', 'kkk', 'rsrs', '😂', '🤣', '😄', '😊'];
    const hasAudioKeywords = audioKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
    
    return hasAudioKeywords && Math.random() > 0.7; // 30% chance para mensagens expressivas
  }, []);

  const sendHumanizedResponse = useCallback(async (
    chatId: string, 
    responseText: string,
    senderName: string = 'Assistente'
  ) => {
    try {
      console.log(`🤖 Iniciando resposta humanizada para ${chatId}`);
      
      const isAudio = shouldSendAsAudio(responseText);
      const cleanText = responseText.replace(/^audio:\s*/i, '');
      
      // 1. Marcar mensagens como lidas primeiro
      console.log('👁️ Marcando mensagens como lidas...');
      await whatsappService.markAsRead(clientId, chatId);
      
      // Pequeno delay após marcar como lida
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 2. Mostrar status "digitando" ou "gravando"
      const statusType = isAudio ? 'recording' : 'typing';
      console.log(`⌨️ Mostrando status: ${statusType}`);
      await whatsappService.sendPresence(clientId, chatId, statusType);
      
      // 3. Calcular delay baseado no tamanho da resposta
      const typingDelay = calculateTypingDelay(cleanText);
      console.log(`⏱️ Aguardando ${Math.round(typingDelay/1000)}s (simulando ${statusType})`);
      
      // 4. Manter o status durante o delay
      const statusInterval = setInterval(async () => {
        try {
          await whatsappService.sendPresence(clientId, chatId, statusType);
        } catch (error) {
          console.error('Erro ao manter status:', error);
        }
      }, 3000); // Renovar status a cada 3 segundos
      
      // 5. Aguardar o delay de digitação
      await new Promise(resolve => setTimeout(resolve, typingDelay));
      
      // 6. Parar o status de digitação
      clearInterval(statusInterval);
      await whatsappService.sendPresence(clientId, chatId, 'available');
      
      // 7. Enviar a mensagem
      console.log(`📤 Enviando ${isAudio ? 'áudio' : 'texto'}: ${cleanText.substring(0, 50)}...`);
      
      if (isAudio) {
        await whatsappService.sendMessage(clientId, chatId, `audio:${cleanText}`);
      } else {
        await whatsappService.sendMessage(clientId, chatId, cleanText);
      }
      
      console.log('✅ Resposta humanizada enviada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao enviar resposta humanizada:', error);
      
      // Fallback: enviar mensagem simples sem humanização
      try {
        await whatsappService.sendMessage(clientId, chatId, responseText);
        console.log('📤 Fallback: mensagem enviada sem humanização');
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
        throw fallbackError;
      }
    }
  }, [clientId, calculateTypingDelay, shouldSendAsAudio]);

  // Função para manter status online
  const maintainOnlineStatus = useCallback(async () => {
    try {
      await whatsappService.sendPresence(clientId, '', 'available');
      console.log('🟢 Status online mantido');
    } catch (error) {
      console.error('❌ Erro ao manter status online:', error);
    }
  }, [clientId]);

  return {
    sendHumanizedResponse,
    maintainOnlineStatus,
    calculateTypingDelay
  };
};
