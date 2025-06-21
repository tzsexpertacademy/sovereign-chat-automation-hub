
import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageData } from '@/services/whatsappMultiClient';

interface QueueStats {
  pending: number;
  total: number;
}

interface MessageProcessor {
  id: string;
  process: (message: MessageData) => Promise<void>;
}

export const useMessageQueue = (clientId: string) => {
  const [messageQueue, setMessageQueue] = useState<MessageData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, total: 0 });
  
  const processorsRef = useRef<MessageProcessor[]>([]);
  const processingRef = useRef(false);

  const addProcessor = useCallback((processor: MessageProcessor) => {
    processorsRef.current.push(processor);
    console.log(`✅ Processor adicionado: ${processor.id}`);
  }, []);

  const removeProcessor = useCallback((processorId: string) => {
    processorsRef.current = processorsRef.current.filter(p => p.id !== processorId);
    console.log(`❌ Processor removido: ${processorId}`);
  }, []);

  const enqueueMessage = useCallback((message: MessageData) => {
    if (!message.fromMe) {
      setMessageQueue(prev => {
        const newQueue = [...prev, message];
        setQueueStats({ pending: newQueue.length, total: newQueue.length });
        return newQueue;
      });
      console.log(`📨 Mensagem adicionada à fila: ${message.id}`);
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || messageQueue.length === 0) return;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const message = messageQueue[0];
      console.log(`🔄 Processando mensagem: ${message.id}`);

      // Processar com todos os processors
      for (const processor of processorsRef.current) {
        try {
          await processor.process(message);
        } catch (error) {
          console.error(`❌ Erro no processor ${processor.id}:`, error);
        }
      }

      // Remover da fila
      setMessageQueue(prev => {
        const newQueue = prev.slice(1);
        setQueueStats({ pending: newQueue.length, total: prev.length });
        return newQueue;
      });

      console.log(`✅ Mensagem processada: ${message.id}`);
    } catch (error) {
      console.error('❌ Erro ao processar fila:', error);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [messageQueue]);

  // Processar fila automaticamente
  useEffect(() => {
    if (!processingRef.current && messageQueue.length > 0) {
      const timer = setTimeout(processQueue, 1000);
      return () => clearTimeout(timer);
    }
  }, [messageQueue, processQueue]);

  return {
    messageQueue,
    queueStats,
    isProcessing,
    addProcessor,
    removeProcessor,
    enqueueMessage
  };
};
