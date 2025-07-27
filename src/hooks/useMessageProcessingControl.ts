import { useState, useCallback, useRef } from 'react';

interface ProcessingControl {
  isProcessing: boolean;
  lastProcessedMessage: string | null;
  pendingProcessing: Set<string>;
}

interface MessageProcessingConfig {
  debounceDelay: number; // Delay para debounce (ms)
  duplicateWindow: number; // Janela para detectar duplicatas (ms)
  maxConcurrentProcessing: number; // Máximo de processamentos simultâneos
}

const defaultConfig: MessageProcessingConfig = {
  debounceDelay: 1000, // 1 segundo
  duplicateWindow: 5000, // 5 segundos
  maxConcurrentProcessing: 3
};

export const useMessageProcessingControl = (config: Partial<MessageProcessingConfig> = {}) => {
  const finalConfig = { ...defaultConfig, ...config };
  
  const [control, setControl] = useState<ProcessingControl>({
    isProcessing: false,
    lastProcessedMessage: null,
    pendingProcessing: new Set()
  });

  // Cache de mensagens processadas com timestamp
  const processedMessages = useRef<Map<string, number>>(new Map());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Gerar chave única para mensagem
  const generateMessageKey = useCallback((messageContent: string, chatId: string): string => {
    const contentHash = messageContent.slice(0, 50); // Primeiros 50 caracteres
    return `${chatId}_${contentHash}`;
  }, []);

  // Verificar se mensagem é duplicata
  const isDuplicate = useCallback((messageKey: string): boolean => {
    const now = Date.now();
    const lastProcessed = processedMessages.current.get(messageKey);
    
    if (lastProcessed && (now - lastProcessed) < finalConfig.duplicateWindow) {
      console.log('🔍 [PROCESSING-CONTROL] Mensagem duplicada detectada:', messageKey);
      return true;
    }
    
    return false;
  }, [finalConfig.duplicateWindow]);

  // Verificar se pode processar (limite de concorrência)
  const canProcess = useCallback((): boolean => {
    return control.pendingProcessing.size < finalConfig.maxConcurrentProcessing;
  }, [control.pendingProcessing.size, finalConfig.maxConcurrentProcessing]);

  // Marcar mensagem como processada
  const markAsProcessed = useCallback((messageKey: string) => {
    const now = Date.now();
    processedMessages.current.set(messageKey, now);
    
    setControl(prev => {
      const newPending = new Set(prev.pendingProcessing);
      newPending.delete(messageKey);
      
      return {
        ...prev,
        lastProcessedMessage: messageKey,
        pendingProcessing: newPending,
        isProcessing: newPending.size > 0
      };
    });
    
    console.log('✅ [PROCESSING-CONTROL] Mensagem marcada como processada:', messageKey);
  }, []);

  // Adicionar mensagem para processamento
  const addToProcessing = useCallback((messageKey: string) => {
    setControl(prev => {
      const newPending = new Set(prev.pendingProcessing);
      newPending.add(messageKey);
      
      return {
        ...prev,
        pendingProcessing: newPending,
        isProcessing: true
      };
    });
    
    console.log('📝 [PROCESSING-CONTROL] Mensagem adicionada ao processamento:', messageKey);
  }, []);

  // Processar mensagem com debounce e controle de duplicação
  const processMessage = useCallback(async (
    messageContent: string,
    chatId: string,
    processingFunction: () => Promise<any>
  ): Promise<{ processed: boolean; reason?: string }> => {
    const messageKey = generateMessageKey(messageContent, chatId);
    
    // Verificar duplicação
    if (isDuplicate(messageKey)) {
      return { 
        processed: false, 
        reason: 'duplicate' 
      };
    }
    
    // Verificar limite de concorrência
    if (!canProcess()) {
      console.warn('⚠️ [PROCESSING-CONTROL] Limite de concorrência atingido');
      return { 
        processed: false, 
        reason: 'rate_limit' 
      };
    }
    
    // Limpar timer anterior se existir
    const existingTimer = debounceTimers.current.get(messageKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Criar novo timer de debounce
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        try {
          // Adicionar ao processamento
          addToProcessing(messageKey);
          
          console.log('🚀 [PROCESSING-CONTROL] Iniciando processamento:', messageKey);
          
          // Executar função de processamento
          await processingFunction();
          
          // Marcar como processada
          markAsProcessed(messageKey);
          
          // Limpar timer
          debounceTimers.current.delete(messageKey);
          
          resolve({ processed: true });
          
        } catch (error) {
          console.error('❌ [PROCESSING-CONTROL] Erro no processamento:', error);
          
          // Remover do processamento em caso de erro
          setControl(prev => {
            const newPending = new Set(prev.pendingProcessing);
            newPending.delete(messageKey);
            
            return {
              ...prev,
              pendingProcessing: newPending,
              isProcessing: newPending.size > 0
            };
          });
          
          // Limpar timer
          debounceTimers.current.delete(messageKey);
          
          resolve({ 
            processed: false, 
            reason: 'error' 
          });
        }
      }, finalConfig.debounceDelay);
      
      debounceTimers.current.set(messageKey, timer);
    });
  }, [
    generateMessageKey, 
    isDuplicate, 
    canProcess, 
    addToProcessing, 
    markAsProcessed, 
    finalConfig.debounceDelay
  ]);

  // Limpar cache de mensagens antigas
  const cleanupOldMessages = useCallback(() => {
    const now = Date.now();
    const maxAge = finalConfig.duplicateWindow * 2; // Manter por 2x a janela de duplicação
    
    let cleaned = 0;
    for (const [key, timestamp] of processedMessages.current.entries()) {
      if (now - timestamp > maxAge) {
        processedMessages.current.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 [PROCESSING-CONTROL] Limpeza automática: ${cleaned} mensagens removidas do cache`);
    }
  }, [finalConfig.duplicateWindow]);

  // Forçar limpeza de processamento (em caso de erro)
  const forceCleanup = useCallback(() => {
    console.log('🧹 [PROCESSING-CONTROL] Limpeza forçada do controle de processamento');
    
    // Limpar todos os timers
    for (const timer of debounceTimers.current.values()) {
      clearTimeout(timer);
    }
    debounceTimers.current.clear();
    
    // Resetar estado
    setControl({
      isProcessing: false,
      lastProcessedMessage: null,
      pendingProcessing: new Set()
    });
  }, []);

  // Obter estatísticas do controle
  const getStats = useCallback(() => {
    return {
      pendingCount: control.pendingProcessing.size,
      isProcessing: control.isProcessing,
      lastProcessed: control.lastProcessedMessage,
      cachedMessages: processedMessages.current.size,
      activeTimers: debounceTimers.current.size,
      config: finalConfig
    };
  }, [control, finalConfig]);

  return {
    control,
    processMessage,
    markAsProcessed,
    cleanupOldMessages,
    forceCleanup,
    getStats,
    isDuplicate: (content: string, chatId: string) => isDuplicate(generateMessageKey(content, chatId)),
    canProcess
  };
};