/**
 * Hook para heartbeat inteligente baseado em atividade real
 * Gerencia presença online de forma eficiente e responsiva
 */

import { useEffect, useRef, useCallback } from 'react';
import { activitySimulationService } from '@/services/activitySimulationService';

interface UseSmartPresenceHeartbeatOptions {
  instanceId: string;
  chatId: string;
  clientId: string;
  enabled?: boolean;
  activityTimeout?: number; // Tempo sem atividade para parar heartbeat
}

export const useSmartPresenceHeartbeat = ({
  instanceId,
  chatId,
  clientId,
  enabled = true,
  activityTimeout = 120000 // 2 minutos
}: UseSmartPresenceHeartbeatOptions) => {
  
  const lastActivityRef = useRef<number>(Date.now());
  const activityCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  
  // Marcar atividade do usuário
  const markActivity = useCallback(() => {
    if (!enabled || !instanceId || !chatId) return;
    
    lastActivityRef.current = Date.now();
    
    // Marcar atividade no serviço
    activitySimulationService.markUserActivity(instanceId, chatId);
    
    // Iniciar simulação se não estiver ativa
    if (!isActiveRef.current) {
      activitySimulationService.startActivitySimulation(instanceId, chatId, clientId);
      isActiveRef.current = true;
      console.log(`🚀 [SMART-HEARTBEAT] Iniciando heartbeat para chat: ${chatId}`);
    }
  }, [enabled, instanceId, chatId, clientId]);
  
  // Parar heartbeat por inatividade
  const stopHeartbeat = useCallback(() => {
    if (isActiveRef.current) {
      activitySimulationService.stopActivitySimulation(`${instanceId}:${chatId}`);
      isActiveRef.current = false;
      console.log(`⏹️ [SMART-HEARTBEAT] Parando heartbeat por inatividade: ${chatId}`);
    }
  }, [instanceId, chatId]);
  
  // Verificar inatividade periodicamente
  const checkInactivity = useCallback(() => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    
    if (timeSinceActivity > activityTimeout && isActiveRef.current) {
      stopHeartbeat();
    }
  }, [activityTimeout, stopHeartbeat]);
  
  // Configurar detecção de atividade
  useEffect(() => {
    if (!enabled || !instanceId || !chatId) return;
    
    // Eventos que indicam atividade do usuário
    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'focus'
    ];
    
    // Handler de atividade com throttle
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledMarkActivity = () => {
      if (throttleTimeout) return;
      
      markActivity();
      
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 5000); // Throttle de 5 segundos
    };
    
    // Detectar quando página fica visível
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markActivity();
      }
    };
    
    // Adicionar listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledMarkActivity, { passive: true });
    });
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Verificar inatividade a cada 30 segundos
    activityCheckInterval.current = setInterval(checkInactivity, 30000);
    
    // Atividade inicial
    markActivity();
    
    return () => {
      // Limpar listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledMarkActivity);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (activityCheckInterval.current) {
        clearInterval(activityCheckInterval.current);
      }
      
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      
      // Parar heartbeat ao desmontar
      stopHeartbeat();
    };
  }, [enabled, instanceId, chatId, markActivity, checkInactivity, stopHeartbeat]);
  
  // Parar ao desabilitar
  useEffect(() => {
    if (!enabled) {
      stopHeartbeat();
    }
  }, [enabled, stopHeartbeat]);
  
  return {
    markActivity,
    stopHeartbeat,
    isActive: isActiveRef.current
  };
};