/**
 * Hook para integrar o MessageProcessingController
 * Gerencia locks de chat e prevenção de duplicação de mensagens
 */

import { useCallback, useRef } from 'react';
import { messageProcessingController } from '../services/messageProcessingController';

export const useMessageProcessingController = () => {
  const controllerRef = useRef(messageProcessingController);

  const canProcessMessage = useCallback((messageId: string, chatId: string): boolean => {
    return controllerRef.current.canProcessMessage(messageId, chatId);
  }, []);

  const lockChat = useCallback((chatId: string): void => {
    controllerRef.current.lockChat(chatId);
  }, []);

  const unlockChat = useCallback((chatId: string): void => {
    controllerRef.current.unlockChat(chatId);
  }, []);

  const markMessageProcessed = useCallback((messageId: string): void => {
    controllerRef.current.markMessageProcessed(messageId);
  }, []);

  const markMessagesProcessed = useCallback((messageIds: string[]): void => {
    controllerRef.current.markMessagesProcessed(messageIds);
  }, []);

  const isChatLocked = useCallback((chatId: string): boolean => {
    return controllerRef.current.isChatLocked(chatId);
  }, []);

  const isMessageProcessed = useCallback((messageId: string): boolean => {
    return controllerRef.current.isMessageProcessed(messageId);
  }, []);

  const getStatus = useCallback(() => {
    return controllerRef.current.getStatus();
  }, []);

  const cleanupOldProcessed = useCallback((): void => {
    controllerRef.current.cleanupOldProcessed();
  }, []);

  return {
    canProcessMessage,
    lockChat,
    unlockChat,
    markMessageProcessed,
    markMessagesProcessed,
    isChatLocked,
    isMessageProcessed,
    getStatus,
    cleanupOldProcessed
  };
};