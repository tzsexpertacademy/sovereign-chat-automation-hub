
import { useState, useEffect, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { ticketsService } from '@/services/ticketsService';
import { useToast } from './use-toast';

export interface MessageProcessor {
  clientId: string;
  instanceId: string;
  isActive: boolean;
  queueConnection?: any;
}

export const useAutomaticMessageProcessor = (clientId: string) => {
  const [processors, setProcessors] = useState<Map<string, MessageProcessor>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Inicializar processadores para todas as instâncias conectadas
  const initializeProcessors = useCallback(async () => {
    try {
      const instances = await whatsappService.getClientInstances(clientId);
      const connectedInstances = instances.filter(instance => instance.status === 'connected');
      
      for (const instance of connectedInstances) {
        // Verificar se a instância tem uma fila conectada
        const connections = await queuesService.getInstanceConnections(instance.instance_id);
        const queueConnection = connections[0];
        
        if (queueConnection && queueConnection.assistants) {
          const processor: MessageProcessor = {
            clientId,
            instanceId: instance.instance_id,
            isActive: true,
            queueConnection
          };
          
          setProcessors(prev => new Map(prev.set(instance.instance_id, processor)));
          console.log(`🤖 Processador automático ativado para instância ${instance.instance_id} com assistente ${queueConnection.assistants.name}`);
        }
      }
    } catch (error) {
      console.error('Erro ao inicializar processadores:', error);
    }
  }, [clientId]);

  // Processar mensagem automaticamente
  const processMessage = useCallback(async (message: any, processor: MessageProcessor) => {
    if (!processor.queueConnection?.assistants || message.fromMe) {
      return;
    }

    try {
      console.log(`🤖 Processando mensagem automaticamente: ${message.body?.substring(0, 50)}...`);
      
      const assistant = processor.queueConnection.assistants;
      
      // Gerar resposta do assistente
      const response = await generateAssistantResponse(message, assistant);
      
      if (response && response.trim()) {
        // Enviar resposta via WhatsApp
        await whatsappService.sendMessage(clientId, message.from, response);
        
        // Registrar no ticket como resposta da IA
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from,
          processor.instanceId,
          extractCustomerName(message),
          extractPhoneNumber(message.from),
          message.body || '',
          new Date().toISOString()
        );

        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}`,
          from_me: true,
          sender_name: assistant.name,
          content: response,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: true,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log(`✅ Resposta automática enviada: ${response.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem automaticamente:', error);
    }
  }, [clientId]);

  // Gerar resposta do assistente
  const generateAssistantResponse = async (message: any, assistant: any): Promise<string> => {
    try {
      const messageText = message.body?.toLowerCase() || '';
      
      // Respostas inteligentes baseadas no contexto
      if (messageText.includes('olá') || messageText.includes('oi') || messageText.includes('bom dia') || messageText.includes('boa tarde') || messageText.includes('boa noite')) {
        return `Olá! Sou o ${assistant.name}. Como posso ajudá-lo hoje? 😊`;
      }
      
      if (messageText.includes('horário') || messageText.includes('funcionamento') || messageText.includes('atendimento')) {
        return 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Como posso ajudá-lo?';
      }
      
      if (messageText.includes('preço') || messageText.includes('valor') || messageText.includes('quanto custa')) {
        return 'Ficarei feliz em ajudá-lo com informações sobre preços! Pode me contar mais sobre o que você está procurando?';
      }
      
      if (messageText.includes('obrigad') || messageText.includes('valeu') || messageText.includes('vlw')) {
        return 'De nada! Fico feliz em ajudar. Se precisar de mais alguma coisa, é só falar! 😊';
      }
      
      if (messageText.includes('tchau') || messageText.includes('até') || messageText.includes('falou')) {
        return 'Até logo! Foi um prazer ajudá-lo. Tenha um ótimo dia! 👋';
      }
      
      // Resposta padrão personalizada do assistente
      if (assistant.prompt) {
        return `${assistant.prompt}\n\nPosso ajudá-lo com mais alguma coisa?`;
      }
      
      return 'Obrigado pela sua mensagem! Como posso ajudá-lo hoje?';
      
    } catch (error) {
      console.error('Erro ao gerar resposta do assistente:', error);
      return 'Desculpe, houve um erro. Um atendente entrará em contato em breve.';
    }
  };

  // Extrair nome do cliente
  const extractCustomerName = (message: any): string => {
    return message.notifyName || message.pushName || message.senderName || `Contato ${extractPhoneNumber(message.from)}`;
  };

  // Extrair número de telefone
  const extractPhoneNumber = (from: string): string => {
    return from.replace(/[@c\.us]/g, '').replace(/\D/g, '');
  };

  // Configurar listeners para novas mensagens
  useEffect(() => {
    if (!clientId) return;

    // Inicializar processadores
    initializeProcessors();

    // Configurar listener para mensagens de todas as instâncias
    const handleNewMessage = async (message: any) => {
      if (!message.fromMe && message.from && message.body) {
        // Encontrar processador para esta instância
        const processor = Array.from(processors.values()).find(p => p.isActive);
        
        if (processor) {
          setIsProcessing(true);
          await processMessage(message, processor);
          setIsProcessing(false);
        }
      }
    };

    // Conectar ao WebSocket
    whatsappService.onClientMessage(clientId, handleNewMessage);

    // Cleanup
    return () => {
      whatsappService.removeListener(`message_${clientId}`);
    };
  }, [clientId, processors, processMessage, initializeProcessors]);

  // Recarregar processadores quando necessário
  const reloadProcessors = useCallback(() => {
    initializeProcessors();
  }, [initializeProcessors]);

  return {
    processors: Array.from(processors.values()),
    isProcessing,
    reloadProcessors
  };
};
