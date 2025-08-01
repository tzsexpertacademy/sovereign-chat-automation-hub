/**
 * Hook personalizado que integra o sistema de processamento em lotes
 * com as configurações de humanização do assistente
 */

import { useState, useEffect, useCallback } from 'react';
import { useMessageBatch } from './useMessageBatch';
import { assistantHumanizationService } from '@/services/assistantHumanizationService';

export const useHumanizedMessageBatch = (
  callback: (chatId: string, messages: any[]) => void,
  assistantId?: string
) => {
  const [humanizedTimeout, setHumanizedTimeout] = useState<number>(3000);
  const [humanizationConfig, setHumanizationConfig] = useState<any>(null);

  // Hook de processamento em lotes com assistente dinâmico
  const messageBatch = useMessageBatch(callback, assistantId);

  // Carregar configuração de humanização quando assistentId mudar
  useEffect(() => {
    if (!assistantId) return;

    const loadHumanizationConfig = async () => {
      try {
        console.log(`🎭 [HUMANIZED-BATCH] Carregando configuração para assistente: ${assistantId}`);
        
        const config = await assistantHumanizationService.getHumanizationConfig(assistantId);
        setHumanizationConfig(config);
        
        // Converter segundos para milissegundos
        const timeoutMs = (config.behavior?.messageHandling?.delayBetweenChunks || 3) * 1000;
        setHumanizedTimeout(timeoutMs);
        
        console.log(`✅ [HUMANIZED-BATCH] Configuração carregada:`, {
          enabled: config.enabled,
          timeout: timeoutMs,
          assistantId
        });
        
      } catch (error) {
        console.error('❌ [HUMANIZED-BATCH] Erro ao carregar configuração:', error);
      }
    };

    loadHumanizationConfig();
  }, [assistantId]);

  // Atualizar configuração do batch quando a configuração de humanização mudar
  useEffect(() => {
    if (humanizationConfig) {
      const timeoutMs = (humanizationConfig.behavior?.messageHandling?.delayBetweenChunks || 3) * 1000;
      
      messageBatch.setConfig(prevConfig => ({
        ...prevConfig,
        timeout: timeoutMs,
        enabled: humanizationConfig.enabled,
        assistantId
      }));

      console.log(`🔄 [HUMANIZED-BATCH] Configuração do batch atualizada:`, {
        timeout: timeoutMs,
        enabled: humanizationConfig.enabled,
        assistantId
      });
    }
  }, [humanizationConfig, assistantId, messageBatch.setConfig]);

  return {
    ...messageBatch,
    humanizedTimeout,
    humanizationConfig,
    isHumanized: !!assistantId && !!humanizationConfig?.enabled
  };
};