
import { useState, useCallback } from 'react';

interface TypingConfig {
  wpm: number; // palavras por minuto
  minDelay: number;
  maxDelay: number;
  showTyping: boolean;
  showRecording: boolean;
}

const defaultConfig: TypingConfig = {
  wpm: 45, // velocidade humana média aprimorada
  minDelay: 1500,
  maxDelay: 4000,
  showTyping: true,
  showRecording: true
};

export const useHumanizedTyping = (clientId: string) => {
  const [config, setConfig] = useState<TypingConfig>(defaultConfig);
  const [typingStatus, setTypingStatus] = useState<Map<string, boolean>>(new Map());
  const [recordingStatus, setRecordingStatus] = useState<Map<string, boolean>>(new Map());

  const calculateTypingTime = useCallback((text: string): number => {
    const words = text.trim().split(/\s+/).length;
    const baseTypingTime = (words / config.wpm) * 60 * 1000;
    
    // Adicionar variação natural mais realista
    const variation = Math.random() * 0.4 + 0.8; // 80% a 120% do tempo base
    const complexityFactor = text.length > 100 ? 1.2 : 1.0; // Textos longos demoram mais
    
    const finalTime = Math.max(
      config.minDelay, 
      Math.min(config.maxDelay, baseTypingTime * variation * complexityFactor)
    );
    
    
    return finalTime;
  }, [config]);

  const startTyping = useCallback(async (chatId: string) => {
    if (!config.showTyping) return;
    
    setTypingStatus(prev => new Map(prev).set(chatId, true));
  }, [config.showTyping]);

  const stopTyping = useCallback(async (chatId: string) => {
    if (!config.showTyping) return;
    
    setTypingStatus(prev => new Map(prev).set(chatId, false));
  }, [config.showTyping]);

  const startRecording = useCallback(async (chatId: string) => {
    if (!config.showRecording) return;
    
    setRecordingStatus(prev => new Map(prev).set(chatId, true));
  }, [config.showRecording]);

  const stopRecording = useCallback(async (chatId: string) => {
    if (!config.showRecording) return;
    
    setRecordingStatus(prev => new Map(prev).set(chatId, false));
  }, [config.showRecording]);

  const simulateHumanTyping = useCallback(async (chatId: string, text: string, isAudio = false) => {
    const typingTime = calculateTypingTime(text);
    
    try {
      if (isAudio) {
        await startRecording(chatId);
        await new Promise(resolve => setTimeout(resolve, typingTime));
        await stopRecording(chatId);
      } else {
        await startTyping(chatId);
        await new Promise(resolve => setTimeout(resolve, typingTime));
        await stopTyping(chatId);
      }
    } catch (error) {
      // Silencioso - não é crítico
    }
  }, [calculateTypingTime, startTyping, stopTyping, startRecording, stopRecording]);

  const markAsRead = useCallback(async (chatId: string, messageId: string) => {
    try {
      
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  return {
    config,
    setConfig,
    typingStatus,
    recordingStatus,
    calculateTypingTime,
    simulateHumanTyping,
    startTyping,
    stopTyping,
    startRecording,
    stopRecording,
    markAsRead,
    isTyping: (chatId: string) => typingStatus.get(chatId) || false,
    isRecording: (chatId: string) => recordingStatus.get(chatId) || false
  };
};
