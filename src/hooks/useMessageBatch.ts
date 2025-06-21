
import { useState, useCallback, useRef } from 'react';

interface BatchConfig {
  timeout: number; // tempo em ms para aguardar mais mensagens
  maxBatchSize: number;
  enabled: boolean;
}

interface MessageBatch {
  chatId: string;
  messages: any[];
  timeoutId: NodeJS.Timeout | null;
  lastMessageTime: number;
}

const defaultConfig: BatchConfig = {
  timeout: 5000, // 5 segundos
  maxBatchSize: 10,
  enabled: true
};

export const useMessageBatch = (onBatchComplete: (chatId: string, messages: any[]) => void) => {
  const [config, setConfig] = useState<BatchConfig>(defaultConfig);
  const [batches, setBatches] = useState<Map<string, MessageBatch>>(new Map());
  const batchesRef = useRef<Map<string, MessageBatch>>(new Map());

  // Manter referência atualizada
  batchesRef.current = batches;

  const processBatch = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    if (!batch || batch.messages.length === 0) return;

    console.log(`📦 Processando lote de ${batch.messages.length} mensagens para ${chatId}`);
    
    // Chamar callback com as mensagens agrupadas
    onBatchComplete(chatId, [...batch.messages]);
    
    // Limpar lote
    setBatches(prev => {
      const newBatches = new Map(prev);
      newBatches.delete(chatId);
      return newBatches;
    });
  }, [onBatchComplete]);

  const addMessage = useCallback((message: any) => {
    if (!config.enabled) {
      // Se agrupamento está desabilitado, processar imediatamente
      onBatchComplete(message.from || message.chatId, [message]);
      return;
    }

    const chatId = message.from || message.chatId;
    const now = Date.now();
    
    setBatches(prev => {
      const newBatches = new Map(prev);
      const existingBatch = newBatches.get(chatId);
      
      if (existingBatch) {
        // Limpar timeout anterior
        if (existingBatch.timeoutId) {
          clearTimeout(existingBatch.timeoutId);
        }
        
        // Adicionar mensagem ao lote existente
        const updatedMessages = [...existingBatch.messages, message];
        
        // Verificar se atingiu tamanho máximo
        if (updatedMessages.length >= config.maxBatchSize) {
          // Processar imediatamente
          setTimeout(() => processBatch(chatId), 0);
          return newBatches;
        }
        
        // Configurar novo timeout
        const timeoutId = setTimeout(() => processBatch(chatId), config.timeout);
        
        newBatches.set(chatId, {
          ...existingBatch,
          messages: updatedMessages,
          timeoutId,
          lastMessageTime: now
        });
      } else {
        // Criar novo lote
        const timeoutId = setTimeout(() => processBatch(chatId), config.timeout);
        
        newBatches.set(chatId, {
          chatId,
          messages: [message],
          timeoutId,
          lastMessageTime: now
        });
      }
      
      return newBatches;
    });
    
    console.log(`📨 Mensagem adicionada ao lote ${chatId}. Aguardando ${config.timeout}ms para mais mensagens...`);
  }, [config, processBatch, onBatchComplete]);

  const forceProcessBatch = useCallback((chatId: string) => {
    processBatch(chatId);
  }, [processBatch]);

  const clearBatch = useCallback((chatId: string) => {
    setBatches(prev => {
      const newBatches = new Map(prev);
      const batch = newBatches.get(chatId);
      
      if (batch?.timeoutId) {
        clearTimeout(batch.timeoutId);
      }
      
      newBatches.delete(chatId);
      return newBatches;
    });
  }, []);

  const getBatchInfo = useCallback((chatId: string) => {
    const batch = batches.get(chatId);
    return {
      exists: !!batch,
      messageCount: batch?.messages.length || 0,
      timeRemaining: batch ? config.timeout - (Date.now() - batch.lastMessageTime) : 0
    };
  }, [batches, config.timeout]);

  return {
    config,
    setConfig,
    addMessage,
    forceProcessBatch,
    clearBatch,
    getBatchInfo,
    activeBatches: batches.size
  };
};
