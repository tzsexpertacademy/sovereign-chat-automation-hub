
import { useState, useCallback, useRef } from 'react';

interface BatchedMessage {
  id: string;
  text: string;
  timestamp: number;
  from: string;
  chatId: string;
}

interface UseMessageBatchProps {
  batchTimeoutSeconds: number;
  onProcessBatch: (messages: BatchedMessage[], chatId: string) => Promise<void>;
}

export const useMessageBatch = ({ batchTimeoutSeconds, onProcessBatch }: UseMessageBatchProps) => {
  const [pendingMessages, setPendingMessages] = useState<Map<string, BatchedMessage[]>>(new Map());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addMessage = useCallback((message: BatchedMessage) => {
    const { chatId } = message;
    
    setPendingMessages(prev => {
      const newMap = new Map(prev);
      const chatMessages = newMap.get(chatId) || [];
      const updatedMessages = [...chatMessages, message];
      newMap.set(chatId, updatedMessages);
      
      // Clear existing timeout for this chat
      const existingTimeout = timeoutRefs.current.get(chatId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Set new timeout for this chat
      const newTimeout = setTimeout(async () => {
        console.log(`🎯 Processando lote de ${updatedMessages.length} mensagens para chat ${chatId}`);
        
        // Process the batch
        await onProcessBatch(updatedMessages, chatId);
        
        // Clear the batch for this chat
        setPendingMessages(current => {
          const clearedMap = new Map(current);
          clearedMap.delete(chatId);
          return clearedMap;
        });
        
        // Clear timeout reference
        timeoutRefs.current.delete(chatId);
      }, batchTimeoutSeconds * 1000);
      
      timeoutRefs.current.set(chatId, newTimeout);
      
      return newMap;
    });
  }, [batchTimeoutSeconds, onProcessBatch]);

  const clearBatch = useCallback((chatId: string) => {
    const timeout = timeoutRefs.current.get(chatId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(chatId);
    }
    
    setPendingMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(chatId);
      return newMap;
    });
  }, []);

  const getPendingCount = useCallback((chatId: string) => {
    return pendingMessages.get(chatId)?.length || 0;
  }, [pendingMessages]);

  return {
    addMessage,
    clearBatch,
    getPendingCount,
    pendingMessages
  };
};
