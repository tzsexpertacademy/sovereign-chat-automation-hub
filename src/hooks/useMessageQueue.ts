
import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import whatsappService from '@/services/whatsappMultiClient';

export interface QueuedMessage {
  id: string;
  to: string;
  message: string;
  timestamp: number;
  from?: string;
  body?: string;
}

interface UseMessageQueueProps {
  clientId: string;
  batchSize?: number;
  delayBetweenMessages?: number;
  maxRetries?: number;
}

export const useMessageQueue = ({
  clientId,
  batchSize = 5,
  delayBetweenMessages = 1000,
  maxRetries = 3
}: UseMessageQueueProps) => {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<QueuedMessage[]>([]);
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  
  const processingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add message to queue
  const addToQueue = useCallback((to: string, message: string) => {
    const queuedMessage: QueuedMessage = {
      id: uuidv4(),
      from: clientId,
      to,
      message: message,
      body: message,
      timestamp: Date.now()
    };

    setQueue(prev => [...prev, queuedMessage]);
    return queuedMessage.id;
  }, [clientId]);

  // Add multiple messages to queue
  const addBatchToQueue = useCallback((messages: Array<{ to: string; message: string }>) => {
    const queuedMessages: QueuedMessage[] = messages.map(msg => ({
      id: uuidv4(),
      from: clientId,
      to: msg.to,
      message: msg.message,
      body: msg.message,
      timestamp: Date.now()
    }));

    setQueue(prev => [...prev, ...queuedMessages]);
    return queuedMessages.map(msg => msg.id);
  }, [clientId]);

  // Remove message from queue
  const removeFromQueue = useCallback((messageId: string) => {
    setQueue(prev => prev.filter(msg => msg.id !== messageId));
    setCurrentBatch(prev => prev.filter(msg => msg.id !== messageId));
    setRetryCount(prev => {
      const updated = { ...prev };
      delete updated[messageId];
      return updated;
    });
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[messageId];
      return updated;
    });
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentBatch([]);
    setRetryCount({});
    setErrors({});
    setSentMessages([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Send a single message
  const sendMessage = useCallback(async (message: QueuedMessage): Promise<boolean> => {
    try {
      console.log(`📤 Enviando mensagem ${message.id} de ${message.from} para ${message.to}`);
      
      const result = await whatsappService.sendMessage(clientId, message.to, message.message);
      
      if (result && typeof result === 'object' && 'success' in result && result.success) {
        console.log(`✅ Mensagem ${message.id} enviada com sucesso`);
        setSentMessages(prev => [...prev, message.id]);
        return true;
      } else if (result === true) {
        console.log(`✅ Mensagem ${message.id} enviada com sucesso`);
        setSentMessages(prev => [...prev, message.id]);
        return true;
      } else {
        const errorMessage = typeof result === 'object' && 'error' in result ? result.error : 'Falha ao enviar mensagem';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao enviar mensagem ${message.id}:`, error);
      setErrors(prev => ({
        ...prev,
        [message.id]: error.message || 'Erro desconhecido'
      }));
      return false;
    }
  }, [clientId]);

  // Process queue with retry logic
  const processQueue = useCallback(async () => {
    if (processingRef.current || queue.length === 0) {
      return;
    }

    console.log(`🔄 Processando fila de mensagens: ${queue.length} mensagens`);
    processingRef.current = true;
    setIsProcessing(true);

    try {
      while (queue.length > 0) {
        // Get next batch
        const batch = queue.slice(0, batchSize);
        setCurrentBatch(batch);
        
        console.log(`📦 Processando lote de ${batch.length} mensagens`);

        // Send each message in the batch
        for (const message of batch) {
          const currentRetryCount = retryCount[message.id] || 0;
          
          if (currentRetryCount >= maxRetries) {
            console.log(`❌ Mensagem ${message.id} excedeu tentativas máximas`);
            removeFromQueue(message.id);
            continue;
          }

          const success = await sendMessage(message);
          
          if (success) {
            removeFromQueue(message.id);
          } else {
            setRetryCount(prev => ({
              ...prev,
              [message.id]: currentRetryCount + 1
            }));
            
            if (currentRetryCount + 1 >= maxRetries) {
              console.log(`❌ Removendo mensagem ${message.id} após ${maxRetries} tentativas`);
              removeFromQueue(message.id);
            }
          }

          // Delay between messages
          if (delayBetweenMessages > 0) {
            await new Promise(resolve => {
              timeoutRef.current = setTimeout(resolve, delayBetweenMessages);
            });
          }
        }

        setCurrentBatch([]);
      }
    } catch (error) {
      console.error('❌ Erro no processamento da fila:', error);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      setCurrentBatch([]);
    }
  }, [queue, batchSize, delayBetweenMessages, maxRetries, retryCount, sendMessage, removeFromQueue]);

  // Auto-process queue when messages are added
  const startProcessing = useCallback(() => {
    if (!processingRef.current && queue.length > 0) {
      processQueue();
    }
  }, [processQueue, queue.length]);

  // Pause processing
  const pauseProcessing = useCallback(() => {
    processingRef.current = false;
    setIsProcessing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Resume processing
  const resumeProcessing = useCallback(() => {
    if (queue.length > 0) {
      processQueue();
    }
  }, [processQueue, queue.length]);

  // Get queue statistics
  const getQueueStats = useCallback(() => {
    const totalMessages = queue.length;
    const processingMessages = currentBatch.length;
    const errorMessages = Object.keys(errors).length;
    const sentCount = sentMessages.length;
    const retryMessages = Object.keys(retryCount).filter(id => queue.some(msg => msg.id === id)).length;

    return {
      total: totalMessages,
      processing: processingMessages,
      errors: errorMessages,
      sent: sentCount,
      retrying: retryMessages,
      pending: totalMessages - processingMessages
    };
  }, [queue.length, currentBatch.length, errors, sentMessages.length, retryCount, queue]);

  return {
    // State
    queue,
    isProcessing,
    currentBatch,
    errors,
    sentMessages,
    retryCount,
    
    // Actions
    addToQueue,
    addBatchToQueue,
    removeFromQueue,
    clearQueue,
    startProcessing,
    pauseProcessing,
    resumeProcessing,
    processQueue,
    
    // Stats
    getQueueStats
  };
};
