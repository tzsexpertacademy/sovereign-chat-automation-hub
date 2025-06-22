
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
  const batchesRef = useRef<Map<string, MessageBatch>>(new Map());

  const processBatch = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    if (!batch || batch.messages.length === 0) return;

    console.log(`📦 Processando lote de ${batch.messages.length} mensagens para ${chatId}:`, 
      batch.messages.map(m => m.body?.substring(0, 30) || '[mídia]').join(', '));
    
    // Chamar callback com as mensagens agrupadas
    onBatchComplete(chatId, [...batch.messages]);
    
    // Limpar lote
    batchesRef.current.delete(chatId);
  }, [onBatchComplete]);

  const addMessage = useCallback((message: any) => {
    if (!config.enabled) {
      // Se agrupamento está desabilitado, processar imediatamente
      console.log('📨 Agrupamento desabilitado, processando mensagem imediatamente');
      onBatchComplete(message.from || message.chatId, [message]);
      return;
    }

    const chatId = message.from || message.chatId;
    const now = Date.now();
    
    console.log(`📨 Adicionando mensagem ao lote ${chatId}:`, {
      content: message.body?.substring(0, 50) || '[mídia]',
      fromMe: message.fromMe,
      timestamp: new Date(message.timestamp || now).toLocaleTimeString()
    });
    
    const existingBatch = batchesRef.current.get(chatId);
    
    if (existingBatch) {
      // Limpar timeout anterior
      if (existingBatch.timeoutId) {
        clearTimeout(existingBatch.timeoutId);
        console.log(`⏰ Cancelando timeout anterior para ${chatId}`);
      }
      
      // Adicionar mensagem ao lote existente
      const updatedMessages = [...existingBatch.messages, message];
      
      // Verificar se atingiu tamanho máximo
      if (updatedMessages.length >= config.maxBatchSize) {
        console.log(`📊 Tamanho máximo atingido (${config.maxBatchSize}), processando imediatamente`);
        batchesRef.current.delete(chatId);
        setTimeout(() => onBatchComplete(chatId, updatedMessages), 0);
        return;
      }
      
      // Configurar novo timeout
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Timeout de ${config.timeout}ms atingido para ${chatId}, processando lote`);
        processBatch(chatId);
      }, config.timeout);
      
      batchesRef.current.set(chatId, {
        ...existingBatch,
        messages: updatedMessages,
        timeoutId,
        lastMessageTime: now
      });
      
      console.log(`📦 Lote atualizado para ${chatId}: ${updatedMessages.length} mensagens, próximo timeout em ${config.timeout}ms`);
    } else {
      // Criar novo lote
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Timeout inicial de ${config.timeout}ms atingido para ${chatId}, processando lote`);
        processBatch(chatId);
      }, config.timeout);
      
      batchesRef.current.set(chatId, {
        chatId,
        messages: [message],
        timeoutId,
        lastMessageTime: now
      });
      
      console.log(`📦 Novo lote criado para ${chatId}: 1 mensagem, timeout em ${config.timeout}ms`);
    }
  }, [config, processBatch, onBatchComplete]);

  const forceProcessBatch = useCallback((chatId: string) => {
    console.log(`🔄 Forçando processamento do lote ${chatId}`);
    processBatch(chatId);
  }, [processBatch]);

  const clearBatch = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    
    if (batch?.timeoutId) {
      clearTimeout(batch.timeoutId);
    }
    
    batchesRef.current.delete(chatId);
    console.log(`🗑️ Lote ${chatId} limpo`);
  }, []);

  const getBatchInfo = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    return {
      exists: !!batch,
      messageCount: batch?.messages.length || 0,
      timeRemaining: batch ? config.timeout - (Date.now() - batch.lastMessageTime) : 0
    };
  }, [config.timeout]);

  return {
    config,
    setConfig,
    addMessage,
    forceProcessBatch,
    clearBatch,
    getBatchInfo,
    activeBatches: batchesRef.current.size
  };
};
