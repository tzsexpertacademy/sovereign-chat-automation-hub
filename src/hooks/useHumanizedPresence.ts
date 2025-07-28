/**
 * Hook para gerenciar indicadores de presença humanizada
 * Integra com o sistema de humanização do backend
 */

import { useState, useCallback, useEffect } from 'react';

interface PresenceState {
  isTyping: boolean;
  isRecording: boolean;
  isOnline: boolean;
  chatId: string | null;
  lastActivity: Date | null;
}

interface PresenceConfig {
  enabled: boolean;
  showTyping: boolean;
  showRecording: boolean;
  showOnline: boolean;
  typingTimeout: number; // ms
  recordingTimeout: number; // ms
}

const defaultConfig: PresenceConfig = {
  enabled: true,
  showTyping: true,
  showRecording: true,
  showOnline: true,
  typingTimeout: 10000, // 10 segundos
  recordingTimeout: 30000 // 30 segundos
};

export const useHumanizedPresence = (initialChatId?: string) => {
  const [config, setConfig] = useState<PresenceConfig>(defaultConfig);
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceState>>(new Map());
  const [timeoutMap, setTimeoutMap] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Limpar timeouts ao desmontar
  useEffect(() => {
    return () => {
      timeoutMap.forEach(timeout => clearTimeout(timeout));
    };
  }, [timeoutMap]);

  // Obter estado de presença para um chat específico
  const getPresenceState = useCallback((chatId: string): PresenceState => {
    return presenceMap.get(chatId) || {
      isTyping: false,
      isRecording: false,
      isOnline: false,
      chatId,
      lastActivity: null
    };
  }, [presenceMap]);

  // Definir presença de typing
  const setTyping = useCallback((chatId: string, isTyping: boolean) => {
    if (!config.enabled || !config.showTyping) return;

    console.log(`⌨️ [PRESENCE] Typing ${isTyping ? 'started' : 'stopped'} para ${chatId}`);

    setPresenceMap(prev => {
      const newMap = new Map(prev);
      const currentState = getPresenceState(chatId);
      
      newMap.set(chatId, {
        ...currentState,
        isTyping,
        lastActivity: new Date()
      });
      
      return newMap;
    });

    // Limpar timeout anterior se existir
    const existingTimeout = timeoutMap.get(`typing-${chatId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Se está digitando, configurar timeout automático
    if (isTyping) {
      const timeout = setTimeout(() => {
        console.log(`⌨️ [PRESENCE] Auto-stop typing para ${chatId} (timeout)`);
        setTyping(chatId, false);
      }, config.typingTimeout);

      setTimeoutMap(prev => {
        const newMap = new Map(prev);
        newMap.set(`typing-${chatId}`, timeout);
        return newMap;
      });
    }
  }, [config, getPresenceState, timeoutMap]);

  // Definir presença de gravação
  const setRecording = useCallback((chatId: string, isRecording: boolean) => {
    if (!config.enabled || !config.showRecording) return;

    console.log(`🎙️ [PRESENCE] Recording ${isRecording ? 'started' : 'stopped'} para ${chatId}`);

    setPresenceMap(prev => {
      const newMap = new Map(prev);
      const currentState = getPresenceState(chatId);
      
      newMap.set(chatId, {
        ...currentState,
        isRecording,
        lastActivity: new Date()
      });
      
      return newMap;
    });

    // Limpar timeout anterior se existir
    const existingTimeout = timeoutMap.get(`recording-${chatId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Se está gravando, configurar timeout automático
    if (isRecording) {
      const timeout = setTimeout(() => {
        console.log(`🎙️ [PRESENCE] Auto-stop recording para ${chatId} (timeout)`);
        setRecording(chatId, false);
      }, config.recordingTimeout);

      setTimeoutMap(prev => {
        const newMap = new Map(prev);
        newMap.set(`recording-${chatId}`, timeout);
        return newMap;
      });
    }
  }, [config, getPresenceState, timeoutMap]);

  // Definir presença online
  const setOnline = useCallback((chatId: string, isOnline: boolean) => {
    if (!config.enabled || !config.showOnline) return;

    console.log(`🟢 [PRESENCE] Online ${isOnline ? 'connected' : 'disconnected'} para ${chatId}`);

    setPresenceMap(prev => {
      const newMap = new Map(prev);
      const currentState = getPresenceState(chatId);
      
      newMap.set(chatId, {
        ...currentState,
        isOnline,
        lastActivity: new Date()
      });
      
      return newMap;
    });
  }, [config, getPresenceState]);

  // Simular typing humanizado (baseado em texto e velocidade)
  const simulateTyping = useCallback(async (
    chatId: string, 
    text: string, 
    typingSpeed: number = 45 // WPM
  ): Promise<void> => {
    if (!config.enabled || !config.showTyping) return;

    // Calcular duração baseada no texto
    const words = text.split(' ').length;
    const baseTypingTime = (words / typingSpeed) * 60 * 1000;
    
    // Aplicar variação natural (80% a 120% do tempo base)
    const duration = baseTypingTime * (0.8 + Math.random() * 0.4);
    
    // Limitar entre 1-10 segundos
    const finalDuration = Math.max(1000, Math.min(10000, duration));

    console.log(`⌨️ [PRESENCE] Simulando typing para "${text.substring(0, 50)}..." por ${finalDuration}ms`);

    // Iniciar typing
    setTyping(chatId, true);

    // Parar após duração calculada
    return new Promise((resolve) => {
      setTimeout(() => {
        setTyping(chatId, false);
        resolve();
      }, finalDuration);
    });
  }, [config, setTyping]);

  // Limpar toda a presença de um chat
  const clearPresence = useCallback((chatId: string) => {
    console.log(`🧹 [PRESENCE] Limpando presença para ${chatId}`);

    // Limpar timeouts relacionados
    const typingTimeout = timeoutMap.get(`typing-${chatId}`);
    const recordingTimeout = timeoutMap.get(`recording-${chatId}`);
    
    if (typingTimeout) clearTimeout(typingTimeout);
    if (recordingTimeout) clearTimeout(recordingTimeout);

    // Remover do mapa de timeouts
    setTimeoutMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(`typing-${chatId}`);
      newMap.delete(`recording-${chatId}`);
      return newMap;
    });

    // Remover do mapa de presença
    setPresenceMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(chatId);
      return newMap;
    });
  }, [timeoutMap]);

  // Atualizar configuração
  const updateConfig = useCallback((newConfig: Partial<PresenceConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    console.log('⚙️ [PRESENCE] Configuração atualizada:', newConfig);
  }, []);

  // Verificar se há alguma atividade
  const hasActivity = useCallback((chatId: string): boolean => {
    const state = getPresenceState(chatId);
    return state.isTyping || state.isRecording;
  }, [getPresenceState]);

  // Obter estatísticas
  const getStats = useCallback(() => {
    const activeChats = Array.from(presenceMap.keys());
    const typingChats = activeChats.filter(chatId => presenceMap.get(chatId)?.isTyping);
    const recordingChats = activeChats.filter(chatId => presenceMap.get(chatId)?.isRecording);
    const onlineChats = activeChats.filter(chatId => presenceMap.get(chatId)?.isOnline);

    return {
      totalChats: activeChats.length,
      typingChats: typingChats.length,
      recordingChats: recordingChats.length,
      onlineChats: onlineChats.length,
      lastActivity: Array.from(presenceMap.values())
        .map(state => state.lastActivity)
        .filter(Boolean)
        .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0] || null
    };
  }, [presenceMap]);

  // Estado para chat atual (se fornecido)
  const currentChatState = initialChatId ? getPresenceState(initialChatId) : null;

  return {
    // Estado atual
    config,
    currentChatState,
    
    // Ações
    setTyping,
    setRecording,
    setOnline,
    simulateTyping,
    clearPresence,
    updateConfig,
    
    // Consultas
    getPresenceState,
    hasActivity,
    getStats,
    
    // Estados helpers para chat atual
    isTyping: currentChatState?.isTyping || false,
    isRecording: currentChatState?.isRecording || false,
    isOnline: currentChatState?.isOnline || false,
    lastActivity: currentChatState?.lastActivity || null
  };
};