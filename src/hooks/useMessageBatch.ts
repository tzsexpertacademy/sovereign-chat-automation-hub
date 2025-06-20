
import { useState, useCallback, useRef } from 'react';

interface BatchedMessage {
  id: string;
  text: string;
  timestamp: number;
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
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        if (updated.length > 0) {
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

  return {
    pendingMessages,
    addMessage,
    clearBatch
  };
};
