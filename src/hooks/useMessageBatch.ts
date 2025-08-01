
import { useState, useCallback, useRef, useEffect } from 'react';
import { assistantHumanizationService } from '@/services/assistantHumanizationService';

interface BatchConfig {
  timeout: number; // tempo em ms para aguardar mais mensagens
  maxBatchSize: number;
  enabled: boolean;
  assistantId?: string; // ID do assistente para buscar configurações de humanização
}

interface MessageBatch {
  chatId: string;
  messages: any[];
  timeoutId: NodeJS.Timeout | null;
  lastMessageTime: number;
  isProcessing: boolean;
}

const defaultConfig: BatchConfig = {
  timeout: 3000, // Reduzido para 3 segundos
  maxBatchSize: 5, // Reduzido para evitar lotes muito grandes
  enabled: true
};

export const useMessageBatch = (initialCallback?: (chatId: string, messages: any[]) => void, assistantId?: string) => {
  const [config, setConfig] = useState<BatchConfig>(defaultConfig);
  const batchesRef = useRef<Map<string, MessageBatch>>(new Map());
  const callbackRef = useRef(initialCallback);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const [humanizedTimeout, setHumanizedTimeout] = useState<number>(defaultConfig.timeout);

  // Carregar configuração de humanização do assistente
  const loadHumanizationConfig = useCallback(async () => {
    if (!assistantId) return;
    
    try {
      console.log(`🎭 Carregando configuração de humanização para assistente: ${assistantId}`);
      const humanizedConfig = await assistantHumanizationService.getHumanizationConfig(assistantId);
      
      // Converter segundos para milissegundos
      const timeoutMs = (humanizedConfig.behavior?.messageHandling?.delayBetweenChunks || 3) * 1000;
      setHumanizedTimeout(timeoutMs);
      
      // Atualizar configuração do batch
      setConfig(prevConfig => ({
        ...prevConfig,
        timeout: timeoutMs,
        enabled: humanizedConfig.enabled,
        assistantId
      }));
      
      console.log(`✅ Timeout de humanização carregado: ${timeoutMs}ms`, {
        enabled: humanizedConfig.enabled,
        assistantId
      });
      
    } catch (error) {
      console.error('❌ Erro ao carregar configuração de humanização:', error);
    }
  }, [assistantId]);

  // Atualizar a referência do callback quando necessário
  const updateCallback = useCallback((newCallback: (chatId: string, messages: any[]) => void) => {
    callbackRef.current = newCallback;
    console.log('📦 Callback do lote atualizado');
  }, []);

  const processBatch = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    if (!batch || batch.messages.length === 0 || batch.isProcessing) {
      console.log(`📦 Lote ${chatId} não pode ser processado:`, {
        exists: !!batch,
        messageCount: batch?.messages.length || 0,
        isProcessing: batch?.isProcessing || false
      });
      return;
    }

    console.log(`📦 Processando lote de ${batch.messages.length} mensagens para ${chatId}`);
    
    // Marcar como em processamento ANTES de chamar o callback
    batchesRef.current.set(chatId, {
      ...batch,
      isProcessing: true,
      timeoutId: null
    });
    
    // Chamar callback se existir
    if (callbackRef.current) {
      try {
        callbackRef.current(chatId, [...batch.messages]);
        console.log(`✅ Callback executado para lote ${chatId}`);
      } catch (error) {
        console.error(`❌ Erro ao executar callback do lote ${chatId}:`, error);
        // Em caso de erro, remover da flag de processamento
        const currentBatch = batchesRef.current.get(chatId);
        if (currentBatch) {
          batchesRef.current.set(chatId, { ...currentBatch, isProcessing: false });
        }
      }
    } else {
      console.log(`⚠️ Nenhum callback definido para processar lote ${chatId}`);
      // Se não há callback, limpar o lote imediatamente
      batchesRef.current.delete(chatId);
    }
  }, []);

  const addMessage = useCallback((message: any) => {
    if (!config.enabled) {
      // Se agrupamento está desabilitado, processar imediatamente
      console.log('📨 Agrupamento desabilitado, processando mensagem imediatamente');
      if (callbackRef.current) {
        callbackRef.current(message.from || message.chatId, [message]);
      }
      return;
    }

    const chatId = message.from || message.chatId;
    const messageId = message.id || message.key?.id || `msg_${Date.now()}`;
    const now = Date.now();
    
    // VERIFICAÇÃO ANTI-DUPLICAÇÃO
    if (processedMessagesRef.current.has(messageId)) {
      console.log(`🚫 MENSAGEM duplicada ignorada: ${messageId}`);
      return;
    }
    
    processedMessagesRef.current.add(messageId);
    
    console.log(`📨 Adicionando mensagem ao lote ${chatId}:`, {
      id: messageId,
      content: message.body?.substring(0, 30) || '[mídia]',
      fromMe: message.fromMe,
      timestamp: new Date(message.timestamp || now).toLocaleTimeString()
    });
    
    const existingBatch = batchesRef.current.get(chatId);
    
    if (existingBatch) {
      // Se está processando, decidir o que fazer baseado no tipo de mensagem
      if (existingBatch.isProcessing) {
        if (message.fromMe) {
          console.log(`⚠️ Ignorando nossa mensagem durante processamento do lote ${chatId}`);
          return;
        } else {
          console.log(`🔄 Adicionando mensagem do cliente ao lote em processamento ${chatId}`);
          const updatedMessages = [...existingBatch.messages, message];
          
          batchesRef.current.set(chatId, {
            ...existingBatch,
            messages: updatedMessages,
            lastMessageTime: now
          });
          
          console.log(`📦 Lote em processamento atualizado para ${chatId}: ${updatedMessages.length} mensagens`);
          return;
        }
      }
      
      // Limpar timeout anterior se não estiver processando
      if (existingBatch.timeoutId && !existingBatch.isProcessing) {
        clearTimeout(existingBatch.timeoutId);
        console.log(`⏰ Cancelando timeout anterior para ${chatId}`);
      }
      
      // Adicionar mensagem ao lote existente (não em processamento)
      if (!existingBatch.isProcessing) {
        const updatedMessages = [...existingBatch.messages, message];
        
        // Verificar se atingiu tamanho máximo
        if (updatedMessages.length >= config.maxBatchSize) {
          console.log(`📊 Tamanho máximo atingido (${config.maxBatchSize}), processando imediatamente`);
          batchesRef.current.delete(chatId);
          setTimeout(() => {
            if (callbackRef.current) {
              callbackRef.current(chatId, updatedMessages);
            }
          }, 0);
          return;
        }
        
        // Configurar novo timeout usando a configuração de humanização
        const currentTimeout = humanizedTimeout || config.timeout;
        const timeoutId = setTimeout(() => {
          console.log(`⏰ Timeout de ${currentTimeout}ms atingido para ${chatId} (humanizado: ${!!assistantId}), processando lote`);
          processBatch(chatId);
        }, currentTimeout);
        
        batchesRef.current.set(chatId, {
          ...existingBatch,
          messages: updatedMessages,
          timeoutId,
          lastMessageTime: now,
          isProcessing: false
        });
        
        console.log(`📦 Lote atualizado para ${chatId}: ${updatedMessages.length} mensagens, próximo timeout em ${currentTimeout}ms`);
      }
    } else {
      // Criar novo lote
      const currentTimeout = humanizedTimeout || config.timeout;
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Timeout inicial de ${currentTimeout}ms atingido para ${chatId} (humanizado: ${!!assistantId}), processando lote`);
        processBatch(chatId);
      }, currentTimeout);
      
      batchesRef.current.set(chatId, {
        chatId,
        messages: [message],
        timeoutId,
        lastMessageTime: now,
        isProcessing: false
      });
      
      console.log(`📦 Novo lote criado para ${chatId}: 1 mensagem, timeout em ${currentTimeout}ms`);
    }
  }, [config, processBatch]);

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
    const currentTimeout = humanizedTimeout || config.timeout;
    return {
      exists: !!batch,
      messageCount: batch?.messages.length || 0,
      timeRemaining: batch ? currentTimeout - (Date.now() - batch.lastMessageTime) : 0,
      isProcessing: batch?.isProcessing || false,
      humanizedTimeout: humanizedTimeout,
      assistantId: config.assistantId
    };
  }, [config.timeout, humanizedTimeout, config.assistantId]);

  const markBatchAsCompleted = useCallback((chatId: string) => {
    const batch = batchesRef.current.get(chatId);
    if (batch) {
      console.log(`✅ Marcando lote ${chatId} como concluído`);
      if (batch.timeoutId) {
        clearTimeout(batch.timeoutId);
      }
      batchesRef.current.delete(chatId);
    }
  }, []);

  // Carregar configuração de humanização quando assistantId mudar
  useEffect(() => {
    if (assistantId) {
      loadHumanizationConfig();
    }
  }, [assistantId, loadHumanizationConfig]);

  // Limpeza periódica de mensagens processadas
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (processedMessagesRef.current.size > 1000) {
        console.log('🧹 Limpando cache de mensagens processadas');
        processedMessagesRef.current.clear();
      }
    }, 60000); // A cada minuto

    return () => clearInterval(cleanup);
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
    loadHumanizationConfig,
    humanizedTimeout,
    activeBatches: batchesRef.current.size
  };
};
