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
  const [humanizedTimeout, setHumanizedTimeout] = useState<number>(2500);
  const [humanizationConfig, setHumanizationConfig] = useState<{ enabled: boolean; timeout: number } | null>(null);

  // Hook de processamento em lotes
  const messageBatch = useMessageBatch(callback, assistantId);

  // Configuração com timeout otimizado para áudios
  useEffect(() => {
    if (assistantId) {
      // Timeout otimizado: 6 segundos para permitir processamento de áudios
      const timeout = 6000; 
      setHumanizedTimeout(timeout);
      
      // Configuração mínima
      setHumanizationConfig({
        enabled: true,
        timeout
      });
      
      console.log('📋 [HUMANIZED-BATCH] Configuração otimizada aplicada:', {
        enabled: true,
        timeout,
        note: 'Timeout aumentado para áudios'
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