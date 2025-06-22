
import { useState, useCallback } from 'react';

interface SmartSplitConfig {
  maxCharsPerMessage: number;
  delayBetweenMessages: number; // em millisegundos
  enabled: boolean;
}

const defaultConfig: SmartSplitConfig = {
  maxCharsPerMessage: 160, // Tamanho típico de SMS
  delayBetweenMessages: 2000, // 2 segundos entre mensagens
  enabled: true
};

export const useSmartMessageSplit = () => {
  const [config, setConfig] = useState<SmartSplitConfig>(defaultConfig);

  const splitMessage = useCallback((message: string): string[] => {
    if (!config.enabled || message.length <= config.maxCharsPerMessage) {
      return [message];
    }

    const sentences = message.split(/(?<=[.!?])\s+/);
    const blocks: string[] = [];
    let currentBlock = '';

    for (const sentence of sentences) {
      // Se a frase sozinha é maior que o limite, quebrar por palavras
      if (sentence.length > config.maxCharsPerMessage) {
        if (currentBlock) {
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        
        const words = sentence.split(' ');
        let wordBlock = '';
        
        for (const word of words) {
          if ((wordBlock + ' ' + word).length > config.maxCharsPerMessage) {
            if (wordBlock) {
              blocks.push(wordBlock.trim());
              wordBlock = word;
            } else {
              // Palavra muito longa, forçar quebra
              blocks.push(word);
            }
          } else {
            wordBlock = wordBlock ? wordBlock + ' ' + word : word;
          }
        }
        
        if (wordBlock) {
          currentBlock = wordBlock;
        }
      } else {
        // Verificar se cabe no bloco atual
        if ((currentBlock + ' ' + sentence).length > config.maxCharsPerMessage) {
          if (currentBlock) {
            blocks.push(currentBlock.trim());
          }
          currentBlock = sentence;
        } else {
          currentBlock = currentBlock ? currentBlock + ' ' + sentence : sentence;
        }
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock.trim());
    }

    return blocks.filter(block => block.length > 0);
  }, [config]);

  const sendMessagesInSequence = useCallback(async (
    messages: string[],
    sendFunction: (message: string) => Promise<any>,
    onProgress?: (sent: number, total: number) => void
  ) => {
    const results = [];
    
    for (let i = 0; i < messages.length; i++) {
      try {
        console.log(`📤 Enviando bloco ${i + 1}/${messages.length}:`, messages[i].substring(0, 50));
        
        const result = await sendFunction(messages[i]);
        results.push(result);
        
        onProgress?.(i + 1, messages.length);
        
        // Aguardar delay entre mensagens (exceto na última)
        if (i < messages.length - 1) {
          console.log(`⏱️ Aguardando ${config.delayBetweenMessages}ms antes do próximo bloco`);
          await new Promise(resolve => setTimeout(resolve, config.delayBetweenMessages));
        }
      } catch (error) {
        console.error(`❌ Erro ao enviar bloco ${i + 1}:`, error);
        throw error;
      }
    }
    
    return results;
  }, [config.delayBetweenMessages]);

  return {
    config,
    setConfig,
    splitMessage,
    sendMessagesInSequence
  };
};
