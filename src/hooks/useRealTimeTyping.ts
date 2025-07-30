/**
 * Hook para Typing Indicator Real - Conectado com CodeChat v2.2.1
 * Fase 2: Comportamentos Fundamentais
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import unifiedYumerService from '@/services/unifiedYumerService';

interface TypingState {
  isTyping: boolean;
  isRecording: boolean;
  chatId: string | null;
  startedAt: number | null;
  duration: number;
}

interface TypingConfig {
  enabled: boolean;
  minDuration: number;
  maxDuration: number;
  autoStopTimeout: number;
  showVisualIndicator: boolean;
}

const defaultConfig: TypingConfig = {
  enabled: true,
  minDuration: 1000,
  maxDuration: 5000,
  autoStopTimeout: 30000,
  showVisualIndicator: true
};

export const useRealTimeTyping = (instanceId: string) => {
  const [config, setConfig] = useState<TypingConfig>(defaultConfig);
  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: false,
    isRecording: false,
    chatId: null,
    startedAt: null,
    duration: 0
  });

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calcular duração de typing baseada no texto
  const calculateTypingDuration = useCallback((text: string, wordsPerMinute: number = 45): number => {
    const words = text.trim().split(/\s+/).length;
    const baseTypingTime = (words / wordsPerMinute) * 60 * 1000;
    
    // Adicionar variação natural (±20%)
    const variation = baseTypingTime * 0.2 * (Math.random() - 0.5) * 2;
    const duration = baseTypingTime + variation;
    
    // Aplicar limites
    return Math.max(
      config.minDuration,
      Math.min(config.maxDuration, duration)
    );
  }, [config.minDuration, config.maxDuration]);

  // Iniciar typing indicator via CodeChat API
  const startTyping = useCallback(async (chatId: string, text?: string): Promise<boolean> => {
    if (!config.enabled || !instanceId) {
      return false;
    }

    try {
      // Parar typing anterior se existir
      if (typingState.isTyping) {
        await stopTyping();
      }

      console.log(`⌨️ [REAL-TYPING] Iniciando typing para ${chatId}`);
      
      // 🚫 DESABILITADO: setPresence não existe no CodeChat v2.2.1
      console.log(`🚫 [REAL-TYPING] setPresence desabilitado (endpoint inexistente): composing para ${chatId}`);
      
      const duration = text ? calculateTypingDuration(text) : config.minDuration;
      const startTime = Date.now();
      
      setTypingState({
        isTyping: true,
        isRecording: false,
        chatId,
        startedAt: startTime,
        duration
      });

      // Auto-stop após duração calculada
      typingTimeoutRef.current = setTimeout(async () => {
        await stopTyping();
      }, duration);

      // Auto-stop de segurança
      setTimeout(async () => {
        if (typingState.isTyping) {
          console.log('⚠️ [REAL-TYPING] Auto-stop de segurança ativado');
          await stopTyping();
        }
      }, config.autoStopTimeout);

      return true;
      
    } catch (error) {
      console.error('❌ [REAL-TYPING] Erro ao iniciar typing:', error);
      return false;
    }
  }, [config, instanceId, typingState.isTyping, calculateTypingDuration]);

  // Parar typing indicator
  const stopTyping = useCallback(async (): Promise<boolean> => {
    if (!typingState.isTyping || !typingState.chatId) {
      return false;
    }

    try {
      console.log(`⌨️ [REAL-TYPING] Parando typing para ${typingState.chatId}`);
      
      // 🚫 DESABILITADO: setPresence não existe no CodeChat v2.2.1
      console.log(`🚫 [REAL-TYPING] setPresence desabilitado (endpoint inexistente): available para ${typingState.chatId}`);
      
      // Limpar timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      setTypingState({
        isTyping: false,
        isRecording: false,
        chatId: null,
        startedAt: null,
        duration: 0
      });

      return true;
      
    } catch (error) {
      console.error('❌ [REAL-TYPING] Erro ao parar typing:', error);
      return false;
    }
  }, [instanceId, typingState]);

  // Iniciar recording indicator
  const startRecording = useCallback(async (chatId: string, duration?: number): Promise<boolean> => {
    if (!config.enabled || !instanceId) {
      return false;
    }

    try {
      // Parar recording anterior se existir
      if (typingState.isRecording) {
        await stopRecording();
      }

      console.log(`🎤 [REAL-TYPING] Iniciando recording para ${chatId}`);
      
      // 🚫 DESABILITADO: setPresence não existe no CodeChat v2.2.1
      console.log(`🚫 [REAL-TYPING] setPresence desabilitado (endpoint inexistente): composing para ${chatId}`);
      
      const recordDuration = duration || 5000; // 5s padrão
      const startTime = Date.now();
      
      setTypingState({
        isTyping: false,
        isRecording: true,
        chatId,
        startedAt: startTime,
        duration: recordDuration
      });

      // Auto-stop após duração
      recordingTimeoutRef.current = setTimeout(async () => {
        await stopRecording();
      }, recordDuration);

      return true;
      
    } catch (error) {
      console.error('❌ [REAL-TYPING] Erro ao iniciar recording:', error);
      return false;
    }
  }, [config.enabled, instanceId, typingState.isRecording]);

  // Parar recording indicator
  const stopRecording = useCallback(async (): Promise<boolean> => {
    if (!typingState.isRecording || !typingState.chatId) {
      return false;
    }

    try {
      console.log(`🎤 [REAL-TYPING] Parando recording para ${typingState.chatId}`);
      
      // 🚫 DESABILITADO: setPresence não existe no CodeChat v2.2.1
      console.log(`🚫 [REAL-TYPING] setPresence desabilitado (endpoint inexistente): available para ${typingState.chatId}`);
      
      // Limpar timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      setTypingState({
        isTyping: false,
        isRecording: false,
        chatId: null,
        startedAt: null,
        duration: 0
      });

      return true;
      
    } catch (error) {
      console.error('❌ [REAL-TYPING] Erro ao parar recording:', error);
      return false;
    }
  }, [instanceId, typingState]);

  // Simular typing completo (iniciar -> aguardar -> parar)
  const simulateTyping = useCallback(async (chatId: string, text: string): Promise<boolean> => {
    try {
      const success = await startTyping(chatId, text);
      if (!success) return false;

      // Aguardar a duração do typing
      const duration = calculateTypingDuration(text);
      await new Promise(resolve => setTimeout(resolve, duration));
      
      return await stopTyping();
      
    } catch (error) {
      console.error('❌ [REAL-TYPING] Erro na simulação completa:', error);
      return false;
    }
  }, [startTyping, stopTyping, calculateTypingDuration]);

  // Força parada de tudo
  const forceStop = useCallback(async () => {
    try {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (typingState.chatId) {
        // 🚫 DESABILITADO: setPresence não existe no CodeChat v2.2.1
        console.log(`🚫 [REAL-TYPING] setPresence desabilitado (endpoint inexistente): available para ${typingState.chatId}`);
      }

      setTypingState({
        isTyping: false,
        isRecording: false,
        chatId: null,
        startedAt: null,
        duration: 0
      });
      
    } catch (error) {
      console.error('❌ [REAL-TYPING] Erro na parada forçada:', error);
    }
  }, [instanceId, typingState.chatId]);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      forceStop();
    };
  }, [forceStop]);

  // Atualizar configuração
  const updateConfig = useCallback((newConfig: Partial<TypingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Status atual
  const getStatus = useCallback(() => {
    const now = Date.now();
    const elapsed = typingState.startedAt ? now - typingState.startedAt : 0;
    const remaining = Math.max(0, typingState.duration - elapsed);
    
    return {
      ...typingState,
      elapsed,
      remaining,
      progress: typingState.duration > 0 ? elapsed / typingState.duration : 0,
      config
    };
  }, [typingState, config]);

  return {
    // Estado
    ...typingState,
    config,
    
    // Controles
    startTyping,
    stopTyping,
    startRecording,
    stopRecording,
    simulateTyping,
    forceStop,
    
    // Configuração
    updateConfig,
    calculateTypingDuration,
    
    // Utils
    getStatus
  };
};