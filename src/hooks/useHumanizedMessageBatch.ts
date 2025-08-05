/**
 * Hook personalizado que integra o sistema de processamento em lotes
 * com configurações básicas de comportamento (sem personalidades complexas)
 */

import { useState, useEffect } from 'react';
import { useMessageBatch } from './useMessageBatch';

export const useHumanizedMessageBatch = (
  callback: (chatId: string, messages: any[]) => void,
  assistantId?: string
) => {
  const [humanizedTimeout, setHumanizedTimeout] = useState<number>(4000);
  const [humanizationConfig, setHumanizationConfig] = useState<{ enabled: boolean; timeout: number } | null>(null);

  // Hook de processamento em lotes
  const messageBatch = useMessageBatch(callback, assistantId);

  // Configuração com timing inteligente unificado
  useEffect(() => {
    if (assistantId) {
      // Timeout base: 4 segundos (será ajustado dinamicamente pelo sistema)
      const timeout = 4000;
      setHumanizedTimeout(timeout);
      
      // Configuração unificada
      setHumanizationConfig({
        enabled: true,
        timeout
      });
      
      console.log('📋 [HUMANIZED-BATCH] Configuração unificada aplicada:', {
        enabled: true,
        baseTimeout: timeout,
        note: 'Sistema inteligente: 4s texto, 10s mídia, 12s misto'
      });
    }
  }, [assistantId]);

  // Atualizar configuração do message batch 
  useEffect(() => {
    if (humanizationConfig && assistantId) {
      messageBatch.setConfig(prev => ({
        ...prev,
        timeout: humanizedTimeout,
        enabled: humanizationConfig.enabled,
        assistantId
      }));
      
      console.log('🔄 [HUMANIZED-BATCH] Config atualizada:', {
        timeout: humanizedTimeout,
        enabled: humanizationConfig.enabled
      });
    }
  }, [humanizationConfig, humanizedTimeout, assistantId, messageBatch]);

  return {
    ...messageBatch,
    humanizedTimeout,
    humanizationConfig,
    isHumanized: !!assistantId && !!humanizationConfig?.enabled
  };
};