
import { useEffect, useCallback } from 'react';
import { presenceService } from '@/services/presenceService';

export const usePresenceManager = (instanceId: string, isEnabled: boolean = true) => {
  
  // Manter status online
  useEffect(() => {
    if (instanceId && isEnabled) {
      console.log(`🔛 Ativando gerenciamento de presença para instância ${instanceId}`);
      presenceService.maintainOnlineStatus(instanceId, true);
      
      return () => {
        console.log(`🔴 Desativando gerenciamento de presença para instância ${instanceId}`);
        presenceService.maintainOnlineStatus(instanceId, false);
      };
    }
  }, [instanceId, isEnabled]);

  // Mostrar indicador de digitação
  const showTyping = useCallback(async (chatId: string, duration?: number) => {
    if (instanceId && isEnabled) {
      return await presenceService.showTyping(instanceId, chatId, duration);
    }
    return false;
  }, [instanceId, isEnabled]);

  // Mostrar indicador de gravação
  const showRecording = useCallback(async (chatId: string, duration?: number) => {
    if (instanceId && isEnabled) {
      return await presenceService.showRecording(instanceId, chatId, duration);
    }
    return false;
  }, [instanceId, isEnabled]);

  // Marcar mensagens como lidas
  const markMessagesAsRead = useCallback(async (chatId: string, messageIds: string[]) => {
    if (instanceId && isEnabled && messageIds.length > 0) {
      return await presenceService.markAsRead(instanceId, chatId, messageIds);
    }
    return false;
  }, [instanceId, isEnabled]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (instanceId) {
        presenceService.cleanup(instanceId);
      }
    };
  }, [instanceId]);

  return {
    showTyping,
    showRecording,
    markMessagesAsRead
  };
};
