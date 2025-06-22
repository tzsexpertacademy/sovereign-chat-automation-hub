
import { useState, useEffect, useRef, useCallback } from 'react';

export const useOnlineStatus = (clientId: string, isEnabled: boolean = true) => {
  const [isOnline, setIsOnline] = useState(true); // SEMPRE ONLINE
  const lastActivityRef = useRef<number>(Date.now());
  const enabledRef = useRef(isEnabled);

  // Atualizar ref quando enabled mudar
  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (enabledRef.current) {
      setIsOnline(true);
      console.log(`📱 Atividade marcada para cliente: ${clientId}`);
    }
  }, [clientId]);

  const setOnline = useCallback(() => {
    if (enabledRef.current) {
      setIsOnline(true);
      console.log(`📱 Status online ativado para cliente: ${clientId}`);
    }
  }, [clientId]);

  const setOffline = useCallback(() => {
    if (enabledRef.current) {
      setIsOnline(false);
      console.log(`📱 Status offline para cliente: ${clientId}`);
    }
  }, [clientId]);

  // Manter sempre online quando habilitado
  useEffect(() => {
    if (enabledRef.current && clientId) {
      setIsOnline(true);
      console.log(`📱 Status online inicializado para cliente: ${clientId}`);
    }

    return () => {
      if (clientId) {
        console.log(`📱 Cleanup useOnlineStatus para: ${clientId}`);
      }
    };
  }, [clientId]);

  return {
    isOnline: true, // SEMPRE RETORNA TRUE
    markActivity,
    setOnline,
    setOffline
  };
};
