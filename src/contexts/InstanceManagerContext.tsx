import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface InstanceStatus {
  status: string;
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
  retryCount?: number;
  lastStatusChange?: Date;
  isStuck?: boolean;
  reallyConnected?: boolean;
}

interface InstanceManagerContextType {
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => InstanceStatus;
  isLoading: (instanceId: string) => boolean;
  websocketConnected: boolean;
  cleanup: (instanceId: string) => void;
  refreshInstanceStatus: (instanceId: string) => Promise<void>;
  forceReconnectInstance: (instanceId: string) => Promise<void>;
}

const InstanceManagerContext = createContext<InstanceManagerContextType | undefined>(undefined);

export const InstanceManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  const [instanceStates, setInstanceStates] = useState<Record<string, InstanceStatus>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  
  const socketRef = useRef<any>(null);
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});
  const activeConnections = useRef<Set<string>>(new Set());
  const retryCounters = useRef<Record<string, number>>({});

  // Inicializar WebSocket com reconexão automática
  useEffect(() => {
    console.log('🔌 [MANAGER] Inicializando InstanceManager v2.0...');
    
    const initSocket = () => {
      try {
        socketRef.current = whatsappService.connectSocket();
        
        if (socketRef.current) {
          socketRef.current.on('connect', () => {
            console.log('✅ [MANAGER] WebSocket conectado');
            setWebsocketConnected(true);
          });

          socketRef.current.on('disconnect', () => {
            console.log('❌ [MANAGER] WebSocket desconectado');
            setWebsocketConnected(false);
            
            // Tentar reconectar após 3 segundos
            setTimeout(() => {
              if (!socketRef.current?.connected) {
                console.log('🔄 [MANAGER] Tentando reconectar...');
                initSocket();
              }
            }, 3000);
          });

          socketRef.current.on('connect_error', (error: any) => {
            console.error('❌ [MANAGER] Erro WebSocket:', error);
            setWebsocketConnected(false);
          });
        }
      } catch (error) {
        console.error('❌ [MANAGER] Erro ao inicializar WebSocket:', error);
        setWebsocketConnected(false);
      }
    };

    initSocket();

    return () => {
      console.log('🧹 [MANAGER] Limpando InstanceManager...');
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // NOVA FUNCIONALIDADE v2.0: Verificar se realmente está conectado
  const checkRealConnection = useCallback(async (instanceId: string, currentStatus: InstanceStatus): Promise<boolean> => {
    try {
      console.log(`🧠 [MANAGER v2.0] Verificando conexão real: ${instanceId}`);
      
      // 1. Se já tem phoneNumber válido, provavelmente está conectado
      if (currentStatus.phoneNumber && 
          currentStatus.phoneNumber !== 'null' && 
          currentStatus.phoneNumber.length > 5) {
        console.log(`✅ [MANAGER v2.0] ${instanceId} tem telefone válido: ${currentStatus.phoneNumber} - CONECTADO!`);
        return true;
      }

      // 2. Se status é connected, deve estar conectado
      if (currentStatus.status === 'connected') {
        console.log(`✅ [MANAGER v2.0] ${instanceId} status connected - CONECTADO!`);
        return true;
      }

      // 3. NOVA VERIFICAÇÃO v2.0: Tentar acessar chats como proxy de conexão real
      try {
        console.log(`🔍 [MANAGER v2.0] Testando acesso a chats: ${instanceId}`);
        const chats = await whatsappService.getChats(instanceId);
        
        if (chats && Array.isArray(chats) && chats.length >= 0) {
          console.log(`🎉 [MANAGER v2.0] ${instanceId} consegue acessar chats (${chats.length}) - REALMENTE CONECTADO!`);
          
          // Tentar obter número do primeiro chat se disponível
          if (chats.length > 0 && chats[0].name) {
            console.log(`📱 [MANAGER v2.0] Primeira conversa: ${chats[0].name}`);
          }
          
          return true;
        }
      } catch (chatError: any) {
        console.log(`❌ [MANAGER v2.0] ${instanceId} não consegue acessar chats: ${chatError.message}`);
        
        // Se erro 401/403, pode estar desconectado
        if (chatError.message.includes('401') || chatError.message.includes('403')) {
          console.log(`🔒 [MANAGER v2.0] ${instanceId} erro de autorização - não conectado`);
          return false;
        }
      }

      // 4. Se chegou até aqui e não conseguiu confirmar, assumir não conectado
      console.log(`❌ [MANAGER v2.0] ${instanceId} não conseguiu confirmar conexão real`);
      return false;
      
    } catch (error) {
      console.error(`❌ [MANAGER v2.0] Erro ao verificar conexão real ${instanceId}:`, error);
      return false;
    }
  }, []);

  // Detectar se instância está presa (MELHORADO v2.0)
  const detectStuckInstance = useCallback((instanceId: string, currentStatus: InstanceStatus): boolean => {
    const previous = instanceStates[instanceId];
    
    if (!previous || !previous.lastStatusChange) return false;
    
    const timeSinceLastChange = Date.now() - previous.lastStatusChange.getTime();
    const isStuckInQrReady = currentStatus.status === 'qr_ready' && timeSinceLastChange > 90000; // 1.5 minutos
    
    // NOVO v2.0: NÃO considerar preso se realmente conectado
    if (isStuckInQrReady && currentStatus.reallyConnected) {
      console.log(`✅ [MANAGER v2.0] ${instanceId} parece preso mas está realmente conectado - OK!`);
      return false;
    }
    
    if (isStuckInQrReady) {
      console.log(`⚠️ [MANAGER v2.0] Instância ${instanceId} presa em qr_ready há ${Math.round(timeSinceLastChange / 1000)}s`);
      return true;
    }
    
    return false;
  }, [instanceStates]);

  // Função para verificar status via API (MELHORADA v2.0)
  const refreshInstanceStatus = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 [MANAGER v2.0] Verificando status: ${instanceId}`);
      const status = await whatsappService.getClientStatus(instanceId);
      
      const previous = instanceStates[instanceId];
      const statusChanged = !previous || previous.status !== status.status;
      
      const newStatus: InstanceStatus = {
        status: status.status,
        phoneNumber: status.phoneNumber,
        hasQrCode: status.hasQrCode,
        qrCode: status.qrCode,
        timestamp: new Date().toISOString(),
        retryCount: previous?.retryCount || 0,
        lastStatusChange: statusChanged ? new Date() : previous?.lastStatusChange || new Date(),
        isStuck: false,
        reallyConnected: false
      };
      
      // NOVA FUNCIONALIDADE v2.0: Verificar se realmente está conectado
      newStatus.reallyConnected = await checkRealConnection(instanceId, newStatus);
      
      // Detectar se está preso (mas não se realmente conectado)
      newStatus.isStuck = detectStuckInstance(instanceId, newStatus);
      
      // Log mudanças importantes
      if (statusChanged) {
        console.log(`📱 [MANAGER v2.0] Status mudou ${instanceId}: ${previous?.status || 'N/A'} → ${status.status}`);
      }

      // NOVO v2.0: Se detectou conexão real, forçar status connected
      if (newStatus.reallyConnected && status.status !== 'connected') {
        console.log(`🎉 [MANAGER v2.0] ${instanceId} REALMENTE CONECTADO! Corrigindo status: ${status.status} → connected`);
        newStatus.status = 'connected';
      }
      
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: newStatus
      }));
      
      // Se conectou com sucesso (MELHORADO v2.0)
      if (newStatus.reallyConnected || (status.status === 'connected' && status.phoneNumber)) {
        console.log(`🎉 [MANAGER v2.0] ${instanceId} CONECTADO! Telefone: ${status.phoneNumber || 'detectado via chats'}`);
        
        // Parar polling
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        
        toast({
          title: "WhatsApp Conectado! 🎉",
          description: `Sistema v2.0 detectou conexão: ${status.phoneNumber || 'Telefone detectado'}`,
        });
        
        return; // Não tentar auto-correção se conectado
      }
      
      // NOVO v2.0: Auto-correção mais inteligente
      if (newStatus.isStuck && newStatus.retryCount < 2 && !newStatus.reallyConnected) {
        console.log(`🔄 [MANAGER v2.0] Auto-correção inteligente: reconectando ${instanceId}`);
        setTimeout(() => {
          forceReconnectInstance(instanceId);
        }, 3000);
      }
      
    } catch (error) {
      console.error(`❌ [MANAGER v2.0] Erro ao verificar status ${instanceId}:`, error);
      throw error;
    }
  }, [instanceStates, detectStuckInstance, toast, checkRealConnection]);

  // Forçar reconexão limpa (MELHORADA v2.0)
  const forceReconnectInstance = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 [MANAGER v2.0] Forçando reconexão: ${instanceId}`);
      
      const currentStatus = instanceStates[instanceId];
      
      // NOVO v2.0: Se realmente conectado, não forçar reconexão
      if (currentStatus?.reallyConnected) {
        console.log(`✅ [MANAGER v2.0] ${instanceId} realmente conectado - cancelando reconexão`);
        toast({
          title: "Reconexão Cancelada",
          description: "Sistema v2.0 detectou que a instância já está conectada",
        });
        return;
      }
      
      // Incrementar contador de retry
      retryCounters.current[instanceId] = (retryCounters.current[instanceId] || 0) + 1;
      
      // Parar polling atual
      if (pollingIntervals.current[instanceId]) {
        clearInterval(pollingIntervals.current[instanceId]);
        delete pollingIntervals.current[instanceId];
      }
      
      // NOVO v2.0: Tentar desconectar mas ignorar erro 500 (mais robusto)
      try {
        console.log(`🔌 [MANAGER v2.0] Tentando desconectar ${instanceId}`);
        await whatsappService.disconnectClient(instanceId);
        console.log(`🔌 [MANAGER v2.0] ${instanceId} desconectado com sucesso`);
      } catch (disconnectError: any) {
        console.warn(`⚠️ [MANAGER v2.0] Erro ao desconectar ${instanceId} (ignorando):`, disconnectError.message);
        // NOVO v2.0: Ignorar QUALQUER erro de disconnect - sessão pode já estar limpa
      }
      
      // Aguardar 3 segundos
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reconectar
      await whatsappService.connectClient(instanceId);
      console.log(`🚀 [MANAGER v2.0] ${instanceId} reconectando...`);
      
      // Atualizar estado
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'connecting',
          retryCount: retryCounters.current[instanceId],
          lastStatusChange: new Date(),
          isStuck: false,
          reallyConnected: false
        }
      }));
      
      // Iniciar polling mais agressivo após reconexão
      setTimeout(() => {
        startPolling(instanceId, 3000); // Polling a cada 3 segundos
      }, 2000);
      
      toast({
        title: "Reconectando... 🔄",
        description: `Sistema v2.0 limpou sessão (tentativa ${retryCounters.current[instanceId]})`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.0] Erro na reconexão ${instanceId}:`, error);
      toast({
        title: "Erro na Reconexão",
        description: `v2.0: ${error.message}`,
        variant: "destructive",
      });
    }
  }, [instanceStates, toast]);

  // Configurar listener WebSocket
  const setupWebSocketListener = useCallback((instanceId: string) => {
    if (!socketRef.current) return;

    console.log(`👂 [MANAGER v2.0] Configurando listener para ${instanceId}`);
    
    whatsappService.joinClientRoom(instanceId);
    
    const eventName = `client_status_${instanceId}`;
    
    const statusHandler = (data: any) => {
      console.log(`📡 [MANAGER v2.0] Status WebSocket ${instanceId}:`, data.status);
      
      const previous = instanceStates[instanceId];
      const statusChanged = !previous || previous.status !== data.status;
      
      const newStatus: InstanceStatus = {
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: data.hasQrCode,
        qrCode: data.qrCode,
        timestamp: data.timestamp || new Date().toISOString(),
        retryCount: previous?.retryCount || 0,
        lastStatusChange: statusChanged ? new Date() : previous?.lastStatusChange || new Date(),
        isStuck: false,
        reallyConnected: data.phoneNumber ? true : false
      };
      
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: newStatus
      }));

      // Se conectou, parar polling
      if ((data.status === 'connected' && data.phoneNumber) || newStatus.reallyConnected) {
        console.log(`✅ [MANAGER v2.0] ${instanceId} conectado via WebSocket`);
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        
        toast({
          title: "WhatsApp Conectado! 🎉",
          description: `v2.0: ${data.phoneNumber || 'Telefone detectado'}`,
        });
      }
    };

    socketRef.current.off(eventName, statusHandler);
    socketRef.current.on(eventName, statusHandler);
  }, [instanceStates, toast]);

  // Polling melhorado com detecção de problemas (v2.0)
  const startPolling = useCallback((instanceId: string, interval: number = 5000) => {
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
    }

    console.log(`🔄 [MANAGER v2.0] Iniciando polling inteligente para ${instanceId} (${interval}ms)`);
    
    pollingIntervals.current[instanceId] = setInterval(async () => {
      try {
        await refreshInstanceStatus(instanceId);
        
        const currentStatus = instanceStates[instanceId];
        if (currentStatus?.reallyConnected || (currentStatus?.status === 'connected' && currentStatus?.phoneNumber)) {
          console.log(`✅ [MANAGER v2.0] ${instanceId} conectado - parando polling`);
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
      } catch (error) {
        console.error(`❌ [MANAGER v2.0] Erro no polling ${instanceId}:`, error);
      }
    }, interval);
  }, [refreshInstanceStatus, instanceStates]);

  const connectInstance = useCallback(async (instanceId: string) => {
    console.log(`🚀 [MANAGER v2.0] Conectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      // Reset retry counter
      retryCounters.current[instanceId] = 0;
      
      // Configurar WebSocket listener
      setupWebSocketListener(instanceId);
      
      // Chamar API de conexão
      await whatsappService.connectClient(instanceId);
      
      // Verificar status inicial
      setTimeout(() => {
        refreshInstanceStatus(instanceId);
      }, 2000);
      
      // Iniciar polling
      setTimeout(() => {
        startPolling(instanceId);
      }, 3000);
      
      activeConnections.current.add(instanceId);
      
      toast({
        title: "Conectando... 🚀",
        description: `Sistema v2.0 iniciando conexão: ${instanceId}`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.0] Erro ao conectar ${instanceId}:`, error);
      toast({
        title: "Erro na Conexão",
        description: `v2.0: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [setupWebSocketListener, refreshInstanceStatus, startPolling, toast]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    console.log(`🔌 [MANAGER v2.0] Desconectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      // NOVO v2.0: Tentar desconectar mas ignorar erros
      try {
        await whatsappService.disconnectClient(instanceId);
        console.log(`✅ [MANAGER v2.0] ${instanceId} desconectado com sucesso`);
      } catch (error: any) {
        console.warn(`⚠️ [MANAGER v2.0] Erro ao desconectar ${instanceId} (ignorando):`, error.message);
        // Ignorar erro - pode já estar desconectado
      }
      
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: {
          status: 'disconnected',
          phoneNumber: undefined,
          hasQrCode: false,
          qrCode: undefined,
          timestamp: new Date().toISOString(),
          retryCount: 0,
          lastStatusChange: new Date(),
          isStuck: false,
          reallyConnected: false
        }
      }));
      
      activeConnections.current.delete(instanceId);
      
      toast({
        title: "Desconectado ✅",
        description: `Sistema v2.0: ${instanceId} desconectado`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.0] Erro ao desconectar ${instanceId}:`, error);
      toast({
        title: "Erro",
        description: `v2.0: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast]);

  const getInstanceStatus = useCallback((instanceId: string): InstanceStatus => {
    return instanceStates[instanceId] || {
      status: 'disconnected',
      phoneNumber: undefined,
      hasQrCode: false,
      qrCode: undefined,
      retryCount: 0,
      lastStatusChange: new Date(),
      isStuck: false,
      reallyConnected: false
    };
  }, [instanceStates]);

  const isLoading = useCallback((instanceId: string): boolean => {
    return loadingStates[instanceId] || false;
  }, [loadingStates]);

  const cleanup = useCallback((instanceId: string) => {
    console.log(`🧹 [MANAGER v2.0] Limpando instância: ${instanceId}`);
    
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
      delete pollingIntervals.current[instanceId];
    }
    
    activeConnections.current.delete(instanceId);
    delete retryCounters.current[instanceId];
    
    setInstanceStates(prev => {
      const newState = { ...prev };
      delete newState[instanceId];
      return newState;
    });
    
    setLoadingStates(prev => {
      const newState = { ...prev };
      delete newState[instanceId];
      return newState;
    });
    
    if (socketRef.current) {
      const eventName = `client_status_${instanceId}`;
      socketRef.current.removeAllListeners(eventName);
    }
  }, []);

  // NOVO v2.0: Auto-verificação mais inteligente a cada 15 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      activeConnections.current.forEach(instanceId => {
        const currentStatus = instanceStates[instanceId];
        
        // Só verificar se NÃO estiver realmente conectado e não estiver em processo de conexão
        if (!currentStatus?.reallyConnected && 
            currentStatus?.status !== 'connected' && 
            currentStatus?.status !== 'connecting') {
          console.log(`🔄 [MANAGER v2.0] Auto-verificação inteligente de ${instanceId}`);
          refreshInstanceStatus(instanceId).catch(console.error);
        }
      });
    }, 15000); // Verificar a cada 15 segundos

    return () => clearInterval(interval);
  }, [instanceStates, refreshInstanceStatus]);

  const value = {
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup,
    refreshInstanceStatus,
    forceReconnectInstance
  };

  return (
    <InstanceManagerContext.Provider value={value}>
      {children}
    </InstanceManagerContext.Provider>
  );
};

export const useInstanceManager = (): InstanceManagerContextType => {
  const context = useContext(InstanceManagerContext);
  if (!context) {
    throw new Error('useInstanceManager must be used within an InstanceManagerProvider');
  }
  return context;
};
