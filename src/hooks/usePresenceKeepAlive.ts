import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceKeepAliveOptions {
  intervalSeconds?: number;
  enabled?: boolean;
}

/**
 * Hook para manter presença online consistente no WhatsApp
 */
export const usePresenceKeepAlive = (
  instanceId: string, 
  chatId: string, 
  options: PresenceKeepAliveOptions & { clientId?: string } = {}
) => {
  const { intervalSeconds = 30, enabled = true, clientId } = options;
  
  // Log inicial para debug
  console.log(`🚀 [PRESENCE-KEEP-ALIVE] Iniciando para:`, {
    instanceId: instanceId || 'VAZIO',
    chatId: chatId || 'VAZIO', 
    clientId: clientId || 'VAZIO',
    enabled
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isActiveRef = useRef(enabled);
  const hasTokenFailureRef = useRef(false);
  const retryCountRef = useRef(0);
  const lastFailureTimeRef = useRef<number>(0);
  const initializationTimeRef = useRef<number>(Date.now());

  // Debug: Verificar estado inicial e forçar reset se necessário
  useEffect(() => {
    const now = Date.now();
    const timeSinceInit = now - initializationTimeRef.current;
    
    console.log(`🔍 [PRESENCE-KEEP-ALIVE] Estado inicial: {
      hasFailure: ${hasTokenFailureRef.current},
      retryCount: ${retryCountRef.current},
      lastFailureTime: ${lastFailureTimeRef.current ? new Date(lastFailureTimeRef.current).toLocaleTimeString() : 'nunca'},
      timeSinceInit: ${timeSinceInit}ms,
      enabled: ${enabled}
    }`);

    // Forçar reset se a inicialização aconteceu há mais de 1 minuto
    if (hasTokenFailureRef.current && timeSinceInit > 60000) {
      console.log('🔄 [PRESENCE-KEEP-ALIVE] Forçando reset na inicialização - flag muito antiga');
      hasTokenFailureRef.current = false;
      retryCountRef.current = 0;
      lastFailureTimeRef.current = 0;
    }
  }, []);

  // Atualizar ref quando enabled mudar
  useEffect(() => {
    isActiveRef.current = enabled;
    
    // Reset da flag de failure quando habilitado novamente
    if (enabled && hasTokenFailureRef.current) {
      const timeSinceFailure = Date.now() - lastFailureTimeRef.current;
      const resetAfter = 2 * 60 * 1000; // 2 minutos (reduzido)
      
      console.log(`🔍 [PRESENCE-KEEP-ALIVE] Verificando reset: {
        timeSinceFailure: ${timeSinceFailure}ms,
        resetAfter: ${resetAfter}ms,
        shouldReset: ${timeSinceFailure > resetAfter}
      }`);
      
      if (timeSinceFailure > resetAfter) {
        console.log('🔄 [PRESENCE-KEEP-ALIVE] Resetando flag de failure após timeout');
        hasTokenFailureRef.current = false;
        retryCountRef.current = 0;
      }
    }
  }, [enabled]);

  // Enviar presença usando onlineStatusManager (integração completa)
  const sendPresence = useCallback(async (status: 'available' | 'unavailable' | 'composing'): Promise<boolean> => {
    if (!instanceId || !chatId || !clientId) {
      console.log('🚫 [PRESENCE-KEEP-ALIVE] Parâmetros insuficientes:', { instanceId, chatId, clientId });
      return false;
    }

    if (hasTokenFailureRef.current && retryCountRef.current >= 3) {
      console.log('🚫 [PRESENCE-KEEP-ALIVE] Muitas falhas, ignorando tentativa');
      return false;
    }

    try {
      // Importar dinamicamente para evitar dependências circulares
      const { onlineStatusManager } = await import('@/services/onlineStatusManager');
      
      console.log(`✅ [PRESENCE-KEEP-ALIVE] Enviando presença: ${status} para ${chatId}`);
      
      // Usar o sistema completo de presença
      const success = await onlineStatusManager.configureOnlinePresence(instanceId, clientId, 'auto-trigger');
      
      if (success) {
        retryCountRef.current = 0;
        hasTokenFailureRef.current = false;
        console.log(`🎯 [PRESENCE-KEEP-ALIVE] Presença ${status} enviada com sucesso`);
        return true;
      } else {
        throw new Error('Falha na configuração de presença');
      }
    } catch (error) {
      retryCountRef.current++;
      lastFailureTimeRef.current = Date.now();
      
      if (retryCountRef.current >= 3) {
        hasTokenFailureRef.current = true;
        console.error('💥 [PRESENCE-KEEP-ALIVE] Muitas falhas, pausando sistema:', error);
      } else {
        console.warn(`⚠️ [PRESENCE-KEEP-ALIVE] Erro (tentativa ${retryCountRef.current}/3):`, error);
      }
      return false;
    }
  }, [instanceId, chatId, clientId]);

  // Iniciar keep-alive
  const startKeepAlive = useCallback(() => {
    if (!isActiveRef.current || intervalRef.current) return;

    console.log(`🚀 [PRESENCE-KEEP-ALIVE] Iniciando para ${chatId} (intervalo: ${intervalSeconds}s)`);
    
    // Enviar presença imediatamente
    sendPresence('available');
    
    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const maxInactiveTime = 5 * 60 * 1000; // 5 minutos
      
      if (timeSinceActivity < maxInactiveTime && isActiveRef.current) {
        sendPresence('available');
      } else {
        console.log('📱 [PRESENCE-KEEP-ALIVE] Pausando por inatividade');
        stopKeepAlive();
      }
    }, intervalSeconds * 1000);
  }, [chatId, intervalSeconds, sendPresence]);

  // Parar keep-alive
  const stopKeepAlive = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log(`🛑 [PRESENCE-KEEP-ALIVE] Parando para ${chatId}`);
      
      // Enviar status offline
      if (chatId && instanceId) {
        sendPresence('unavailable');
      }
    }
  }, [chatId, instanceId, sendPresence]);

  // Marcar atividade
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (isActiveRef.current && !intervalRef.current) {
      startKeepAlive();
    }
  }, [startKeepAlive]);

  // Trigger presença por mensagem
  const triggerPresenceOnMessage = useCallback(async () => {
    markActivity();
    return await sendPresence('available');
  }, [markActivity, sendPresence]);

  // Inicializar quando habilitado
  useEffect(() => {
    if (enabled && instanceId && chatId) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }

    return () => {
      stopKeepAlive();
    };
  }, [enabled, instanceId, chatId, startKeepAlive, stopKeepAlive]);

  // Detectar atividade da página
  useEffect(() => {
    const handleActivity = () => markActivity();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markActivity();
        
        // Reset da flag de failure quando página volta ao foco
        if (hasTokenFailureRef.current) {
          const timeSinceFailure = Date.now() - lastFailureTimeRef.current;
          if (timeSinceFailure > 60000) { // 1 minuto
            console.log('🔄 [PRESENCE-KEEP-ALIVE] Resetando flag de failure - página voltou ao foco');
            hasTokenFailureRef.current = false;
            retryCountRef.current = 0;
          }
        }
      } else {
        // Página ficou inativa - parar keep-alive após delay
        setTimeout(() => {
          if (document.hidden) {
            stopKeepAlive();
          }
        }, 30000); // 30 segundos
      }
    };

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
  }, [markActivity, stopKeepAlive]);

  return {
    sendPresence,
    startKeepAlive,
    stopKeepAlive,
    markActivity,
    triggerPresenceOnMessage,
    isActive: isActiveRef.current && Boolean(intervalRef.current)
  };
};
