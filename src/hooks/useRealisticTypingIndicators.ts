
import { useState, useCallback, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface TypingConfig {
  baseTypingSpeed: number; // palavras por minuto
  variationFactor: number; // variação na velocidade
  minDelay: number; // delay mínimo em ms
  maxDelay: number; // delay máximo em ms
  pauseBetweenSentences: number; // pausa entre frases
}

const defaultConfig: TypingConfig = {
  baseTypingSpeed: 45, // velocidade humana realística
  variationFactor: 0.3, // 30% de variação
  minDelay: 2000,
  maxDelay: 8000,
  pauseBetweenSentences: 1500
};

export const useRealisticTypingIndicators = (instanceId: string) => {
  const [activeChats, setActiveChats] = useState<Map<string, boolean>>(new Map());
  const [recordingChats, setRecordingChats] = useState<Map<string, boolean>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Calcular tempo de digitação realístico
  const calculateTypingDuration = useCallback((text: string, isAudio = false): number => {
    if (isAudio) {
      // Para áudio: simular tempo de gravação (mais longo)
      const words = text.trim().split(/\s+/).length;
      return Math.max(3000, words * 800 + Math.random() * 2000);
    }

    // Para texto: baseado na velocidade de digitação humana
    const words = text.trim().split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    
    const baseTime = (words / defaultConfig.baseTypingSpeed) * 60 * 1000;
    const variation = baseTime * defaultConfig.variationFactor * (Math.random() - 0.5);
    const sentencePauses = sentences * defaultConfig.pauseBetweenSentences;
    
    const totalTime = baseTime + variation + sentencePauses;
    
    return Math.max(
      defaultConfig.minDelay,
      Math.min(defaultConfig.maxDelay, totalTime)
    );
  }, []);

  // Iniciar indicador de digitação
  const startTyping = useCallback(async (chatId: string, text: string) => {
    try {
      console.log(`⌨️ INICIANDO digitação para ${chatId}:`, text.substring(0, 50));
      
      setActiveChats(prev => new Map(prev).set(chatId, true));
      
      // Enviar comando para WhatsApp Web
      await whatsappService.setTyping(instanceId, chatId, true);
      
      const duration = calculateTypingDuration(text);
      console.log(`⏱️ Duração da digitação: ${duration}ms`);
      
      // Agendar parada automática
      const existingTimeout = timeoutsRef.current.get(chatId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      const timeout = setTimeout(async () => {
        await stopTyping(chatId);
      }, duration);
      
      timeoutsRef.current.set(chatId, timeout);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar digitação:', error);
    }
  }, [instanceId, calculateTypingDuration]);

  // Parar indicador de digitação
  const stopTyping = useCallback(async (chatId: string) => {
    try {
      console.log(`⌨️ PARANDO digitação para ${chatId}`);
      
      setActiveChats(prev => {
        const newMap = new Map(prev);
        newMap.set(chatId, false);
        return newMap;
      });
      
      await whatsappService.setTyping(instanceId, chatId, false);
      
      // Limpar timeout
      const timeout = timeoutsRef.current.get(chatId);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(chatId);
      }
      
    } catch (error) {
      console.error('❌ Erro ao parar digitação:', error);
    }
  }, [instanceId]);

  // Iniciar indicador de gravação
  const startRecording = useCallback(async (chatId: string, text: string) => {
    try {
      console.log(`🎤 INICIANDO gravação para ${chatId}`);
      
      setRecordingChats(prev => new Map(prev).set(chatId, true));
      
      await whatsappService.setRecording(instanceId, chatId, true);
      
      const duration = calculateTypingDuration(text, true);
      console.log(`🎵 Duração da gravação: ${duration}ms`);
      
      // Agendar parada automática
      const existingTimeout = timeoutsRef.current.get(`${chatId}_recording`);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      const timeout = setTimeout(async () => {
        await stopRecording(chatId);
      }, duration);
      
      timeoutsRef.current.set(`${chatId}_recording`, timeout);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
    }
  }, [instanceId, calculateTypingDuration]);

  // Parar indicador de gravação
  const stopRecording = useCallback(async (chatId: string) => {
    try {
      console.log(`🎤 PARANDO gravação para ${chatId}`);
      
      setRecordingChats(prev => {
        const newMap = new Map(prev);
        newMap.set(chatId, false);
        return newMap;
      });
      
      await whatsappService.setRecording(instanceId, chatId, false);
      
      // Limpar timeout
      const timeout = timeoutsRef.current.get(`${chatId}_recording`);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(chatId);
      }
      
    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error);
    }
  }, [instanceId]);

  // Simular digitação completa (recomendado)
  const simulateTyping = useCallback(async (chatId: string, text: string, isAudio = false) => {
    if (isAudio) {
      await startRecording(chatId, text);
    } else {
      await startTyping(chatId, text);
    }
  }, [startTyping, startRecording]);

  return {
    activeChats,
    recordingChats,
    startTyping,
    stopTyping,
    startRecording,
    stopRecording,
    simulateTyping,
    calculateTypingDuration
  };
};
