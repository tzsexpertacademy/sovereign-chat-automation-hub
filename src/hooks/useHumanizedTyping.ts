
import { useState, useCallback } from 'react';

interface HumanizedTypingOptions {
  baseDelay?: number; // Delay base em ms
  charDelay?: number; // Delay por caractere em ms
  maxDelay?: number;  // Delay máximo em ms
  minDelay?: number;  // Delay mínimo em ms
}

export const useHumanizedTyping = (options: HumanizedTypingOptions = {}) => {
  const {
    baseDelay = 1000,    // 1 segundo base
    charDelay = 50,      // 50ms por caractere (simula velocidade de digitação)
    maxDelay = 8000,     // Máximo 8 segundos
    minDelay = 2000      // Mínimo 2 segundos
  } = options;

  const [isTyping, setIsTyping] = useState(false);

  const calculateTypingDelay = useCallback((text: string): number => {
    const textLength = text.length;
    let delay = baseDelay + (textLength * charDelay);
    
    // Aplicar limites
    delay = Math.max(minDelay, Math.min(maxDelay, delay));
    
    console.log(`⏱️ Delay calculado para ${textLength} caracteres: ${delay}ms`);
    return delay;
  }, [baseDelay, charDelay, maxDelay, minDelay]);

  const sendWithTypingDelay = useCallback(async (
    text: string, 
    sendFunction: () => Promise<void>
  ): Promise<void> => {
    const delay = calculateTypingDelay(text);
    
    console.log(`⌨️ Simulando digitação por ${delay}ms...`);
    setIsTyping(true);
    
    // Aguardar o delay simulando digitação
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Enviar a mensagem
      await sendFunction();
      console.log('✅ Mensagem enviada após delay humanizado');
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    } finally {
      setIsTyping(false);
    }
  }, [calculateTypingDelay]);

  return {
    isTyping,
    sendWithTypingDelay,
    calculateTypingDelay
  };
};
