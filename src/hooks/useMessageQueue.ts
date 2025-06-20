
import { useState, useEffect, useCallback } from 'react';
import { whatsappService, type MessageData } from '@/services/whatsappMultiClient';
import { useToast } from './use-toast';

export interface QueuedMessage extends MessageData {
  queueId?: string;
  assistantId?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: string;
  response?: string;
}

export interface MessageProcessor {
  processMessage: (message: MessageData) => Promise<string>;
  shouldProcess: (message: MessageData) => boolean;
  priority: 'high' | 'medium' | 'low';
}

export const useMessageQueue = (clientId: string) => {
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processors, setProcessors] = useState<Map<string, MessageProcessor>>(new Map());
  const { toast } = useToast();

  // Adicionar processador de mensagens
  const addProcessor = useCallback((id: string, processor: MessageProcessor) => {
    setProcessors(prev => new Map(prev.set(id, processor)));
  }, []);

  // Remover processador
  const removeProcessor = useCallback((id: string) => {
    setProcessors(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  // Adicionar mensagem à fila
  const enqueueMessage = useCallback((message: MessageData, queueId?: string, assistantId?: string) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      queueId,
      assistantId,
      priority: message.fromMe ? 'low' : 'medium',
      status: 'pending'
    };

    setMessageQueue(prev => {
      const newQueue = [...prev, queuedMessage];
      // Ordenar por prioridade e timestamp
      return newQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.timestamp - b.timestamp;
      });
    });
  }, []);

  // Processar fila de mensagens
  const processQueue = useCallback(async () => {
    if (isProcessing || messageQueue.length === 0) return;

    setIsProcessing(true);

    try {
      const pendingMessages = messageQueue.filter(msg => msg.status === 'pending');
      
      for (const message of pendingMessages) {
        // Marcar como processando
        setMessageQueue(prev =>
          prev.map(msg =>
            msg.id === message.id ? { ...msg, status: 'processing' } : msg
          )
        );

        try {
          // Encontrar processador adequado
          const availableProcessors = Array.from(processors.values());
          const processor = availableProcessors.find(p => p.shouldProcess(message));

          if (processor) {
            const response = await processor.processMessage(message);
            
            // Enviar resposta se houver
            if (response && response.trim()) {
              await whatsappService.sendMessage(clientId, message.from, response);
            }

            // Marcar como completado
            setMessageQueue(prev =>
              prev.map(msg =>
                msg.id === message.id 
                  ? { 
                      ...msg, 
                      status: 'completed',
                      processedAt: new Date().toISOString(),
                      response 
                    } 
                  : msg
              )
            );

            console.log(`✅ Mensagem processada: ${message.id}`);
          } else {
            // Marcar como completado sem processamento
            setMessageQueue(prev =>
              prev.map(msg =>
                msg.id === message.id ? { ...msg, status: 'completed' } : msg
              )
            );
          }
        } catch (error) {
          console.error(`❌ Erro ao processar mensagem ${message.id}:`, error);
          
          // Marcar como falha
          setMessageQueue(prev =>
            prev.map(msg =>
              msg.id === message.id ? { ...msg, status: 'failed' } : msg
            )
          );
        }

        // Pequeno delay entre processamentos
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Erro no processamento da fila:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, messageQueue, processors, clientId]);

  // Limpar mensagens antigas da fila
  const cleanQueue = useCallback(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    setMessageQueue(prev =>
      prev.filter(msg => {
        const messageAge = now - msg.timestamp;
        return messageAge < maxAge && msg.status !== 'completed';
      })
    );
  }, []);

  // Configurar listener para novas mensagens
  useEffect(() => {
    if (!clientId) return;

    const handleNewMessage = (message: MessageData) => {
      // Não processar mensagens próprias por padrão
      if (!message.fromMe) {
        enqueueMessage(message);
      }
    };

    whatsappService.onClientMessage(clientId, handleNewMessage);

    return () => {
      whatsappService.removeListener(`message_${clientId}`, handleNewMessage);
    };
  }, [clientId, enqueueMessage]);

  // Processar fila automaticamente
  useEffect(() => {
    const interval = setInterval(() => {
      processQueue();
      cleanQueue();
    }, 2000); // Processar a cada 2 segundos

    return () => clearInterval(interval);
  }, [processQueue, cleanQueue]);

  // Estatísticas da fila
  const queueStats = {
    total: messageQueue.length,
    pending: messageQueue.filter(msg => msg.status === 'pending').length,
    processing: messageQueue.filter(msg => msg.status === 'processing').length,
    completed: messageQueue.filter(msg => msg.status === 'completed').length,
    failed: messageQueue.filter(msg => msg.status === 'failed').length
  };

  return {
    messageQueue,
    queueStats,
    isProcessing,
    addProcessor,
    removeProcessor,
    enqueueMessage,
    processQueue,
    cleanQueue
  };
};
