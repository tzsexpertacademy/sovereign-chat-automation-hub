
import { useState, useCallback, useRef } from 'react';

interface BatchedMessage {
  id: string;
  content: string;
  timestamp: string;
  from: string;
  type: string;
}

interface UseMessageBatchProps {
  batchTimeoutSeconds: number;
  onProcessBatch: (messages: BatchedMessage[]) => void;
}

export const useMessageBatch = ({ batchTimeoutSeconds, onProcessBatch }: UseMessageBatchProps) => {
  const [pendingMessages, setPendingMessages] = useState<BatchedMessage[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  const addMessage = useCallback((message: BatchedMessage) => {
    console.log('📥 Adicionando mensagem ao batch:', message.content);
    
    setPendingMessages(prev => {
      const updated = [...prev, message];
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        console.log('⏰ Timeout anterior cancelado');
      }
      
      // Set new timeout para processar o batch
      timeoutRef.current = setTimeout(() => {
        if (updated.length > 0 && !isProcessingRef.current) {
          console.log(`🔄 Processando batch de ${updated.length} mensagens após ${batchTimeoutSeconds}s`);
          isProcessingRef.current = true;
          onProcessBatch(updated);
          setPendingMessages([]);
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 1000);
        }
      }, batchTimeoutSeconds * 1000);
      
      console.log(`⏳ Timeout definido para ${batchTimeoutSeconds}s, batch atual: ${updated.length} mensagens`);
      return updated;
    });
  }, [batchTimeoutSeconds, onProcessBatch]);

  const clearBatch = useCallback(() => {
    console.log('🧹 Limpando batch de mensagens');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setPendingMessages([]);
    isProcessingRef.current = false;
  }, []);

  const forceProcessBatch = useCallback(() => {
    console.log('⚡ Forçando processamento do batch');
    if (pendingMessages.length > 0 && !isProcessingRef.current) {
      isProcessingRef.current = true;
      onProcessBatch(pendingMessages);
      setPendingMessages([]);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    }
  }, [pendingMessages, onProcessBatch]);

  return {
    pendingMessages,
    addMessage,
    clearBatch,
    forceProcessBatch
  };
};
