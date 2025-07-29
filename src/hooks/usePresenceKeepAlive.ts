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

  // Atualizar ref quando enabled mudar
  useEffect(() => {
    isActiveRef.current = enabled;
    
    // Reset da flag de failure quando habilitado novamente
    if (enabled && hasTokenFailureRef.current) {
      const timeSinceFailure = Date.now() - lastFailureTimeRef.current;
      const resetAfter = 3 * 60 * 1000; // 3 minutos
      
      if (timeSinceFailure > resetAfter) {
        console.log('🔄 [PRESENCE-KEEP-ALIVE] Resetando flag de failure após timeout');
        hasTokenFailureRef.current = false;
        retryCountRef.current = 0;
      }
    }
  }, [enabled]);

  // Enviar presença usando business_token fixo (CodeChat v2.2.1)
  const sendPresence = useCallback(async (status: 'available' | 'unavailable' | 'composing') => {
    if (!instanceId || !chatId || !isActiveRef.current || hasTokenFailureRef.current) {
      console.log(`⏭️ [PRESENCE-KEEP-ALIVE] Ignorando envio:`, {
        instanceId: instanceId || 'VAZIO',
        chatId: chatId || 'VAZIO',
        isActive: isActiveRef.current,
        hasFailure: hasTokenFailureRef.current
      });
      return false;
    }

    try {
      // Buscar business_token diretamente da tabela clients (CodeChat v2.2.1)
      let businessToken = '';
      if (clientId) {
        console.log(`🔍 [PRESENCE-KEEP-ALIVE] Buscando business_token para cliente: ${clientId}`);
        
        const { data: client, error } = await supabase
          .from('clients')
          .select('business_token')
          .eq('id', clientId)
          .single();

        if (error || !client?.business_token) {
          console.warn(`⚠️ [PRESENCE-KEEP-ALIVE] Business token não encontrado para cliente: ${clientId}`, error);
          console.log(`❌ [PRESENCE-KEEP-ALIVE] Marcando failure permanente - token não encontrado`);
          hasTokenFailureRef.current = true;
          lastFailureTimeRef.current = Date.now();
          return false;
        }

        businessToken = client.business_token;
        const maskedToken = businessToken.substring(0, 8) + '...' + businessToken.substring(businessToken.length - 4);
        console.log(`✅ [PRESENCE-KEEP-ALIVE] Business token encontrado: ${maskedToken}`);
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
        hasTokenFailureRef.current = false; // Reset flag em caso de sucesso
        return true;
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ [PRESENCE-KEEP-ALIVE] Falha ao enviar presença (${response.status}):`, errorText);
        
        // Incrementar tentativas para erros temporários
        retryCountRef.current++;
        
        // Para 401/403/404, marcar failure permanente
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          console.log(`❌ [PRESENCE-KEEP-ALIVE] Erro ${response.status} - marcando failure permanente`);
          hasTokenFailureRef.current = true;
          lastFailureTimeRef.current = Date.now();
        } else if (retryCountRef.current >= 3) {
          // Após 3 tentativas de erros temporários, pausar temporariamente
          console.log(`❌ [PRESENCE-KEEP-ALIVE] Muitas tentativas (${retryCountRef.current}) - pausando temporariamente`);
          hasTokenFailureRef.current = true;
          lastFailureTimeRef.current = Date.now();
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ [PRESENCE-KEEP-ALIVE] Erro ao enviar presença:', error);
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
