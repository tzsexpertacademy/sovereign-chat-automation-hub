
import { useState, useEffect, useRef, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useOnlineStatus = (clientId: string, isEnabled: boolean = true) => {
  const [isOnline, setIsOnline] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const updateOnlineStatus = useCallback(async () => {
    if (!isEnabled || !clientId) return;

    try {
      // Simular atividade online enviando presença
      await whatsappService.updatePresence(clientId, 'available');
      setIsOnline(true);
      lastActivityRef.current = Date.now();
      console.log('📱 Status online atualizado para cliente:', clientId);
    } catch (error) {
      console.error('❌ Erro ao atualizar status online:', error);
      setIsOnline(false);
    }
  }, [clientId, isEnabled]);

  const setOnline = useCallback(() => {
    if (isEnabled) {
      updateOnlineStatus();
    }
  }, [updateOnlineStatus, isEnabled]);

  const setOffline = useCallback(async () => {
    if (!isEnabled || !clientId) return;

    try {
      await whatsappService.updatePresence(clientId, 'unavailable');
      setIsOnline(false);
      console.log('📱 Status offline para cliente:', clientId);
    } catch (error) {
      console.error('❌ Erro ao marcar offline:', error);
    }
  }, [clientId, isEnabled]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isEnabled) {
      updateOnlineStatus();
    }
  }, [updateOnlineStatus, isEnabled]);

  // Configurar intervalo de 30 segundos para manter online
  useEffect(() => {
    if (!isEnabled || !clientId) return;

    // Atualizar imediatamente
    updateOnlineStatus();

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      updateOnlineStatus();
    }, 30000); // 30 segundos

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Marcar como offline ao desmontar
      whatsappService.updatePresence(clientId, 'unavailable').catch(console.error);
      setIsOnline(false);
    };
  }, [clientId, isEnabled, updateOnlineStatus]);

  // Detectar quando a aba fica inativa e pausar
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Aba ficou inativa, pausar atualizações
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Aba ficou ativa, retomar atualizações
        if (isEnabled && clientId && !intervalRef.current) {
          updateOnlineStatus();
          intervalRef.current = setInterval(updateOnlineStatus, 30000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clientId, isEnabled, updateOnlineStatus]);

  return {
    isOnline,
    markActivity,
    setOnline,
    setOffline
  };
};
