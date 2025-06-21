
import { useState, useCallback, useRef } from 'react';

interface BatchedMessage {
  id: string;
  text: string;
  timestamp: number;
  from: string;
}

interface UseMessageBatchProps {
  batchTimeoutSeconds: number;
  onProcessBatch: (messages: BatchedMessage[]) => void;
}

export const useMessageBatch = ({ batchTimeoutSeconds, onProcessBatch }: UseMessageBatchProps) => {
  const [pendingMessages, setPendingMessages] = useState<BatchedMessage[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addMessage = useCallback((message: BatchedMessage) => {
    setPendingMessages(prev => {
      const updated = [...prev, message];
      
      // Limpar timeout existente
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Definir novo timeout para processar o lote
      timeoutRef.current = setTimeout(() => {
        if (updated.length > 0) {
          console.log(`🕒 Processando lote de ${updated.length} mensagens após ${batchTimeoutSeconds}s`);
          onProcessBatch(updated);
          setPendingMessages([]);
        }
      }, batchTimeoutSeconds * 1000);
      
      return updated;
    });
  }, [batchTimeoutSeconds, onProcessBatch]);

  const clearBatch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setPendingMessages([]);
  }, []);

  const processBatchNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (pendingMessages.length > 0) {
      console.log(`⚡ Processando lote imediatamente com ${pendingMessages.length} mensagens`);
      onProcessBatch(pendingMessages);
      setPendingMessages([]);
    }
  }, [pendingMessages, onProcessBatch]);

  return {
    pendingMessages,
    addMessage,
    clearBatch,
    processBatchNow
  };
};
