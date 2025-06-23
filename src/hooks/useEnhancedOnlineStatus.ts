
import { useState, useEffect, useRef, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useEnhancedOnlineStatus = (clientId: string, instanceId: string) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Simular status sempre online de forma mais realística
  const maintainOnlineStatus = useCallback(async () => {
    if (!mountedRef.current || !clientId || !instanceId) return;

    try {
      console.log('🟢 Mantendo status online para instância:', instanceId);
      
      // Simular presença ativa no WhatsApp
      await whatsappService.updatePresence(instanceId, 'available');
      
      setIsOnline(true);
      setLastActivity(new Date());
      
      console.log('✅ Status online confirmado:', new Date().toLocaleTimeString());
    } catch (error) {
      console.warn('⚠️ Erro ao manter status online (simulando):', error);
      // Manter online mesmo se houver erro de API
      setIsOnline(true);
    }
  }, [clientId, instanceId]);

  // Simular atividade frequente
  const simulateActivity = useCallback(() => {
    if (!mountedRef.current) return;
    
    setLastActivity(new Date());
    console.log('📱 Atividade simulada:', new Date().toLocaleTimeString());
  }, []);

  // Inicializar status online
  useEffect(() => {
    if (!clientId || !instanceId) return;

    console.log('🚀 Inicializando status online simulado para:', instanceId);
    mountedRef.current = true;

    // Marcar como online imediatamente
    maintainOnlineStatus();

    // Manter status online a cada 30 segundos
    intervalRef.current = setInterval(() => {
      maintainOnlineStatus();
    }, 30000);

    // Simular atividade a cada 2 minutos
    const activityInterval = setInterval(() => {
      simulateActivity();
    }, 120000);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(activityInterval);
    };
  }, [clientId, instanceId, maintainOnlineStatus, simulateActivity]);

  // Detectar quando a aba fica ativa/inativa
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && mountedRef.current) {
        console.log('👁️ Aba ativa - reforçando status online');
        maintainOnlineStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [maintainOnlineStatus]);

  return {
    isOnline,
    lastActivity,
    maintainOnlineStatus,
    simulateActivity
  };
};
