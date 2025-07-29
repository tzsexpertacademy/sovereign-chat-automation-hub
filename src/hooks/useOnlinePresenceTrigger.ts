/**
 * Hook para gerenciar triggers automáticos de presença online
 * Detecta atividade e configura presença automaticamente
 */

import { useEffect, useCallback, useRef } from 'react';
import { onlineStatusManager } from '@/services/onlineStatusManager';

interface UseOnlinePresenceTriggerOptions {
  instanceId?: string;
  clientId: string;
  enabled?: boolean;
  triggerDelay?: number; // Delay para evitar spam de calls
}

export const useOnlinePresenceTrigger = ({
  instanceId,
  clientId,
  enabled = true,
  triggerDelay = 10000 // 10 segundos entre triggers
}: UseOnlinePresenceTriggerOptions) => {
  const lastTriggerRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função para trigger manual com debounce
  const triggerPresence = useCallback(async (source: 'user' | 'ai' | 'auto-trigger' = 'auto-trigger') => {
    if (!enabled || !instanceId || !clientId) {
      console.log('🚫 [PRESENCE-TRIGGER] Trigger ignorado - sistema desabilitado ou dados faltando');
      return;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerRef.current;

    // Verificar se já passou tempo suficiente desde o último trigger
    if (timeSinceLastTrigger < triggerDelay) {
      console.log(`⏳ [PRESENCE-TRIGGER] Aguardando ${(triggerDelay - timeSinceLastTrigger) / 1000}s para próximo trigger`);
      return;
    }

    console.log(`🔵 [PRESENCE-TRIGGER] Acionando presença: ${source}`);
    lastTriggerRef.current = now;

    try {
      await onlineStatusManager.configureOnlinePresence(instanceId, clientId, source);
    } catch (error) {
      console.error('❌ [PRESENCE-TRIGGER] Erro:', error);
    }
  }, [instanceId, clientId, enabled, triggerDelay]);

  // Trigger com delay (debounced)
  const triggerWithDelay = useCallback((source: 'user' | 'ai' | 'auto-trigger' = 'auto-trigger', delay: number = 2000) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      triggerPresence(source);
    }, delay);
  }, [triggerPresence]);

  // Detectar atividade na página para trigger automático
  useEffect(() => {
    if (!enabled || !instanceId) return;

    const handleActivity = () => {
      triggerWithDelay('auto-trigger', 3000); // 3s delay após atividade
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Trigger inicial quando hook é montado
    triggerWithDelay('auto-trigger', 1000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, instanceId, triggerWithDelay]);

  return {
    triggerPresence,
    triggerWithDelay
  };
};