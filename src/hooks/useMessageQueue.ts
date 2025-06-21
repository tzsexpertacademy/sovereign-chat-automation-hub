import { useState, useEffect, useCallback } from 'react';
import { whatsappService, type MessageData } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { useToast } from './use-toast';

export interface QueuedMessage extends MessageData {
  queueId?: string;
  assistantId?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'human';
  processedAt?: string;
  response?: string;
  isHumanHandled?: boolean;
}

export interface MessageProcessor {
  processMessage: (message: MessageData) => Promise<string>;
  shouldProcess: (message: MessageData) => boolean;
  priority: 'high' | 'medium' | 'low';
}

export const useMessageQueue = (clientId: string, instanceId?: string) => {
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processors, setProcessors] = useState<Map<string, MessageProcessor>>(new Map());
  const [instanceQueueConnection, setInstanceQueueConnection] = useState<any>(null);
  const { toast } = useToast();

  // Load instance queue connection
  useEffect(() => {
    if (instanceId) {
      loadInstanceConnection();
    }
  }, [instanceId]);

  const loadInstanceConnection = async () => {
    if (!instanceId) return;
    
    try {
      const connections = await queuesService.getInstanceConnections(instanceId);
      setInstanceQueueConnection(connections[0] || null);
    } catch (error) {
      console.error('Erro ao carregar conexão da instância:', error);
    }
  };

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
    // Determinar se deve ser processada automaticamente ou manualmente
    const isHumanHandled = !instanceQueueConnection;
    
    const queuedMessage: QueuedMessage = {
      ...message,
      queueId: queueId || instanceQueueConnection?.id,
      assistantId: assistantId || instanceQueueConnection?.assistants?.id,
      priority: message.fromMe ? 'low' : 'medium',
      status: isHumanHandled ? 'human' : 'pending',
      isHumanHandled
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

    // Log da mensagem recebida
    console.log(`📥 Nova mensagem ${isHumanHandled ? 'para interação humana' : 'para processamento automático'}:`, {
      from: message.from,
      type: message.type,
      preview: message.body?.substring(0, 50),
      queueId: queuedMessage.queueId,
      assistantId: queuedMessage.assistantId
    });
  }, [instanceQueueConnection]);

  // Processar fila de mensagens automaticamente
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
          // Se tem assistente configurado, processar com IA
          if (message.assistantId && instanceQueueConnection?.assistants) {
            const response = await processWithAssistant(message, instanceQueueConnection.assistants);
            
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

            console.log(`✅ Mensagem processada pelo assistente: ${message.id}`);
          } else {
            // Sem assistente, tentar processadores manuais
            const availableProcessors = Array.from(processors.values());
            const processor = availableProcessors.find(p => p.shouldProcess(message));

            if (processor) {
              const response = await processor.processMessage(message);
              
              if (response && response.trim()) {
                await whatsappService.sendMessage(clientId, message.from, response);
              }

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

              console.log(`✅ Mensagem processada por processador: ${message.id}`);
            } else {
              // Marcar para interação humana
              setMessageQueue(prev =>
                prev.map(msg =>
                  msg.id === message.id ? { ...msg, status: 'human' } : msg
                )
              );
            }
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
  }, [isProcessing, messageQueue, processors, clientId, instanceQueueConnection]);

  // Processar mensagem com assistente IA
  const processWithAssistant = async (message: MessageData, assistant: any): Promise<string> => {
    try {
      // Aqui você pode integrar com seu serviço de IA
      // Por ora, vou simular uma resposta automática
      
      if (message.body?.toLowerCase().includes('olá') || message.body?.toLowerCase().includes('oi')) {
        return `Olá! Sou o assistente ${assistant.name}. Como posso ajudá-lo hoje?`;
      }
      
      if (message.body?.toLowerCase().includes('horário')) {
        return 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.';
      }
      
      if (message.body?.toLowerCase().includes('obrigad')) {
        return 'De nada! Fico feliz em ajudar. Se precisar de mais alguma coisa, é só falar!';
      }
      
      // Resposta padrão do assistente
      return assistant.default_response || 'Obrigado pela sua mensagem. Em breve retornaremos o contato.';
      
    } catch (error) {
      console.error('Erro ao processar com assistente:', error);
      return 'Desculpe, houve um erro ao processar sua mensagem. Um atendente entrará em contato em breve.';
    }
  };

  // Marcar mensagem como tratada humanamente
  const markAsHumanHandled = useCallback((messageId: string) => {
    setMessageQueue(prev =>
      prev.map(msg =>
        msg.id === messageId 
          ? { 
              ...msg, 
              status: 'completed',
              processedAt: new Date().toISOString(),
              isHumanHandled: true
            } 
          : msg
      )
    );
  }, []);

  // Limpar mensagens antigas da fila
  const cleanQueue = useCallback(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    setMessageQueue(prev =>
      prev.filter(msg => {
        const messageAge = now - msg.timestamp;
        return messageAge < maxAge && !['completed', 'failed'].includes(msg.status);
      })
    );
  }, []);

  // Configurar listener para novas mensagens
  useEffect(() => {
    if (!clientId || !instanceId) return;

    const handleNewMessage = (message: MessageData) => {
      // Não processar mensagens próprias por padrão
      if (!message.fromMe) {
        enqueueMessage(message);
      }
    };

    whatsappService.onClientMessage(instanceId, handleNewMessage);

    return () => {
      whatsappService.removeListener(`message_${instanceId}`);
    };
  }, [clientId, instanceId, enqueueMessage]);

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
    failed: messageQueue.filter(msg => msg.status === 'failed').length,
    human: messageQueue.filter(msg => msg.status === 'human').length,
    automated: messageQueue.filter(msg => msg.status === 'completed' && !msg.isHumanHandled).length,
    humanHandled: messageQueue.filter(msg => msg.status === 'completed' && msg.isHumanHandled).length
  };

  return {
    messageQueue,
    queueStats,
    isProcessing,
    instanceQueueConnection,
    addProcessor,
    removeProcessor,
    enqueueMessage,
    processQueue,
    cleanQueue,
    markAsHumanHandled,
    loadInstanceConnection
  };
};
