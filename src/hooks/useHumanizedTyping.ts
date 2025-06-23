
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
    
    console.log(`⌨️ Tempo de digitação calculado: ${finalTime}ms para ${words} palavras`);
    return finalTime;
  }, [config]);

  const startTyping = useCallback(async (chatId: string) => {
    if (!config.showTyping) return;
    
    setTypingStatus(prev => new Map(prev).set(chatId, true));
    console.log(`⌨️ INICIADO: Indicador de digitação para ${chatId}`);
  }, [config.showTyping]);

  const stopTyping = useCallback(async (chatId: string) => {
    if (!config.showTyping) return;
    
    setTypingStatus(prev => new Map(prev).set(chatId, false));
    console.log(`⌨️ PARADO: Indicador de digitação para ${chatId}`);
  }, [config.showTyping]);

  const startRecording = useCallback(async (chatId: string) => {
    if (!config.showRecording) return;
    
    setRecordingStatus(prev => new Map(prev).set(chatId, true));
    console.log(`🎤 INICIADO: Indicador de gravação para ${chatId}`);
  }, [config.showRecording]);

  const stopRecording = useCallback(async (chatId: string) => {
    if (!config.showRecording) return;
    
    setRecordingStatus(prev => new Map(prev).set(chatId, false));
    console.log(`🎤 PARADO: Indicador de gravação para ${chatId}`);
  }, [config.showRecording]);

  const simulateHumanTyping = useCallback(async (chatId: string, text: string, isAudio = false) => {
    const typingTime = calculateTypingTime(text);
    
    try {
      console.log(`🤖 INICIANDO simulação ${isAudio ? 'gravação' : 'digitação'} para: "${text.substring(0, 50)}..."`);
      
      if (isAudio) {
        await startRecording(chatId);
        await new Promise(resolve => setTimeout(resolve, typingTime));
        await stopRecording(chatId);
      } else {
        await startTyping(chatId);
        await new Promise(resolve => setTimeout(resolve, typingTime));
        await stopTyping(chatId);
      }
      
      console.log(`✅ CONCLUÍDA simulação ${isAudio ? 'gravação' : 'digitação'} em ${typingTime}ms`);
    } catch (error) {
      console.error('❌ Erro na simulação de digitação humana:', error);
    }
  }, [calculateTypingTime, startTyping, stopTyping, startRecording, stopRecording]);

  const markAsRead = useCallback(async (chatId: string, messageId: string) => {
    try {
      console.log(`✓✓ LIDA: Mensagem ${messageId} marcada como lida para ${chatId}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
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
