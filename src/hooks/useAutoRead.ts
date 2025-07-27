/**
 * Hook para Auto-Read com Delays Naturais - CodeChat v2.2.1
 * Fase 2: Comportamentos Fundamentais
 */

import { useState, useCallback, useRef } from 'react';
import unifiedYumerService from '@/services/unifiedYumerService';

interface ReadState {
  messageId: string;
  chatId: string;
  isProcessing: boolean;
  delay: number;
  timestamp: number;
}

interface AutoReadConfig {
  enabled: boolean;
  minDelay: number;
  maxDelay: number;
  readOnlyUserMessages: boolean;
  randomDelay: boolean;
  delayBasedOnLength: boolean;
  batchRead: boolean;
  batchDelay: number;
}

const defaultConfig: AutoReadConfig = {
  enabled: true,
  minDelay: 1000,    // 1s mínimo
  maxDelay: 4000,    // 4s máximo
  readOnlyUserMessages: true,
  randomDelay: true,
  delayBasedOnLength: true,
  batchRead: true,
  batchDelay: 500    // 500ms entre leituras em lote
};

export const useAutoRead = (instanceId: string) => {
  const [config, setConfig] = useState<AutoReadConfig>(defaultConfig);
  const [processingQueue, setProcessingQueue] = useState<ReadState[]>([]);
  const [stats, setStats] = useState({
    totalRead: 0,
    avgDelay: 0,
    lastRead: null as Date | null
  });

  const readTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const batchQueueRef = useRef<ReadState[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calcular delay baseado no tamanho da mensagem
  const calculateReadDelay = useCallback((messageText?: string): number => {
    if (!config.delayBasedOnLength || !messageText) {
      // Delay aleatório básico
      if (config.randomDelay) {
        return config.minDelay + Math.random() * (config.maxDelay - config.minDelay);
      }
      return config.minDelay;
    }

    // Calcular baseado no tamanho
    const words = messageText.split(' ').length;
    const readingTimePerWord = 200; // 200ms por palavra (velocidade de leitura humana)
    const baseDelay = Math.max(words * readingTimePerWord, config.minDelay);
    
    // Adicionar variação aleatória
    let finalDelay = baseDelay;
    if (config.randomDelay) {
      const variation = baseDelay * 0.3; // ±30% de variação
      finalDelay = baseDelay + (Math.random() - 0.5) * 2 * variation;
    }
    
    return Math.max(config.minDelay, Math.min(config.maxDelay, finalDelay));
  }, [config]);

  // Marcar mensagem como lida via CodeChat API
  const markMessageAsRead = useCallback(async (
    messageId: string,
    chatId: string,
    messageText?: string
  ): Promise<boolean> => {
    if (!config.enabled || !instanceId) {
      return false;
    }

    try {
      console.log(`📖 [AUTO-READ] Marcando como lida: ${messageId}`);
      
      // CodeChat v2.2.1: /api/v2/instance/:instanceId/chat/markAsRead
      await unifiedYumerService.markAsRead(instanceId, messageId, chatId);
      
      // Atualizar estatísticas
      setStats(prev => ({
        totalRead: prev.totalRead + 1,
        avgDelay: (prev.avgDelay + calculateReadDelay(messageText)) / 2,
        lastRead: new Date()
      }));

      console.log(`✅ [AUTO-READ] Mensagem marcada como lida: ${messageId}`);
      return true;
      
    } catch (error) {
      console.error('❌ [AUTO-READ] Erro ao marcar como lida:', error);
      return false;
    }
  }, [config.enabled, instanceId, calculateReadDelay]);

  // Processar fila de leitura em lote
  const processBatchQueue = useCallback(async () => {
    if (batchQueueRef.current.length === 0) return;

    const batch = [...batchQueueRef.current];
    batchQueueRef.current = [];

    console.log(`📚 [AUTO-READ] Processando lote de ${batch.length} mensagens`);

    for (let i = 0; i < batch.length; i++) {
      const readState = batch[i];
      
      try {
        await markMessageAsRead(readState.messageId, readState.chatId);
        
        // Delay entre leituras do lote
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, config.batchDelay));
        }
      } catch (error) {
        console.error('❌ [AUTO-READ] Erro no lote:', error);
      }
    }

    // Limpar queue processada
    setProcessingQueue(prev => 
      prev.filter(item => !batch.some(b => b.messageId === item.messageId))
    );
  }, [markMessageAsRead, config.batchDelay]);

  // Agendar leitura com delay
  const scheduleRead = useCallback((
    messageId: string,
    chatId: string,
    messageText?: string,
    fromUser: boolean = true
  ) => {
    if (!config.enabled) return;
    
    // Verificar se deve ler apenas mensagens de usuários
    if (config.readOnlyUserMessages && !fromUser) {
      console.log(`🚫 [AUTO-READ] Ignorando mensagem própria: ${messageId}`);
      return;
    }

    // Cancelar leitura anterior se existir
    const existingTimeout = readTimeoutsRef.current.get(messageId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const delay = calculateReadDelay(messageText);
    const readState: ReadState = {
      messageId,
      chatId,
      isProcessing: true,
      delay,
      timestamp: Date.now()
    };

    setProcessingQueue(prev => [...prev, readState]);

    console.log(`⏰ [AUTO-READ] Agendando leitura em ${delay}ms: ${messageId}`);

    if (config.batchRead) {
      // Adicionar à fila de lote
      batchQueueRef.current.push(readState);
      
      // Resetar timer do lote
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      batchTimeoutRef.current = setTimeout(processBatchQueue, delay);
    } else {
      // Processar individualmente
      const timeout = setTimeout(async () => {
        await markMessageAsRead(messageId, chatId, messageText);
        readTimeoutsRef.current.delete(messageId);
        
        setProcessingQueue(prev => 
          prev.filter(item => item.messageId !== messageId)
        );
      }, delay);

      readTimeoutsRef.current.set(messageId, timeout);
    }
  }, [config, calculateReadDelay, markMessageAsRead, processBatchQueue]);

  // Marcar como lida imediatamente (sem delay)
  const readImmediately = useCallback(async (
    messageId: string,
    chatId: string,
    messageText?: string
  ): Promise<boolean> => {
    // Cancelar leitura agendada se existir
    const existingTimeout = readTimeoutsRef.current.get(messageId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      readTimeoutsRef.current.delete(messageId);
    }

    return await markMessageAsRead(messageId, chatId, messageText);
  }, [markMessageAsRead]);

  // Cancelar leitura agendada
  const cancelScheduledRead = useCallback((messageId: string) => {
    const timeout = readTimeoutsRef.current.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      readTimeoutsRef.current.delete(messageId);
      
      setProcessingQueue(prev => 
        prev.filter(item => item.messageId !== messageId)
      );
      
      console.log(`❌ [AUTO-READ] Leitura cancelada: ${messageId}`);
    }
  }, []);

  // Cancelar todas as leituras pendentes
  const cancelAllReads = useCallback(() => {
    // Cancelar timeouts individuais
    readTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    readTimeoutsRef.current.clear();
    
    // Cancelar lote
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    
    batchQueueRef.current = [];
    setProcessingQueue([]);
    
    console.log('❌ [AUTO-READ] Todas as leituras canceladas');
  }, []);

  // Atualizar configuração
  const updateConfig = useCallback((newConfig: Partial<AutoReadConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Obter status atual
  const getStatus = useCallback(() => {
    return {
      config,
      processingQueue: [...processingQueue],
      pendingReads: readTimeoutsRef.current.size,
      batchQueue: batchQueueRef.current.length,
      stats
    };
  }, [config, processingQueue, stats]);

  return {
    // Estado
    config,
    processingQueue,
    stats,
    
    // Controles principais
    scheduleRead,
    readImmediately,
    markMessageAsRead,
    
    // Gerenciamento
    cancelScheduledRead,
    cancelAllReads,
    
    // Configuração
    updateConfig,
    calculateReadDelay,
    
    // Utils
    getStatus
  };
};