import { useEffect, useRef, useCallback } from 'react';
import { useBusinessToken } from './useBusinessToken';

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
  
  const { getValidToken } = useBusinessToken();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isActiveRef = useRef(enabled);
  const failureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTokenFailureRef = useRef(false);

  // Atualizar ref quando enabled mudar
  useEffect(() => {
    isActiveRef.current = enabled;
  }, [enabled]);

  // Enviar presença com token automático
  const sendPresence = useCallback(async (status: 'available' | 'unavailable' | 'composing') => {
    if (!instanceId || !chatId || !isActiveRef.current || hasTokenFailureRef.current) return false;

    try {
      // Obter token válido automaticamente
      let businessToken = '';
      if (clientId) {
        businessToken = await getValidToken(clientId) || '';
        if (!businessToken) {
          console.warn(`⚠️ [PRESENCE-KEEP-ALIVE] Token inválido para cliente: ${clientId}`);
          hasTokenFailureRef.current = true;
          
          // Parar tentativas por 5 minutos
          failureTimeoutRef.current = setTimeout(() => {
            hasTokenFailureRef.current = false;
            console.log('🔄 [PRESENCE-KEEP-ALIVE] Tentativas de token reabilitadas');
          }, 5 * 60 * 1000);
          
          return false;
        }
      }

      const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/chat/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${businessToken}`
        },
        body: JSON.stringify({
          remoteJid: chatId,
          status
        })
      });

      if (response.ok) {
        console.log(`📱 [PRESENCE-KEEP-ALIVE] Presença enviada: ${status} para ${chatId}`);
        hasTokenFailureRef.current = false; // Reset failure flag on success
        return true;
      } else if (response.status === 401 || response.status === 404) {
        console.warn(`⚠️ [PRESENCE-KEEP-ALIVE] Falha de autenticação (${response.status}) - delegando para backend`);
        hasTokenFailureRef.current = true;
        
        // Parar tentativas por 5 minutos - backend assume
        failureTimeoutRef.current = setTimeout(() => {
          hasTokenFailureRef.current = false;
          console.log('🔄 [PRESENCE-KEEP-ALIVE] Tentativas de token reabilitadas');
        }, 5 * 60 * 1000);
        
        return false;
      } else {
        console.warn(`⚠️ [PRESENCE-KEEP-ALIVE] Falha ao enviar presença:`, response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ [PRESENCE-KEEP-ALIVE] Erro ao enviar presença:', error);
      return false;
    }
  }, [instanceId, chatId, clientId, getValidToken]);

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
