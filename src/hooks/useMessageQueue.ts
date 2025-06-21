
import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageData } from '@/services/whatsappMultiClient';
import { whatsappService } from '@/services/whatsappMultiClient';

interface QueuedMessage extends MessageData {
  attempts: number;
  maxAttempts: number;
  nextRetry?: number;
}

interface MessageProcessor {
  id: string;
  name: string;
  isActive: boolean;
  processMessage: (message: MessageData, sendResponse: (to: string, message: string) => Promise<void>) => Promise<boolean>;
}

interface QueueStats {
  pending: number;
  total: number;
}

export const useMessageQueue = (clientId: string) => {
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [processors, setProcessors] = useState<MessageProcessor[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, total: 0 });
  
  const processingRef = useRef(false);
  const queueIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Estatísticas da fila
  useEffect(() => {
    const pending = messageQueue.filter(msg => 
      !msg.nextRetry || msg.nextRetry <= Date.now()
    ).length;
    
    setQueueStats({
      pending,
      total: messageQueue.length
    });
  }, [messageQueue]);

  // Adicionar mensagem à fila
  const enqueueMessage = useCallback((message: MessageData) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      attempts: 0,
      maxAttempts: 3
    };

    setMessageQueue(prev => [...prev, queuedMessage]);
    console.log('📥 Mensagem adicionada à fila:', message.id);
  }, []);

  // Processar fila
  const processQueue = useCallback(async () => {
    if (processingRef.current || messageQueue.length === 0) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const now = Date.now();
      const readyMessages = messageQueue.filter(msg => 
        !msg.nextRetry || msg.nextRetry <= now
      );

      if (readyMessages.length === 0) {
        return;
      }

      const message = readyMessages[0];
      console.log('🔄 Processando mensagem:', message.id);

      // Tentar processar com cada processador ativo
      let processed = false;
      for (const processor of processors) {
        if (!processor.isActive) continue;

        try {
          const sendResponse = async (to: string, responseMessage: string) => {
            await whatsappService.sendMessage(clientId, to, responseMessage);
          };

          const result = await processor.processMessage(message, sendResponse);
          if (result) {
            processed = true;
            console.log(`✅ Mensagem processada por ${processor.name}`);
            break;
          }
        } catch (error) {
          console.error(`❌ Erro no processador ${processor.name}:`, error);
        }
      }

      // Atualizar fila
      setMessageQueue(prev => {
        const updated = [...prev];
        const index = updated.findIndex(m => m.id === message.id);
        
        if (index === -1) return updated;

        if (processed) {
          // Remover mensagem processada
          updated.splice(index, 1);
        } else {
          // Incrementar tentativas e reagendar
          const attempts = updated[index].attempts + 1;
          if (attempts >= updated[index].maxAttempts) {
            // Remover após máximo de tentativas
            updated.splice(index, 1);
            console.log('❌ Mensagem removida após máximo de tentativas:', message.id);
          } else {
            // Reagendar para nova tentativa
            updated[index] = {
              ...updated[index],
              attempts,
              nextRetry: now + (attempts * 5000) // Delay exponencial
            };
            console.log(`🔄 Mensagem reagendada (tentativa ${attempts}):`, message.id);
          }
        }

        return updated;
      });

    } catch (error) {
      console.error('❌ Erro ao processar fila:', error);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [messageQueue, processors, clientId]);

  // Iniciar processamento automático
  useEffect(() => {
    if (queueIntervalRef.current) {
      clearInterval(queueIntervalRef.current);
    }

    queueIntervalRef.current = setInterval(processQueue, 2000);

    return () => {
      if (queueIntervalRef.current) {
        clearInterval(queueIntervalRef.current);
      }
    };
  }, [processQueue]);

  // Adicionar processador
  const addProcessor = useCallback((processor: MessageProcessor) => {
    setProcessors(prev => {
      const exists = prev.find(p => p.id === processor.id);
      if (exists) {
        return prev.map(p => p.id === processor.id ? processor : p);
      }
      return [...prev, processor];
    });
    console.log('🤖 Processador adicionado:', processor.name);
  }, []);

  // Remover processador
  const removeProcessor = useCallback((processorId: string) => {
    setProcessors(prev => prev.filter(p => p.id !== processorId));
    console.log('🗑️ Processador removido:', processorId);
  }, []);

  // Ativar/desativar processador
  const toggleProcessor = useCallback((processorId: string) => {
    setProcessors(prev => prev.map(p => 
      p.id === processorId ? { ...p, isActive: !p.isActive } : p
    ));
  }, []);

  // Limpar fila
  const clearQueue = useCallback(() => {
    setMessageQueue([]);
    console.log('🧹 Fila de mensagens limpa');
  }, []);

  // Pausar/retomar processamento
  const pauseProcessing = useCallback(() => {
    if (queueIntervalRef.current) {
      clearInterval(queueIntervalRef.current);
      queueIntervalRef.current = null;
    }
  }, []);

  const resumeProcessing = useCallback(() => {
    if (!queueIntervalRef.current) {
      queueIntervalRef.current = setInterval(processQueue, 2000);
    }
  }, [processQueue]);

  return {
    messageQueue,
    processors,
    queueStats,
    isProcessing,
    enqueueMessage,
    addProcessor,
    removeProcessor,
    toggleProcessor,
    clearQueue,
    pauseProcessing,
    resumeProcessing,
    processQueue
  };
};
