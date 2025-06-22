
import { useEffect, useCallback } from 'react';
import { presenceService } from '@/services/presenceService';

export const usePresenceManager = (clientId: string, isEnabled: boolean = true) => {
  
  // Manter status online
  useEffect(() => {
    if (clientId && isEnabled) {
      console.log(`🔛 Ativando gerenciamento de presença para ${clientId}`);
      presenceService.maintainOnlineStatus(clientId, true);
      
      return () => {
        console.log(`🔴 Desativando gerenciamento de presença para ${clientId}`);
        presenceService.maintainOnlineStatus(clientId, false);
      };
    }
  }, [clientId, isEnabled]);

  // Mostrar indicador de digitação
  const showTyping = useCallback((chatId: string, duration?: number) => {
    if (clientId && isEnabled) {
      return presenceService.showTyping(clientId, chatId, duration);
    }
  }, [clientId, isEnabled]);

  // Mostrar indicador de gravação
  const showRecording = useCallback((chatId: string, duration?: number) => {
    if (clientId && isEnabled) {
      return presenceService.showRecording(clientId, chatId, duration);
    }
  }, [clientId, isEnabled]);

  // Marcar mensagens como lidas
  const markMessagesAsRead = useCallback((chatId: string, messageIds: string[]) => {
    if (clientId && isEnabled) {
      return presenceService.markAsRead(clientId, chatId, messageIds);
    }
  }, [clientId, isEnabled]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (clientId) {
        presenceService.cleanup(clientId);
      }
    };
  }, [clientId]);

  return {
    showTyping,
    showRecording,
    markMessagesAsRead
  };
};
