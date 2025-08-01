import { useState, useCallback } from 'react';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { useRetryWithBackoff } from './useRetryWithBackoff';

interface MediaRecoveryState {
  isRecovering: boolean;
  error: string | null;
  attempts: number;
  lastAttempt: Date | null;
}

export const useMediaRecovery = () => {
  const [state, setState] = useState<MediaRecoveryState>({
    isRecovering: false,
    error: null,
    attempts: 0,
    lastAttempt: null
  });

  const { retryWithBackoff } = useRetryWithBackoff();

  const recoverMedia = useCallback(async (
    instanceId: string,
    messageId: string,
    mediaUrl: string,
    mediaKey?: string,
    directPath?: string,
    mimetype?: string,
    contentType: 'image' | 'video' | 'audio' | 'document' = 'document'
  ) => {
    setState(prev => ({
      ...prev,
      isRecovering: true,
      error: null,
      attempts: prev.attempts + 1,
      lastAttempt: new Date()
    }));

    try {
      console.log('🔄 MediaRecovery: Iniciando recuperação', {
        messageId,
        contentType,
        attempt: state.attempts + 1
      });

      const result = await retryWithBackoff(
        async () => {
          const result = await directMediaDownloadService.processMedia(
            instanceId,
            messageId,
            mediaUrl,
            mediaKey,
            directPath,
            mimetype,
            contentType
          );

          if (!result.success) {
            throw new Error(result.error || 'Falha na recuperação');
          }

          return result;
        },
        {
          maxAttempts: 3,
          initialDelay: 2000,
          maxDelay: 10000,
          backoffMultiplier: 2
        },
        `MediaRecovery-${contentType}`
      );

      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: null
      }));

      console.log('✅ MediaRecovery: Recuperação bem-sucedida', {
        messageId,
        contentType,
        totalAttempts: state.attempts + 1
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: errorMessage
      }));

      console.error('❌ MediaRecovery: Falha na recuperação', {
        messageId,
        contentType,
        error: errorMessage,
        totalAttempts: state.attempts + 1
      });

      throw error;
    }
  }, [retryWithBackoff, state.attempts]);

  const clearRecoveryState = useCallback(() => {
    setState({
      isRecovering: false,
      error: null,
      attempts: 0,
      lastAttempt: null
    });
  }, []);

  const healthCheck = useCallback(async () => {
    try {
      console.log('🔍 MediaRecovery: Health check iniciado');
      
      // Testar conectividade básica com timeout manual
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.yumer.com.br/health', {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check falhou: ${response.status}`);
      }

      // Verificar estatísticas do cache
      const cacheStats = directMediaDownloadService.getCacheStats();
      console.log('📊 MediaRecovery: Cache stats', cacheStats);

      // Limpar cache expirado
      const expiredCount = directMediaDownloadService.clearExpiredCache();
      if (expiredCount > 0) {
        console.log(`🧹 MediaRecovery: ${expiredCount} entradas de cache expiradas removidas`);
      }

      return {
        healthy: true,
        cacheStats,
        expiredCleared: expiredCount
      };

    } catch (error) {
      console.error('❌ MediaRecovery: Health check falhou', error);
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }, []);

  return {
    ...state,
    recoverMedia,
    clearRecoveryState,
    healthCheck
  };
};