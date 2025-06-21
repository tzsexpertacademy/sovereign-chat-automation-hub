
import { useState, useCallback, useRef, useEffect } from 'react';

interface TypingState {
  isTyping: boolean;
  isRecording: boolean;
  startedAt?: number;
}

export const useTypingStatus = () => {
  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: false,
    isRecording: false
  });
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback(() => {
    console.log('⌨️ Usuário começou a digitar');
    setTypingState(prev => ({ ...prev, isTyping: true, startedAt: Date.now() }));
    
    // Auto-stop typing after 5 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      console.log('⌨️ Timeout: parando indicador de digitação');
      setTypingState(prev => ({ ...prev, isTyping: false }));
    }, 5000);
  }, []);

  const stopTyping = useCallback(() => {
    console.log('⌨️ Usuário parou de digitar');
    setTypingState(prev => ({ ...prev, isTyping: false }));
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    console.log('🎤 Usuário começou a gravar áudio');
    setTypingState(prev => ({ ...prev, isRecording: true, startedAt: Date.now() }));
    
    // Auto-stop recording after 30 seconds
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    recordingTimeoutRef.current = setTimeout(() => {
      console.log('🎤 Timeout: parando gravação');
      setTypingState(prev => ({ ...prev, isRecording: false }));
    }, 30000);
  }, []);

  const stopRecording = useCallback(() => {
    console.log('🎤 Usuário parou de gravar áudio');
    setTypingState(prev => ({ ...prev, isRecording: false }));
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

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
