/**
 * Hook para processamento de mensagens em lotes (batch)
 * Agrupa mensagens recebidas em um período de tempo e processa em conjunto
 */

import { useRef, useState, useCallback, useEffect } from 'react';

interface BatchConfig {
  timeout: number; // tempo em ms para aguardar mais mensagens
  maxBatchSize: number;
  enabled: boolean;
  assistantId?: string;
}

interface MessageBatch {
  messages: any[];
  timeoutId: NodeJS.Timeout | null;
  lastMessageTime: number;
  isProcessing: boolean;
}

const defaultConfig: BatchConfig = {
  timeout: 2500, // 2.5 segundos por padrão
  maxBatchSize: 10,
  enabled: true
};

export const useMessageBatch = (
  callback: (chatId: string, messages: any[]) => void,
  assistantId?: string
) => {
  const batchesRef = useRef<Map<string, MessageBatch>>(new Map());
  const [config, setConfig] = useState<BatchConfig>({ ...defaultConfig, assistantId });

  // Configuração padrão simplificada
  const loadHumanizationConfig = useCallback(async (assistantId: string) => {
    try {
      console.log(`🎭 [MESSAGE-BATCH] Aplicando config padrão para assistente: ${assistantId}`);
      
      // Usar timeout padrão de 2.5 segundos
      const defaultTimeout = 2500;
      
      setConfig(prev => ({
        ...prev,
        timeout: defaultTimeout
      }));
      
      console.log('✅ [MESSAGE-BATCH] Timeout padrão aplicado:', defaultTimeout);
      
    } catch (error) {
      console.error('❌ [MESSAGE-BATCH] Erro ao aplicar config padrão:', error);
    }
  }, []);

  // Adicionar mensagem ao batch
  const addMessage = useCallback((message: any) => {
    if (!config.enabled) {
      callback(message.chatId || message.from, [message]);
      return;
    }

    const chatId = message.chatId || message.from;
    const batches = batchesRef.current;
    
    console.log(`📦 [MESSAGE-BATCH] Adicionando mensagem ao batch: ${chatId}`);
    
    // Se não existe batch para este chat, criar novo
    if (!batches.has(chatId)) {
      batches.set(chatId, {
        messages: [],
        timeoutId: null,
        lastMessageTime: Date.now(),
        isProcessing: false
      });
    }

    const batch = batches.get(chatId)!;
    
    // Se o batch está sendo processado, criar um novo
    if (batch.isProcessing) {
      console.log(`⏳ [MESSAGE-BATCH] Batch em processamento, criando novo para: ${chatId}`);
      
      batches.set(chatId, {
        messages: [message],
        timeoutId: null,
        lastMessageTime: Date.now(),
        isProcessing: false
      });
      
      // Processar o novo batch
      const newBatch = batches.get(chatId)!;
      newBatch.timeoutId = setTimeout(() => {
        processBatch(chatId);
      }, config.timeout);
      
      return;
    }

    // Limpar timeout anterior se existir
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
    }

    // Adicionar mensagem ao batch
    batch.messages.push(message);
    batch.lastMessageTime = Date.now();

    console.log(`📊 [MESSAGE-BATCH] Batch atualizado: ${batch.messages.length}/${config.maxBatchSize} mensagens`);

    // Processar imediatamente se atingiu o limite máximo
    if (batch.messages.length >= config.maxBatchSize) {
      console.log(`🚀 [MESSAGE-BATCH] Limite atingido, processando batch: ${chatId}`);
      processBatch(chatId);
      return;
    }

    // Configurar novo timeout
    batch.timeoutId = setTimeout(() => {
      processBatch(chatId);
    }, config.timeout);

  }, [config, callback]);

  // Processar um batch específico
  const processBatch = useCallback((chatId: string) => {
    const batches = batchesRef.current;
    const batch = batches.get(chatId);
    
    if (!batch || batch.messages.length === 0) {
      return;
    }

    console.log(`⚡ [MESSAGE-BATCH] Processando batch: ${chatId} - ${batch.messages.length} mensagens`);

    // Marcar como processando
    batch.isProcessing = true;
    
    // Limpar timeout
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
      batch.timeoutId = null;
    }

    // Criar cópia das mensagens
    const messagesToProcess = [...batch.messages];
    
    // Limpar o batch
    batch.messages = [];

    try {
      // Processar mensagens
      callback(chatId, messagesToProcess);
      console.log(`✅ [MESSAGE-BATCH] Batch processado com sucesso: ${chatId}`);
    } catch (error) {
      console.error(`❌ [MESSAGE-BATCH] Erro ao processar batch: ${chatId}`, error);
    } finally {
      // Marcar como não processando
      batch.isProcessing = false;
    }
  }, [callback]);

  // Forçar processamento de um batch
  const forceProcessBatch = useCallback((chatId: string) => {
    console.log(`🔄 [MESSAGE-BATCH] Forçando processamento: ${chatId}`);
    processBatch(chatId);
  }, [processBatch]);

  // Limpar um batch específico
  const clearBatch = useCallback((chatId: string) => {
    const batches = batchesRef.current;
    const batch = batches.get(chatId);
    
    if (batch) {
      if (batch.timeoutId) {
        clearTimeout(batch.timeoutId);
      }
      batches.delete(chatId);
      console.log(`🗑️ [MESSAGE-BATCH] Batch limpo: ${chatId}`);
    }
  }, []);

  // Obter informações de um batch
  const getBatchInfo = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    return batch ? {
      messageCount: batch.messages.length,
      isProcessing: batch.isProcessing,
      lastMessageTime: batch.lastMessageTime,
      timeRemaining: batch.timeoutId ? config.timeout - (Date.now() - batch.lastMessageTime) : 0
    } : null;
  }, [config.timeout]);

  // Marcar batch como completado
  const markBatchAsCompleted = useCallback((chatId: string) => {
    const batches = batchesRef.current;
    const batch = batches.get(chatId);
    
    if (batch) {
      batch.isProcessing = false;
      console.log(`✨ [MESSAGE-BATCH] Batch marcado como completado: ${chatId}`);
    }
  }, []);

  // Atualizar callback
  const updateCallback = useCallback((newCallback: (chatId: string, messages: any[]) => void) => {
    console.log('🔄 [MESSAGE-BATCH] Callback atualizado');
  }, []);

  // Carregar configuração quando assistantId mudar
  useEffect(() => {
    if (assistantId) {
      loadHumanizationConfig(assistantId);
    }
  }, [assistantId, loadHumanizationConfig]);

  // Limpeza de referências processadas periodicamente
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const batches = batchesRef.current;
      
      for (const [chatId, batch] of batches.entries()) {
        // Limpar batches inativos há mais de 5 minutos
        if (!batch.isProcessing && (now - batch.lastMessageTime) > 300000) {
          if (batch.timeoutId) {
            clearTimeout(batch.timeoutId);
          }
          batches.delete(chatId);
          console.log(`🧹 [MESSAGE-BATCH] Batch inativo limpo: ${chatId}`);
        }
      }
    }, 60000); // Limpar a cada minuto

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    config,
    setConfig,
    addMessage,
    forceProcessBatch,
    clearBatch,
    getBatchInfo,
    markBatchAsCompleted,
    updateCallback,
    // Stats
    activeBatches: batchesRef.current.size
  };
};