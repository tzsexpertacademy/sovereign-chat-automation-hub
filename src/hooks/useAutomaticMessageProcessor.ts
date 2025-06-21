
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
  const [processors, setProcessors] = useState<MessageProcessor[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Inicializar processadores para todas as conexões de fila
  const initializeProcessors = useCallback(async () => {
    try {
      console.log('🔄 Inicializando processadores automáticos...');
      
      // Buscar todas as conexões de fila do cliente
      const connections = await queuesService.getClientQueueConnections(clientId);
      console.log('📋 Conexões de fila encontradas:', connections);
      
      const newProcessors: MessageProcessor[] = [];
      
      for (const connection of connections) {
        if (connection.assistants && connection.whatsapp_instances) {
          const processor: MessageProcessor = {
            clientId,
            instanceId: connection.whatsapp_instances.instance_id,
            isActive: true,
            queueConnection: connection
          };
          
          newProcessors.push(processor);
          console.log(`🤖 Processador ativado para instância ${connection.whatsapp_instances.instance_id} com assistente ${connection.assistants.name}`);
        }
      }
      
      setProcessors(newProcessors);
      
      if (newProcessors.length > 0) {
        toast({
          title: "Processador Automático Ativo",
          description: `${newProcessors.length} assistente(s) configurado(s)`
        });
      }
      
    } catch (error) {
      console.error('Erro ao inicializar processadores:', error);
      setProcessors([]);
    }
  }, [clientId, toast]);

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
        console.log(`💬 Enviando resposta: ${response.substring(0, 50)}...`);
        
        // Enviar resposta via WhatsApp
        await whatsappService.sendMessage(clientId, message.from, response);
        
        // Registrar no ticket como resposta da IA
        const customerName = extractCustomerName(message);
        const customerPhone = extractPhoneNumber(message.from);
        
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from,
          processor.instanceId,
          customerName,
          customerPhone,
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

        console.log(`✅ Resposta automática enviada com sucesso!`);
        
        toast({
          title: "Resposta Automática Enviada",
          description: `${assistant.name} respondeu automaticamente`
        });
      }
    } catch (error) {
      console.error('Erro ao processar mensagem automaticamente:', error);
      toast({
        title: "Erro no Processamento",
        description: "Falha ao processar mensagem automaticamente",
        variant: "destructive"
      });
    }
  }, [clientId, toast]);

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
    const possibleNames = [
      message.notifyName,
      message.pushName, 
      message.senderName,
      message.author,
      message.sender
    ];

    for (const name of possibleNames) {
      if (name && 
          typeof name === 'string' && 
          name.trim() !== '' && 
          !name.includes('@') && 
          name.length > 1) {
        return name.trim();
      }
    }

    const phone = extractPhoneNumber(message.from);
    if (phone.length >= 10) {
      return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }

    return 'Contato sem nome';
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

    // Configurar listener para mensagens
    const handleNewMessage = async (message: any) => {
      console.log('📨 Nova mensagem recebida para processamento:', message);
      
      if (!message.fromMe && message.from && message.body) {
        // Encontrar processador para esta mensagem
        const processor = processors.find(p => p.isActive);
        
        if (processor) {
          console.log('🎯 Processador encontrado, iniciando processamento...');
          setIsProcessing(true);
          
          try {
            await processMessage(message, processor);
          } finally {
            setIsProcessing(false);
          }
        } else {
          console.log('❌ Nenhum processador ativo encontrado');
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
    processors,
    isProcessing,
    reloadProcessors
  };
};
