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
      console.log(`🔗 Carregando conexão da fila para instância: ${instanceId}`);
      const connections = await queuesService.getInstanceConnections(instanceId);
      const connection = connections[0] || null;
      setInstanceQueueConnection(connection);
      
      if (connection) {
        console.log(`✅ Conexão encontrada - Fila: ${connection.name}, Assistente: ${connection.assistants?.name}`);
      } else {
        console.log(`⚠️ Nenhuma conexão de fila encontrada para instância: ${instanceId}`);
      }
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
    console.log(`📥 Adicionando mensagem à fila:`, {
      from: message.from,
      body: message.body?.substring(0, 50),
      hasConnection: !!instanceQueueConnection,
      assistantId: assistantId || instanceQueueConnection?.assistants?.id
    });

    // Determinar se deve ser processada automaticamente ou manualmente
    const hasAssistant = !!(assistantId || instanceQueueConnection?.assistants?.id);
    const isHumanHandled = !hasAssistant;
    
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
    console.log(`📝 Mensagem ${isHumanHandled ? 'para interação humana' : 'para processamento automático'}:`, {
      from: message.from,
      type: message.type,
      preview: message.body?.substring(0, 50),
      queueId: queuedMessage.queueId,
      assistantId: queuedMessage.assistantId
    });
  }, [instanceQueueConnection]);

  // Processar mensagem com assistente IA
  const processWithAssistant = async (message: MessageData, assistant: any): Promise<string> => {
    try {
      console.log(`🤖 Processando mensagem com assistente: ${assistant.name}`);
      console.log(`📨 Mensagem: ${message.body?.substring(0, 100)}`);
      
      // Usar o Supabase URL correto para edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Configuração do Supabase não encontrada');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          messageText: message.body,
          assistantId: assistant.id,
          chatId: message.from,
          instanceId: instanceId,
          messageId: message.id
        })
      });

      console.log(`📡 Resposta da edge function: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro da edge function:', errorText);
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        console.error('❌ Erro retornado pela edge function:', result.error);
        throw new Error(result.error);
      }

      console.log(`✅ Resposta do assistente recebida: ${result.response?.substring(0, 100)}`);
      return result.response || 'Desculpe, não consegui processar sua mensagem no momento.';
      
    } catch (error) {
      console.error('❌ Erro ao processar com assistente:', error);
      return 'Desculpe, houve um erro ao processar sua mensagem. Um atendente entrará em contato em breve.';
    }
  };

  // Processar fila de mensagens
  const processQueue = useCallback(async () => {
    if (isProcessing || messageQueue.length === 0) return;

    const pendingMessages = messageQueue.filter(msg => msg.status === 'pending');
    if (pendingMessages.length === 0) return;

    setIsProcessing(true);

    try {
      console.log(`🔄 Processando ${pendingMessages.length} mensagens pendentes`);
      
      // Processar mensagens uma por uma para evitar sobrecarga
      for (const message of pendingMessages) {
        // Marcar como processando
        setMessageQueue(prev =>
          prev.map(msg =>
            msg.id === message.id ? { ...msg, status: 'processing' } : msg
          )
        );

        try {
          console.log(`🎯 Processando mensagem: ${message.id}`);
          
          // Se tem assistente configurado, processar com IA
          if (message.assistantId && instanceQueueConnection?.assistants) {
            const response = await processWithAssistant(message, instanceQueueConnection.assistants);
            
            if (response && response.trim()) {
              console.log(`📤 Enviando resposta via WhatsApp: ${response.substring(0, 50)}...`);
              
              // Tentar enviar com retry
              let sendSuccess = false;
              let sendAttempts = 0;
              const maxSendAttempts = 3;
              
              while (!sendSuccess && sendAttempts < maxSendAttempts) {
                try {
                  sendAttempts++;
                  console.log(`📤 Tentativa ${sendAttempts}/${maxSendAttempts} de envio`);
                  
                  const sendResult = await whatsappService.sendMessage(
                    instanceId!,
                    message.from,
                    response
                  );
                  
                  if (sendResult.success) {
                    sendSuccess = true;
                    console.log(`✅ Mensagem enviada com sucesso`);
                  } else {
                    console.error(`❌ Falha no envio (tentativa ${sendAttempts}):`, sendResult.error);
                    if (sendAttempts < maxSendAttempts) {
                      await new Promise(resolve => setTimeout(resolve, 2000 * sendAttempts));
                    }
                  }
                } catch (sendError) {
                  console.error(`❌ Erro no envio (tentativa ${sendAttempts}):`, sendError);
                  if (sendAttempts < maxSendAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * sendAttempts));
                  }
                }
              }
              
              if (!sendSuccess) {
                console.error(`❌ Falha ao enviar após ${maxSendAttempts} tentativas`);
              }
            }

            // Marcar como completado independente do envio
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
                await whatsappService.sendMessage(instanceId!, message.from, response);
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
              setMessageQueue(prev =>
                prev.map(msg =>
                  msg.id === message.id ? { ...msg, status: 'human' } : msg
                )
              );
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar mensagem ${message.id}:`, error);
          
          setMessageQueue(prev =>
            prev.map(msg =>
              msg.id === message.id ? { ...msg, status: 'failed' } : msg
            )
          );
        }

        // Delay entre processamentos para evitar spam
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('❌ Erro no processamento da fila:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, messageQueue, processors, instanceId, instanceQueueConnection]);

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

    console.log(`👂 Configurando listener de mensagens para: ${instanceId}`);

    const handleNewMessage = (message: MessageData) => {
      console.log(`📨 Nova mensagem interceptada:`, {
        from: message.from,
        fromMe: message.fromMe,
        type: message.type,
        body: message.body?.substring(0, 50)
      });

      // Processar apenas mensagens recebidas (não enviadas)
      if (!message.fromMe) {
        console.log(`🎯 Adicionando à fila de processamento: ${message.from}`);
        enqueueMessage(message);
      }
    };

    // Conectar WebSocket se necessário
    const socket = whatsappService.connectSocket();
    whatsappService.joinClientRoom(instanceId);
    whatsappService.onClientMessage(instanceId, handleNewMessage);

    return () => {
      console.log(`🔌 Removendo listener para: ${instanceId}`);
      whatsappService.removeListener(`message_${instanceId}`, handleNewMessage);
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
