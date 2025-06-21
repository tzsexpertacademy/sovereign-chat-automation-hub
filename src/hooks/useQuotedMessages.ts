
import { useState, useCallback } from 'react';

export interface QuotedMessage {
  id: string;
  body: string;
  author?: string;
  timestamp: number;
}

export interface MessageWithQuote {
  id: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  quotedMessage?: QuotedMessage;
  from: string;
}

export const useQuotedMessages = (isEnabled: boolean = true) => {
  const [isProcessingQuoted, setIsProcessingQuoted] = useState(false);

  // Detectar se mensagem tem citação/resposta
  const hasQuotedMessage = useCallback((message: any): boolean => {
    if (!isEnabled || !message) return false;
    
    return !!(
      message.quotedMessage ||
      message.hasQuotedMsg ||
      message._data?.quotedMsg ||
      message.quotedMsg
    );
  }, [isEnabled]);

  // Extrair dados da mensagem citada
  const extractQuotedMessage = useCallback((message: any): QuotedMessage | null => {
    if (!hasQuotedMessage(message)) return null;

    const quotedData = message.quotedMessage || 
                      message._data?.quotedMsg || 
                      message.quotedMsg;

    if (!quotedData) return null;

    return {
      id: quotedData.id || quotedData._serialized || 'unknown',
      body: quotedData.body || quotedData.caption || '',
      author: quotedData.author || quotedData.from || 'Desconhecido',
      timestamp: quotedData.timestamp || Date.now()
    };
  }, [hasQuotedMessage]);

  // Processar mensagem com citação
  const processQuotedMessage = useCallback((message: any): MessageWithQuote | null => {
    if (!isEnabled || !message) return null;

    try {
      setIsProcessingQuoted(true);
      
      const quotedMessage = extractQuotedMessage(message);
      
      const processedMessage: MessageWithQuote = {
        id: message.id,
        body: message.body || '',
        timestamp: message.timestamp || Date.now(),
        fromMe: message.fromMe || false,
        from: message.from,
        quotedMessage
      };

      console.log('💬 Mensagem com citação processada:', {
        messageId: processedMessage.id,
        hasQuote: !!quotedMessage,
        quotedId: quotedMessage?.id,
        quotedBody: quotedMessage?.body?.substring(0, 50)
      });

      return processedMessage;
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem com citação:', error);
      return null;
    } finally {
      setIsProcessingQuoted(false);
    }
  }, [isEnabled, extractQuotedMessage]);

  // Gerar contexto combinado para o assistente
  const generateContextualPrompt = useCallback((message: MessageWithQuote, basePrompt: string): string => {
    if (!message.quotedMessage) return basePrompt;

    const contextualPrompt = `${basePrompt}

CONTEXTO IMPORTANTE: O usuário está respondendo a uma mensagem anterior.

Mensagem anterior citada:
"${message.quotedMessage.body}"
(Enviada por: ${message.quotedMessage.author})

Resposta atual do usuário:
"${message.body}"

INSTRUÇÕES ESPECIAIS:
- Leia e entenda AMBAS as mensagens
- Sua resposta deve considerar o contexto da mensagem citada
- Seja específico sobre qual parte da mensagem anterior você está abordando
- Mantenha a continuidade da conversa considerando o histórico citado`;

    console.log('📝 Prompt contextual gerado para mensagem com citação');
    
    return contextualPrompt;
  }, []);

  // Formatar mensagem para display (útil para UI)
  const formatQuotedMessageForDisplay = useCallback((message: MessageWithQuote): string => {
    if (!message.quotedMessage) return message.body;

    return `> ${message.quotedMessage.body}
${message.body}`;
  }, []);

  return {
    isProcessingQuoted,
    hasQuotedMessage,
    extractQuotedMessage,
    processQuotedMessage,
    generateContextualPrompt,
    formatQuotedMessageForDisplay
  };
};
