/**
 * Hook para usar o processador de emergência
 * Garante que mensagens não fiquem sem resposta
 */

import { useEffect, useState } from 'react';
import { emergencyProcessor } from '@/services/emergencyBatchProcessor';

export const useEmergencyProcessor = (clientId?: string) => {
  const [stats, setStats] = useState({ pending: 0, processing: 0, orphaned: 0 });
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Iniciar monitoramento quando componente montar
  useEffect(() => {
    if (clientId) {
      console.log('🚨 [EMERGENCY-HOOK] Iniciando monitor para cliente:', clientId);
      emergencyProcessor.startEmergencyMonitoring();
      setIsMonitoring(true);
      
      // Atualizar stats periodicamente
      const statsInterval = setInterval(async () => {
        const newStats = await emergencyProcessor.getBatchStats();
        setStats(newStats);
      }, 5000);
      
      return () => {
        clearInterval(statsInterval);
        emergencyProcessor.stopEmergencyMonitoring();
        setIsMonitoring(false);
      };
    }
  }, [clientId]);

  // Forçar processamento de um chat específico
  const forceProcessChat = async (chatId: string) => {
    if (!clientId) return { success: false, error: 'Client ID não fornecido' };
    
    console.log('⚡ [EMERGENCY-HOOK] Forçando processamento do chat:', chatId);
    return await emergencyProcessor.forceProcessChat(chatId, clientId);
  };

  // Executar limpeza manual
  const manualCleanup = async () => {
    console.log('🧹 [EMERGENCY-HOOK] Executando limpeza manual');
    return await emergencyProcessor.manualCleanup();
  };

  // Atualizar stats manualmente
  const refreshStats = async () => {
    const newStats = await emergencyProcessor.getBatchStats();
    setStats(newStats);
    return newStats;
  };

  return {
    stats,
    isMonitoring,
    forceProcessChat,
    manualCleanup,
    refreshStats
  };
};