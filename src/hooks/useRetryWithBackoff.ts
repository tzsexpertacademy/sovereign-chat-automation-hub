// Hook para retry com backoff exponencial
import { useCallback } from 'react';

interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export const useRetryWithBackoff = () => {
  const retryWithBackoff = useCallback(async <T>(
    operation: () => Promise<T>,
    options: RetryOptions = {
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    },
    operationName: string = 'Operation'
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        console.log(`🔄 [RETRY] ${operationName} - Tentativa ${attempt}/${options.maxAttempts}`);
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`✅ [RETRY] ${operationName} sucedeu na tentativa ${attempt}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ [RETRY] ${operationName} falhou na tentativa ${attempt}:`, error.message);
        
        if (attempt === options.maxAttempts) {
          console.error(`❌ [RETRY] ${operationName} falhou após ${options.maxAttempts} tentativas`);
          break;
        }
        
        // Calcular delay com backoff exponencial
        const delay = Math.min(
          options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1),
          options.maxDelay
        );
        
        console.log(`⏳ [RETRY] Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }, []);

  return { retryWithBackoff };
};