/**
 * Hook para Status de Presença Real - CodeChat v2.2.1
 * Fase 2: Comportamentos Fundamentais
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import unifiedYumerService from '@/services/unifiedYumerService';

type PresenceStatus = 'available' | 'composing' | 'unavailable';

interface PresenceState {
  status: PresenceStatus;
  chatId: string | null;
  lastUpdate: number | null;
  isOnline: boolean;
}

interface PresenceConfig {
  enabled: boolean;
  autoOnline: boolean;
  onlineOnActivity: boolean;
  offlineAfterInactivity: number; // milliseconds
  presenceUpdateDelay: number;
}

const defaultConfig: PresenceConfig = {
  enabled: true,
  autoOnline: true,
  onlineOnActivity: true,
  offlineAfterInactivity: 300000, // 5 minutos
  presenceUpdateDelay: 1000
};

export const useRealTimePresence = (instanceId: string) => {
  const [config, setConfig] = useState<PresenceConfig>(defaultConfig);
  const [presenceState, setPresenceState] = useState<PresenceState>({
    status: 'available',
    chatId: null,
    lastUpdate: null,
    isOnline: false
  });

  const presenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Atualizar presença via CodeChat API
  const updatePresence = useCallback(async (
    chatId: string, 
    status: PresenceStatus,
    force: boolean = false
  ): Promise<boolean> => {
    if (!config.enabled || !instanceId) {
      return false;
    }

    // Evitar updates desnecessários
    if (!force && presenceState.chatId === chatId && presenceState.status === status) {
      return true;
    }

    try {
      console.log(`👤 [REAL-PRESENCE] Atualizando presença: ${chatId} -> ${status}`);
      
      // Delay para evitar spam de updates
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
      }

      presenceTimeoutRef.current = setTimeout(async () => {
        try {
          await unifiedYumerService.setPresence(instanceId, chatId, status);
          
          setPresenceState({
            status,
            chatId,
            lastUpdate: Date.now(),
            isOnline: status === 'available' || status === 'composing'
          });

          console.log(`✅ [REAL-PRESENCE] Presença atualizada: ${status}`);
        } catch (error) {
          console.error('❌ [REAL-PRESENCE] Erro ao atualizar presença:', error);
        }
      }, config.presenceUpdateDelay);

      return true;
      
    } catch (error) {
      console.error('❌ [REAL-PRESENCE] Erro na atualização de presença:', error);
      return false;
    }
  }, [config, instanceId, presenceState]);

  // Definir como online
  const setOnline = useCallback(async (chatId: string): Promise<boolean> => {
    lastActivityRef.current = Date.now();
    
    if (config.autoOnline) {
      return await updatePresence(chatId, 'available');
    }
    return false;
  }, [config.autoOnline, updatePresence]);

  // Definir como offline/unavailable
  const setOffline = useCallback(async (chatId: string): Promise<boolean> => {
    return await updatePresence(chatId, 'unavailable');
  }, [updatePresence]);

  // Definir como digitando
  const setTyping = useCallback(async (chatId: string): Promise<boolean> => {
    lastActivityRef.current = Date.now();
    return await updatePresence(chatId, 'composing');
  }, [updatePresence]);

  // Marcar atividade (reset do timer de offline)
  const markActivity = useCallback((chatId?: string) => {
    lastActivityRef.current = Date.now();
    
    if (config.onlineOnActivity && chatId) {
      setOnline(chatId);
    }

    // Resetar timer de offline
    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
    }

    // Novo timer para ficar offline após inatividade
    if (config.offlineAfterInactivity > 0 && chatId) {
      offlineTimeoutRef.current = setTimeout(() => {
        console.log('⏰ [REAL-PRESENCE] Ficando offline por inatividade');
        setOffline(chatId);
      }, config.offlineAfterInactivity);
    }
  }, [config, setOnline, setOffline]);

  // Gerenciar presença durante digitação
  const handleTypingSession = useCallback(async (
    chatId: string,
    duration: number
  ): Promise<void> => {
    try {
      // Iniciar typing
      await setTyping(chatId);
      
      // Aguardar duração
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Voltar para online
      await setOnline(chatId);
      
    } catch (error) {
      console.error('❌ [REAL-PRESENCE] Erro na sessão de typing:', error);
    }
  }, [setTyping, setOnline]);

  // Limpar todos os timers
  const cleanup = useCallback(() => {
    if (presenceTimeoutRef.current) {
      clearTimeout(presenceTimeoutRef.current);
      presenceTimeoutRef.current = null;
    }
    
    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
      offlineTimeoutRef.current = null;
    }
  }, []);

  // Forçar status específico
  const forceStatus = useCallback(async (chatId: string, status: PresenceStatus): Promise<boolean> => {
    return await updatePresence(chatId, status, true);
  }, [updatePresence]);

  // Obter informações de atividade
  const getActivityInfo = useCallback(() => {
    const now = Date.now();
    const lastActivity = lastActivityRef.current;
    const timeSinceActivity = now - lastActivity;
    const timeUntilOffline = Math.max(0, config.offlineAfterInactivity - timeSinceActivity);
    
    return {
      lastActivity: new Date(lastActivity),
      timeSinceActivity,
      timeUntilOffline,
      isActive: timeSinceActivity < config.offlineAfterInactivity,
      willGoOffline: config.offlineAfterInactivity > 0 && timeUntilOffline > 0
    };
  }, [config.offlineAfterInactivity]);

  // Atualizar configuração
  const updateConfig = useCallback((newConfig: Partial<PresenceConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Status atual
  const getStatus = useCallback(() => {
    return {
      ...presenceState,
      config,
      activity: getActivityInfo()
    };
  }, [presenceState, config, getActivityInfo]);

  // Cleanup na desmontagem
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Auto-start se configurado
  useEffect(() => {
    if (config.autoOnline && instanceId) {
      lastActivityRef.current = Date.now();
    }
  }, [config.autoOnline, instanceId]);

  return {
    // Estado
    ...presenceState,
    config,
    
    // Controles principais
    setOnline,
    setOffline,
    setTyping,
    
    // Ações avançadas
    updatePresence,
    forceStatus,
    handleTypingSession,
    markActivity,
    
    // Configuração
    updateConfig,
    
    // Utils
    getStatus,
    getActivityInfo,
    cleanup
  };
};