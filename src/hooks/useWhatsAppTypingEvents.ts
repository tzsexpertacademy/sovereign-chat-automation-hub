
import { useState, useEffect, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface TypingEvent {
  chatId: string;
  isTyping: boolean;
  contact: string;
  timestamp: number;
}

export const useWhatsAppTypingEvents = (clientId: string) => {
  const [typingEvents, setTypingEvents] = useState<Map<string, TypingEvent>>(new Map());

  const handleTypingEvent = useCallback((data: { chatId: string, isTyping: boolean, contact: string }) => {
    console.log('📱 Typing event received from WhatsApp:', data);
    
    setTypingEvents(prev => {
      const newMap = new Map(prev);
      
      if (data.isTyping) {
        newMap.set(data.chatId, {
          ...data,
          timestamp: Date.now()
        });
      } else {
        newMap.delete(data.chatId);
      }
      
      return newMap;
    });

    // Auto-remove typing indicator after 10 seconds
    if (data.isTyping) {
      setTimeout(() => {
        setTypingEvents(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.chatId);
          
          // Only remove if it's the same typing session
          if (existing && (Date.now() - existing.timestamp) >= 9000) {
            newMap.delete(data.chatId);
          }
          
          return newMap;
        });
      }, 10000);
    }
  }, []);

  useEffect(() => {
    if (!clientId) return;

    // Listen for typing events from WhatsApp
    whatsappService.onTypingEvent(clientId, handleTypingEvent);

    return () => {
      whatsappService.removeTypingListener(clientId);
    };
  }, [clientId, handleTypingEvent]);

  const isContactTyping = useCallback((chatId: string): boolean => {
    return typingEvents.has(chatId);
  }, [typingEvents]);

  const getTypingContact = useCallback((chatId: string): string | null => {
    const event = typingEvents.get(chatId);
    return event ? event.contact : null;
  }, [typingEvents]);

  return {
    isContactTyping,
    getTypingContact,
    typingEvents: Array.from(typingEvents.values())
  };
};
