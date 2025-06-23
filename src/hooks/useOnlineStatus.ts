
import { useState, useEffect, useRef, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useOnlineStatus = (clientId: string, isEnabled: boolean = true) => {
  const [isOnline, setIsOnline] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const enabledRef = useRef(isEnabled);

  // Atualizar ref quando enabled mudar
  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  const updateOnlineStatus = useCallback(async () => {
    if (!enabledRef.current || !clientId) return;

    try {
      // Simular atividade online - comentado para evitar 404s
      // await whatsappService.updatePresence(clientId, 'available');
      setIsOnline(true);
      lastActivityRef.current = Date.now();
      console.log('📱 Status online simulado para cliente:', clientId);
    } catch (error) {
      console.error('❌ Erro ao atualizar status online:', error);
      setIsOnline(false);
    }
  }, [clientId]);

  const setOnline = useCallback(() => {
    if (enabledRef.current) {
      updateOnlineStatus();
    }
  }, [updateOnlineStatus]);

  const setOffline = useCallback(async () => {
    if (!enabledRef.current || !clientId) return;

    try {
      // Comentado para evitar 404s
      // await whatsappService.updatePresence(clientId, 'unavailable');
      setIsOnline(false);
      console.log('📱 Status offline simulado para cliente:', clientId);
    } catch (error) {
      console.error('❌ Erro ao marcar offline:', error);
    }
  }, [clientId]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (enabledRef.current) {
      updateOnlineStatus();
    }
  }, [updateOnlineStatus]);

  // Configurar intervalo de 30 segundos - REMOVIDO para evitar loops
  useEffect(() => {
    if (!enabledRef.current || !clientId) return;

    // Atualizar imediatamente
    updateOnlineStatus();

    // Comentado o intervalo para evitar loops infinitos
    /*
    intervalRef.current = setInterval(() => {
      updateOnlineStatus();
    }, 30000);
    */

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsOnline(false);
    };
  }, [clientId, updateOnlineStatus]);

  // Detectar quando a aba fica inativa - SIMPLIFICADO
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    isOnline,
    markActivity,
    setOnline,
    setOffline
  };
};
