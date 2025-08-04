import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { audioRecoveryService } from '@/services/audioRecoveryService';

/**
 * Hook para monitorar o status de processamento de áudio
 */
export const useAudioProcessingMonitor = (clientId: string) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const refreshStats = async () => {
    if (!clientId) return;
    
    try {
      console.log('📊 [AUDIO-MONITOR] Atualizando estatísticas...');
      const statistics = await audioRecoveryService.getAudioProcessingStats(clientId);
      setStats(statistics);
      setLastCheck(new Date());
      console.log('📊 [AUDIO-MONITOR] Estatísticas atualizadas:', statistics);
    } catch (error) {
      console.error('❌ [AUDIO-MONITOR] Erro ao atualizar estatísticas:', error);
    }
  };

  // Auto-reprocessar áudios órfãos se detectados
  const autoReprocessOrphaned = async () => {
    if (!clientId) return;
    
    try {
      const orphaned = await audioRecoveryService.findOrphanedAudios(clientId);
      
      if (orphaned.length > 0) {
        console.log(`🔄 [AUDIO-MONITOR] Auto-reprocessando ${orphaned.length} áudios órfãos...`);
        await audioRecoveryService.reprocessOrphanedAudios(clientId);
        
        // Atualizar estatísticas após reprocessamento
        setTimeout(refreshStats, 3000);
      }
    } catch (error) {
      console.error('❌ [AUDIO-MONITOR] Erro no auto-reprocessamento:', error);
    }
  };

  useEffect(() => {
    if (!clientId || !isMonitoring) return;

    console.log('📊 [AUDIO-MONITOR] Iniciando monitoramento para cliente:', clientId);
    
    // Atualização inicial
    refreshStats();
    
    // Monitoramento periódico a cada 30 segundos
    const monitoringInterval = setInterval(() => {
      refreshStats();
      autoReprocessOrphaned();
    }, 30000);

    return () => {
      console.log('📊 [AUDIO-MONITOR] Parando monitoramento');
      clearInterval(monitoringInterval);
    };
  }, [clientId, isMonitoring]);

  const startMonitoring = () => {
    console.log('▶️ [AUDIO-MONITOR] Iniciando monitoramento...');
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    console.log('⏹️ [AUDIO-MONITOR] Parando monitoramento...');
    setIsMonitoring(false);
  };

  return {
    isMonitoring,
    stats,
    lastCheck,
    startMonitoring,
    stopMonitoring,
    refreshStats,
    autoReprocessOrphaned
  };
};