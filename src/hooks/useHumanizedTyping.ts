
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface TypingConfig {
  wpm: number; // palavras por minuto
  minDelay: number;
  maxDelay: number;
  showTyping: boolean;
  showRecording: boolean;
}

const defaultConfig: TypingConfig = {
  wpm: 40, // velocidade humana média
  minDelay: 1000,
  maxDelay: 3000,
  showTyping: true,
  showRecording: true
};

export const useHumanizedTyping = (clientId: string) => {
  const [config, setConfig] = useState<TypingConfig>(defaultConfig);
  const [typingStatus, setTypingStatus] = useState<Map<string, boolean>>(new Map());
  const [recordingStatus, setRecordingStatus] = useState<Map<string, boolean>>(new Map());

  const calculateTypingTime = useCallback((text: string): number => {
    const words = text.trim().split(/\s+/).length;
    const typingTimeMs = (words / config.wpm) * 60 * 1000;
    
    // Adicionar variação natural
    const variation = Math.random() * 0.3 + 0.85; // 85% a 115% do tempo base
    return Math.max(config.minDelay, Math.min(config.maxDelay, typingTimeMs * variation));
  }, [config]);

  const startTyping = useCallback(async (chatId: string) => {
    if (!config.showTyping) return;
    
    try {
      setTypingStatus(prev => new Map(prev).set(chatId, true));
      await whatsappService.setTyping(clientId, chatId, true);
      console.log(`⌨️ Indicador de digitação iniciado para ${chatId}`);
    } catch (error) {
      console.error('❌ Erro ao iniciar indicador de digitação:', error);
    }
  }, [clientId, config.showTyping]);

  const stopTyping = useCallback(async (chatId: string) => {
    if (!config.showTyping) return;
    
    try {
      setTypingStatus(prev => new Map(prev).set(chatId, false));
      await whatsappService.setTyping(clientId, chatId, false);
      console.log(`⌨️ Indicador de digitação parado para ${chatId}`);
    } catch (error) {
      console.error('❌ Erro ao parar indicador de digitação:', error);
    }
  }, [clientId, config.showTyping]);

  const startRecording = useCallback(async (chatId: string) => {
    if (!config.showRecording) return;
    
    try {
      setRecordingStatus(prev => new Map(prev).set(chatId, true));
      await whatsappService.setRecording(clientId, chatId, true);
      console.log(`🎤 Indicador de gravação iniciado para ${chatId}`);
    } catch (error) {
      console.error('❌ Erro ao iniciar indicador de gravação:', error);
    }
  }, [clientId, config.showRecording]);

  const stopRecording = useCallback(async (chatId: string) => {
    if (!config.showRecording) return;
    
    try {
      setRecordingStatus(prev => new Map(prev).set(chatId, false));
      await whatsappService.setRecording(clientId, chatId, false);
      console.log(`🎤 Indicador de gravação parado para ${chatId}`);
    } catch (error) {
      console.error('❌ Erro ao parar indicador de gravação:', error);
    }
  }, [clientId, config.showRecording]);

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
      
      console.log(`🤖 Simulação humana concluída: ${typingTime}ms para "${text.substring(0, 50)}..."`);
    } catch (error) {
      console.error('❌ Erro na simulação de digitação humana:', error);
    }
  }, [calculateTypingTime, startTyping, stopTyping, startRecording, stopRecording]);

  const markAsRead = useCallback(async (chatId: string, messageId: string) => {
    try {
      await whatsappService.markAsRead(clientId, chatId, messageId);
      console.log(`✓ Mensagem marcada como lida: ${messageId}`);
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  }, [clientId]);

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
    markAsRead
  };
};
