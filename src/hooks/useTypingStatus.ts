
import { useState, useCallback, useRef, useEffect } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface TypingState {
  isTyping: boolean;
  isRecording: boolean;
  startedAt?: number;
}

export const useTypingStatus = (clientId?: string, chatId?: string) => {
  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: false,
    isRecording: false
  });
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback(async () => {
    console.log('⌨️ Usuário começou a digitar');
    setTypingState(prev => ({ ...prev, isTyping: true, startedAt: Date.now() }));
    
    // Send typing status to WhatsApp
    if (clientId && chatId) {
      try {
        await whatsappService.sendTypingStatus(clientId, chatId, true);
      } catch (error) {
        console.error('Failed to send typing status to WhatsApp:', error);
      }
    }
    
    // Auto-stop typing after 5 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      console.log('⌨️ Timeout: parando indicador de digitação');
      stopTyping();
    }, 5000);
  }, [clientId, chatId]);

  const stopTyping = useCallback(async () => {
    console.log('⌨️ Usuário parou de digitar');
    setTypingState(prev => ({ ...prev, isTyping: false }));
    
    // Send typing stop status to WhatsApp
    if (clientId && chatId) {
      try {
        await whatsappService.sendTypingStatus(clientId, chatId, false);
      } catch (error) {
        console.error('Failed to send typing stop status to WhatsApp:', error);
      }
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [clientId, chatId]);

  const startRecording = useCallback(async () => {
    console.log('🎤 Usuário começou a gravar áudio');
    setTypingState(prev => ({ ...prev, isRecording: true, startedAt: Date.now() }));
    
    // Send recording status to WhatsApp
    if (clientId && chatId) {
      try {
        await whatsappService.sendRecordingStatus(clientId, chatId, true);
      } catch (error) {
        console.error('Failed to send recording status to WhatsApp:', error);
      }
    }
    
    // Auto-stop recording after 30 seconds
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    recordingTimeoutRef.current = setTimeout(() => {
      console.log('🎤 Timeout: parando gravação');
      stopRecording();
    }, 30000);
  }, [clientId, chatId]);

  const stopRecording = useCallback(async () => {
    console.log('🎤 Usuário parou de gravar áudio');
    setTypingState(prev => ({ ...prev, isRecording: false }));
    
    // Send recording stop status to WhatsApp
    if (clientId && chatId) {
      try {
        await whatsappService.sendRecordingStatus(clientId, chatId, false);
      } catch (error) {
        console.error('Failed to send recording stop status to WhatsApp:', error);
      }
    }
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, [clientId, chatId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...typingState,
    startTyping,
    stopTyping,
    startRecording,
    stopRecording
  };
};
