
import { useState, useCallback } from 'react';

export const useHumanizedTyping = () => {
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);

  const simulateTyping = useCallback((phoneNumber: string, messageLength: number = 100) => {
    console.log('🤖 Simulando digitação para:', phoneNumber, 'tamanho:', messageLength);
    
    setShowTypingIndicator(true);
    
    // Simular tempo de digitação baseado no tamanho da mensagem
    const typingDuration = Math.min(3000, messageLength * 50);
    
    setTimeout(() => {
      setShowTypingIndicator(false);
    }, typingDuration);
    
    return true;
  }, []);

  return {
    showTypingIndicator,
    simulateTyping
  };
};
