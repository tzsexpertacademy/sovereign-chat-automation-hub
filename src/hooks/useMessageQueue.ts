
import { useState, useCallback, useRef } from 'react';
import { MessageData } from '@/services/whatsappMultiClient';

interface QueuedMessage extends Omit<MessageData, 'status'> {
  queueId: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  queueStatus: 'pending' | 'processing' | 'completed' | 'failed';
  addedAt: number;
  processingStartedAt?: number;
  completedAt?: number;
  error?: string;
}

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface MessageProcessor {
  id: string;
  handler: (message: MessageData) => Promise<void>;
  filter?: (message: MessageData) => boolean;
}

interface UseMessageQueueProps {
  maxConcurrent?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export const useMessageQueue = (clientId: string, options: UseMessageQueueProps = {}) => {
  const {
    maxConcurrent = 3,
    retryDelay = 5000,
    maxRetries = 3
  } = options;

  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processors] = useState<MessageProcessor[]>([]);
  const processingRef = useRef<Set<string>>(new Set());
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const stats: QueueStats = {
    total: messageQueue.length,
    pending: messageQueue.filter(m => m.queueStatus === 'pending').length,
    processing: messageQueue.filter(m => m.queueStatus === 'processing').length,
    completed: messageQueue.filter(m => m.queueStatus === 'completed').length,
    failed: messageQueue.filter(m => m.queueStatus === 'failed').length
  };

  const enqueueMessage = useCallback((message: MessageData, priority = 1) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      queueId: `${message.id}_${Date.now()}`,
      priority,
      retryCount: 0,
      maxRetries,
      queueStatus: 'pending',
      addedAt: Date.now()
    };

    console.log('📥 Adicionando mensagem à fila:', queuedMessage.queueId);
    
    setMessageQueue(prev => {
      const updated = [...prev, queuedMessage];
      // Ordenar por prioridade (maior prioridade primeiro)
      return updated.sort((a, b) => b.priority - a.priority);
    });

    // Iniciar processamento se não estiver rodando
    setTimeout(() => processQueue(), 100);
  }, [maxRetries]);

  const processQueue = useCallback(async () => {
    if (processingRef.current.size >= maxConcurrent) {
      return;
    }

    const pendingMessages = messageQueue.filter(
      m => m.queueStatus === 'pending' && !processingRef.current.has(m.queueId)
    );

    if (pendingMessages.length === 0) {
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);

    // Processar mensagens até o limite de concorrência
    const toProcess = pendingMessages.slice(0, maxConcurrent - processingRef.current.size);
    
    for (const message of toProcess) {
      processMessage(message);
    }
  }, [messageQueue, maxConcurrent]);

  const processMessage = async (message: QueuedMessage) => {
    const messageId = message.queueId;
    
    try {
      console.log('🔄 Processando mensagem:', messageId);
      
      // Marcar como processando
      processingRef.current.add(messageId);
      updateMessageStatus(messageId, 'processing', { processingStartedAt: Date.now() });

      // Encontrar processadores aplicáveis
      const applicableProcessors = processors.filter(
        p => !p.filter || p.filter(message)
      );

      if (applicableProcessors.length === 0) {
        console.log('⚠️ Nenhum processador encontrado para mensagem:', messageId);
        updateMessageStatus(messageId, 'completed', { completedAt: Date.now() });
        return;
      }

      // Executar processadores
      for (const processor of applicableProcessors) {
        await processor.handler(message);
      }

      console.log('✅ Mensagem processada com sucesso:', messageId);
      updateMessageStatus(messageId, 'completed', { completedAt: Date.now() });

    } catch (error: any) {
      console.error('❌ Erro ao processar mensagem:', messageId, error);
      
      const newRetryCount = message.retryCount + 1;
      
      if (newRetryCount <= message.maxRetries) {
        console.log(`🔄 Reagendando tentativa ${newRetryCount}/${message.maxRetries} para:`, messageId);
        
        // Reagendar para retry
        const retryTimeout = setTimeout(() => {
          updateMessageStatus(messageId, 'pending', { 
            retryCount: newRetryCount,
            error: error.message 
          });
          retryTimeoutsRef.current.delete(messageId);
          processQueue();
        }, retryDelay);
        
        retryTimeoutsRef.current.set(messageId, retryTimeout);
      } else {
        console.log('❌ Máximo de tentativas excedido para:', messageId);
        updateMessageStatus(messageId, 'failed', { 
          completedAt: Date.now(),
          error: error.message 
        });
      }
    } finally {
      processingRef.current.delete(messageId);
      
      // Continuar processando próximas mensagens
      setTimeout(() => processQueue(), 500);
    }
  };

  const updateMessageStatus = (
    messageId: string, 
    status: QueuedMessage['queueStatus'], 
    updates: Partial<QueuedMessage> = {}
  ) => {
    setMessageQueue(prev => 
      prev.map(msg => 
        msg.queueId === messageId 
          ? { ...msg, queueStatus: status, ...updates }
          : msg
      )
    );
  };

  const addProcessor = useCallback((processor: MessageProcessor) => {
    processors.push(processor);
    console.log('🔧 Processador adicionado:', processor.id);
  }, [processors]);

  const removeProcessor = useCallback((processorId: string) => {
    const index = processors.findIndex(p => p.id === processorId);
    if (index >= 0) {
      processors.splice(index, 1);
      console.log('🗑️ Processador removido:', processorId);
    }
  }, [processors]);

  const clearQueue = useCallback(() => {
    console.log('🧹 Limpando fila de mensagens');
    
    // Cancelar todos os timeouts de retry
    retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();
    
    // Limpar referencias de processamento
    processingRef.current.clear();
    
    // Limpar fila
    setMessageQueue([]);
    setIsProcessing(false);
  }, []);

  const retryFailedMessages = useCallback(() => {
    console.log('🔄 Reprocessando mensagens falhadas');
    
    setMessageQueue(prev => 
      prev.map(msg => 
        msg.queueStatus === 'failed'
          ? { ...msg, queueStatus: 'pending', retryCount: 0, error: undefined }
          : msg
      )
    );
    
    setTimeout(() => processQueue(), 100);
  }, []);

  const getQueuedMessages = useCallback((status?: QueuedMessage['queueStatus']) => {
    if (status) {
      return messageQueue.filter(m => m.queueStatus === status);
    }
    return messageQueue;
  }, [messageQueue]);

  // Limpar timeouts quando o component desmonta
  const cleanup = useCallback(() => {
    retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();
    processingRef.current.clear();
  }, []);

  return {
    messageQueue,
    queueStats: stats,
    isProcessing,
    enqueueMessage,
    addProcessor,
    removeProcessor,
    clearQueue,
    retryFailedMessages,
    getQueuedMessages,
    cleanup
  };
};
