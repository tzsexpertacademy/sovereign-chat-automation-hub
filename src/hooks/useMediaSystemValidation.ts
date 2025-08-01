import { useState, useEffect } from 'react';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';

interface MediaSystemStatus {
  isReady: boolean;
  cacheStats: {
    totalEntries: number;
    memoryUsage: string;
    expiredEntries: number;
    hitRate: number;
  };
  lastValidation: Date | null;
  errors: string[];
}

export const useMediaSystemValidation = () => {
  const [status, setStatus] = useState<MediaSystemStatus>({
    isReady: false,
    cacheStats: {
      totalEntries: 0,
      memoryUsage: '0 MB',
      expiredEntries: 0,
      hitRate: 0
    },
    lastValidation: null,
    errors: []
  });

  const validateSystem = async () => {
    try {
      console.log('🔍 MediaSystem: Validando sistema unificado...');
      
      const errors: string[] = [];
      
      // Verificar cache stats
      const cacheStats = directMediaDownloadService.getCacheStats();
      
      // Limpar cache expirado
      const expiredCount = directMediaDownloadService.clearExpiredCache();
      
      console.log('📊 MediaSystem: Stats obtidas:', {
        totalEntries: cacheStats.totalEntries,
        memoryUsage: cacheStats.memoryUsage,
        expired: cacheStats.expiredEntries,
        cleanedNow: expiredCount,
        hitRate: cacheStats.hitRate
      });

      setStatus({
        isReady: true,
        cacheStats: {
          ...cacheStats,
          expiredEntries: expiredCount
        },
        lastValidation: new Date(),
        errors
      });

    } catch (error) {
      console.error('❌ MediaSystem: Erro na validação:', error);
      setStatus(prev => ({
        ...prev,
        isReady: false,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
        lastValidation: new Date()
      }));
    }
  };

  useEffect(() => {
    validateSystem();
    
    // Validar a cada 5 minutos
    const interval = setInterval(validateSystem, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    status,
    validateSystem,
    clearLocalCache: () => {
      directMediaDownloadService.clearCache();
      validateSystem();
    }
  };
};