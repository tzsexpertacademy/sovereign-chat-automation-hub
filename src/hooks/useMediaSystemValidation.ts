import { useState, useEffect } from 'react';
import { unifiedMediaService } from '@/services/unifiedMediaService';

interface MediaSystemStatus {
  isReady: boolean;
  cacheStats: {
    localCacheSize: number;
    dbCacheSize: number;
    totalExpired: number;
  };
  lastValidation: Date | null;
  errors: string[];
}

export const useMediaSystemValidation = () => {
  const [status, setStatus] = useState<MediaSystemStatus>({
    isReady: false,
    cacheStats: {
      localCacheSize: 0,
      dbCacheSize: 0,
      totalExpired: 0
    },
    lastValidation: null,
    errors: []
  });

  const validateSystem = async () => {
    try {
      console.log('🔍 MediaSystem: Validando sistema unificado...');
      
      const errors: string[] = [];
      
      // Verificar cache stats
      const cacheStats = await unifiedMediaService.getCacheStats();
      
      // Limpar cache expirado
      const expiredCount = await unifiedMediaService.cleanExpiredCache();
      
      console.log('📊 MediaSystem: Stats obtidas:', {
        localCache: cacheStats.localCacheSize,
        dbCache: cacheStats.dbCacheSize,
        expired: cacheStats.totalExpired,
        cleanedNow: expiredCount
      });

      setStatus({
        isReady: true,
        cacheStats: {
          ...cacheStats,
          totalExpired: expiredCount
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
      unifiedMediaService.clearLocalCache();
      validateSystem();
    }
  };
};