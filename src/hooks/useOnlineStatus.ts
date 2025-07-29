
import { useState, useEffect, useRef, useCallback } from 'react';

export const useOnlineStatus = (clientId: string, isEnabled: boolean = true) => {
  const [isOnline, setIsOnline] = useState(false);
  const enabledRef = useRef(isEnabled);
  const lastActivityRef = useRef<number>(Date.now());
  const onlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Atualizar ref quando enabled mudar
  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  const setOnlineWithTimeout = useCallback(() => {
    if (!enabledRef.current || !clientId) return;

    // 🚫 DESABILITADO: Sistema antigo conflita com PresenceKeepAlive
    console.log('🚫 [ONLINE-STATUS] Sistema desabilitado - usando PresenceKeepAlive:', {
      clientId,
      timestamp: new Date().toLocaleTimeString(),
      nota: "Este sistema foi substituído pelo PresenceKeepAlive para evitar conflitos"
    });

    setIsOnline(true);
    lastActivityRef.current = Date.now();

    // Limpar timeout anterior
    if (onlineTimeoutRef.current) {
      clearTimeout(onlineTimeoutRef.current);
    }

    // Manter online por 5 minutos após última atividade (sem logs excessivos)
    onlineTimeoutRef.current = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= 300000) { // 5 minutos
        setIsOnline(false);
        console.log('🚫 [ONLINE-STATUS] Status OFFLINE por inatividade (sistema legado):', clientId);
      }
    }, 300000);
  }, [clientId]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (enabledRef.current) {
      setOnlineWithTimeout();
    }
  }, [setOnlineWithTimeout]);

  const setOnline = useCallback(() => {
    if (enabledRef.current) {
      setOnlineWithTimeout();
    }
  }, [setOnlineWithTimeout]);

  const setOffline = useCallback(() => {
    if (!enabledRef.current || !clientId) return;

    setIsOnline(false);
    console.log('📱 Status OFFLINE manual para cliente:', clientId);
    
    if (onlineTimeoutRef.current) {
      clearTimeout(onlineTimeoutRef.current);
      onlineTimeoutRef.current = null;
    }
  }, [clientId]);

  // Inicializar como online quando habilitado
  useEffect(() => {
    if (!enabledRef.current || !clientId) return;

    // Marcar como online imediatamente
    setOnlineWithTimeout();

    return () => {
      if (onlineTimeoutRef.current) {
        clearTimeout(onlineTimeoutRef.current);
      }
      setIsOnline(false);
    };
  }, [clientId, setOnlineWithTimeout]);

  // Detectar atividade na página
  useEffect(() => {
    const handleActivity = () => {
      markActivity();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markActivity();
      }
    };

    // Eventos de atividade
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [markActivity]);

  return {
    isOnline,
    markActivity,
    setOnline,
    setOffline
  };
};
