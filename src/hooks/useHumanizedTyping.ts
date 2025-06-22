
import { useState, useCallback, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useHumanizedTyping = (clientId: string) => {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const recordingTimeoutRef = useRef<NodeJS.Timeout>();

  const simulateTyping = useCallback(async (chatId: string, message: string, delayMs: number = 2000) => {
    try {
      setIsTyping(true);
      
      // Calcular tempo de digitação baseado no tamanho da mensagem
      const typingTime = Math.min(Math.max(message.length * 50, 1000), 5000);
      
      // Indicar que está digitando
      await whatsappService.setTyping(clientId, chatId, true);
      
      // Aguardar tempo de digitação + delay adicional
      await new Promise(resolve => setTimeout(resolve, typingTime + delayMs));
      
      // Parar indicação de digitação
      await whatsappService.setTyping(clientId, chatId, false);
      
      // Corrigido: removido o terceiro parâmetro hasFile
      await whatsappService.sendMessage(clientId, chatId, message);
      
    } catch (error) {
      console.error('❌ Erro na simulação de digitação:', error);
    } finally {
      setIsTyping(false);
    }
  }, [clientId]);

  const simulateRecording = useCallback(async (chatId: string, audioUrl: string, duration: number = 3000) => {
    try {
      // Indicar que está gravando
      await whatsappService.setRecording(clientId, chatId, true);
      
      // Aguardar duração da "gravação"
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Parar indicação de gravação
      await whatsappService.setRecording(clientId, chatId, false);
      
      // Enviar áudio
      await whatsappService.sendMessage(clientId, chatId, '🎤 Áudio', true, audioUrl);
      
    } catch (error) {
      console.error('❌ Erro na simulação de gravação:', error);
    }
  }, [clientId]);

  const startTyping = useCallback((chatId: string) => {
    whatsappService.setTyping(clientId, chatId, true);
    setIsTyping(true);
    
    // Auto-parar depois de 10 segundos
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      whatsappService.setTyping(clientId, chatId, false);
      setIsTyping(false);
    }, 10000);
  }, [clientId]);

  const stopTyping = useCallback((chatId: string) => {
    whatsappService.setTyping(clientId, chatId, false);
    setIsTyping(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [clientId]);

  const startRecording = useCallback((chatId: string) => {
    whatsappService.setRecording(clientId, chatId, true);
    
    // Auto-parar depois de 30 segundos
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    
    recordingTimeoutRef.current = setTimeout(() => {
      whatsappService.setRecording(clientId, chatId, false);
    }, 30000);
  }, [clientId]);

  const stopRecording = useCallback((chatId: string) => {
    whatsappService.setRecording(clientId, chatId, false);
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
  }, [clientId]);

  return {
    isTyping,
    simulateTyping,
    simulateRecording,
    startTyping,
    stopTyping,
    startRecording,
    stopRecording
  };
};
