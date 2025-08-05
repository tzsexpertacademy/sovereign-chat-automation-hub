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
  timeout: 3000, // 3 segundos para sincronizar com backend
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
      
      // Usar timeout padrão de 3 segundos (sincronizado com backend)
      const defaultTimeout = 3000;
      
      setConfig(prev => ({
        ...prev,
        timeout: defaultTimeout
      }));
      
      console.log('✅ [MESSAGE-BATCH] Timeout padrão aplicado:', defaultTimeout);
      
    } catch (error) {
      console.error('❌ [MESSAGE-BATCH] Erro ao aplicar config padrão:', error);
    }
  }, []);

  // Detectar comandos que referenciam mídia futura
  const detectsFutureMedia = useCallback((content: string): boolean => {
    if (!content) return false;
    
    const futureMediaPatterns = [
      /vou.*enviar.*imagem/i,
      /vou.*mandar.*imagem/i,
      /analise.*imagem.*que.*vou/i,
      /olha.*imagem.*que.*vou/i,
      /vê.*imagem.*que.*vou/i,
      /mando.*imagem/i,
      /envio.*imagem/i,
      /te.*mando/i,
      /te.*envio/i,
      /próxima.*imagem/i,
      /agora.*imagem/i,
      /depois.*imagem/i
    ];
    
    return futureMediaPatterns.some(pattern => pattern.test(content));
  }, []);

  // Adicionar mensagem ao batch
  const addMessage = useCallback((message: any) => {
    if (!config.enabled) {
      callback(message.chatId || message.from, [message]);
      return;
    }

    const chatId = message.chatId || message.from;
    const batches = batchesRef.current;
    
    // Detectar se é mensagem de áudio
    const isAudioMessage = message.messageType === 'audio' || 
                          message.type === 'audio' || 
                          (message.media_url && message.media_key);
    
    // Detectar se mensagem referencia mídia futura
    const messageContent = message.body || message.content || '';
    const hasFutureMediaCommand = detectsFutureMedia(messageContent);
    
    // 🧠 TIMING INTELIGENTE UNIFICADO
    let messageTimeout = config.timeout;
    
    // Detectar se é mensagem de imagem
    const isImageMessage = message.messageType === 'image' || 
                          message.type === 'image' || 
                          (message.content && message.content.includes('📷 Imagem'));
    
    // Verificar se há mistura de tipos no batch atual
    const currentBatch = batchesRef.current.get(chatId);
    const hasMixedContent = currentBatch && currentBatch.messages.length > 0 && 
      currentBatch.messages.some(msg => 
        (msg.messageType === 'audio' || msg.type === 'audio') !== isAudioMessage ||
        (msg.messageType === 'image' || msg.type === 'image') !== isImageMessage
      );
    
    // APLICAR TIMING BASEADO NO TIPO DE CONTEÚDO (SINCRONIZADO COM BACKEND)
    if (hasMixedContent || (isAudioMessage && isImageMessage)) {
      messageTimeout = 10000; // 10s para conteúdo misto
      console.log(`🔄 [MESSAGE-BATCH] Conteúdo misto detectado, timeout: ${messageTimeout}ms`);
    } else if (isAudioMessage || isImageMessage) {
      messageTimeout = 8000; // 8s para mídia única
      console.log(`🎵🖼️ [MESSAGE-BATCH] Mídia detectada (${isAudioMessage ? 'áudio' : 'imagem'}), timeout: ${messageTimeout}ms`);
    } else if (hasFutureMediaCommand) {
      messageTimeout = 10000; // 10s quando detecta comando de mídia futura  
      console.log(`🎯 [MESSAGE-BATCH] Comando de mídia futura detectado, timeout: ${messageTimeout}ms`);
    } else {
      messageTimeout = 3000; // 3s para texto simples
      console.log(`📝 [MESSAGE-BATCH] Texto simples, timeout: ${messageTimeout}ms`);
    }
    
    console.log(`📦 [MESSAGE-BATCH] Adicionando mensagem ao batch: ${chatId}`, {
      tipo: isAudioMessage ? 'áudio' : (hasFutureMediaCommand ? 'comando-mídia-futura' : 'texto'),
      timeout: messageTimeout,
      conteudo: messageContent.substring(0, 50) + '...'
    });
    
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
    
    // Verificar se há mensagens recentes que podem estar relacionadas
    const timeSinceLastMessage = Date.now() - batch.lastMessageTime;
    const isQuickSequence = timeSinceLastMessage < 30000; // 30 segundos
    
    // Se há uma sequência rápida e contexto relacionado, usar timeout estendido
    if (isQuickSequence && batch.messages.length > 0) {
      const hasContextualConnection = batch.messages.some(msg => {
        const prevContent = msg.body || msg.content || '';
        return detectsFutureMedia(prevContent) || hasFutureMediaCommand;
      });
      
      if (hasContextualConnection && messageTimeout < 15000) {
        messageTimeout = 15000;
        console.log(`🔗 [MESSAGE-BATCH] Contexto relacionado detectado, timeout estendido para: ${messageTimeout}ms`);
      }
    }
    
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
      }, messageTimeout);
      
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

    // Configurar novo timeout (usar timeout específico para áudio)
    batch.timeoutId = setTimeout(() => {
      processBatch(chatId);
    }, messageTimeout);

  }, [config, callback, detectsFutureMedia]);

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