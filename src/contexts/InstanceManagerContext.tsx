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
    console.log('🔌 [MANAGER] Inicializando InstanceManager...');
    
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

  // Detectar se instância está presa
  const detectStuckInstance = useCallback((instanceId: string, currentStatus: InstanceStatus): boolean => {
    const previous = instanceStates[instanceId];
    
    if (!previous || !previous.lastStatusChange) return false;
    
    const timeSinceLastChange = Date.now() - previous.lastStatusChange.getTime();
    const isStuckInQrReady = currentStatus.status === 'qr_ready' && timeSinceLastChange > 90000; // 1.5 minutos
    
    if (isStuckInQrReady) {
      console.log(`⚠️ [MANAGER] Instância ${instanceId} presa em qr_ready há ${Math.round(timeSinceLastChange / 1000)}s`);
      return true;
    }
    
    return false;
  }, [instanceStates]);

  // Função para verificar status via API (MELHORADA)
  const refreshInstanceStatus = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 [MANAGER] Verificando status: ${instanceId}`);
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
        isStuck: false
      };
      
      // Detectar se está preso
      newStatus.isStuck = detectStuckInstance(instanceId, newStatus);
      
      // Log mudanças importantes
      if (statusChanged) {
        console.log(`📱 [MANAGER] Status mudou ${instanceId}: ${previous?.status || 'N/A'} → ${status.status}`);
      }
      
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: newStatus
      }));
      
      // Se conectou com sucesso
      if (status.status === 'connected' && status.phoneNumber) {
        console.log(`🎉 [MANAGER] ${instanceId} CONECTADO! Telefone: ${status.phoneNumber}`);
        
        // Parar polling
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        
        toast({
          title: "WhatsApp Conectado!",
          description: `Instância conectada: ${status.phoneNumber}`,
        });
      }
      
      // Se detectou que está preso, tentar reconectar automaticamente
      if (newStatus.isStuck && newStatus.retryCount < 3) {
        console.log(`🔄 [MANAGER] Auto-correção: reconectando ${instanceId}`);
        setTimeout(() => {
          forceReconnectInstance(instanceId);
        }, 2000);
      }
      
    } catch (error) {
      console.error(`❌ [MANAGER] Erro ao verificar status ${instanceId}:`, error);
      throw error;
    }
  }, [instanceStates, detectStuckInstance, toast]);

  // Forçar reconexão limpa
  const forceReconnectInstance = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 [MANAGER] Forçando reconexão: ${instanceId}`);
      
      // Incrementar contador de retry
      retryCounters.current[instanceId] = (retryCounters.current[instanceId] || 0) + 1;
      
      // Parar polling atual
      if (pollingIntervals.current[instanceId]) {
        clearInterval(pollingIntervals.current[instanceId]);
        delete pollingIntervals.current[instanceId];
      }
      
      // Desconectar (limpar sessão)
      await whatsappService.disconnectClient(instanceId);
      console.log(`🔌 [MANAGER] ${instanceId} desconectado`);
      
      // Aguardar 3 segundos
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reconectar
      await whatsappService.connectClient(instanceId);
      console.log(`🚀 [MANAGER] ${instanceId} reconectando...`);
      
      // Atualizar estado
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'connecting',
          retryCount: retryCounters.current[instanceId],
          lastStatusChange: new Date(),
          isStuck: false
        }
      }));
      
      // Iniciar polling mais agressivo após reconexão
      setTimeout(() => {
        startPolling(instanceId, 3000); // Polling a cada 3 segundos
      }, 2000);
      
      toast({
        title: "Reconectando...",
        description: `Sessão limpa, aguarde novo QR Code (tentativa ${retryCounters.current[instanceId]})`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER] Erro na reconexão ${instanceId}:`, error);
      toast({
        title: "Erro na Reconexão",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Configurar listener WebSocket
  const setupWebSocketListener = useCallback((instanceId: string) => {
    if (!socketRef.current) return;

    console.log(`👂 [MANAGER] Configurando listener para ${instanceId}`);
    
    whatsappService.joinClientRoom(instanceId);
    
    const eventName = `client_status_${instanceId}`;
    
    const statusHandler = (data: any) => {
      console.log(`📡 [MANAGER] Status WebSocket ${instanceId}:`, data.status);
      
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
        isStuck: false
      };
      
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: newStatus
      }));

      // Se conectou, parar polling
      if (data.status === 'connected' && data.phoneNumber) {
        console.log(`✅ [MANAGER] ${instanceId} conectado via WebSocket`);
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        
        toast({
          title: "WhatsApp Conectado!",
          description: `Instância conectada: ${data.phoneNumber}`,
        });
      }
    };

    socketRef.current.off(eventName, statusHandler);
    socketRef.current.on(eventName, statusHandler);
  }, [instanceStates, toast]);

  // Polling melhorado com detecção de problemas
  const startPolling = useCallback((instanceId: string, interval: number = 5000) => {
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
    }

    console.log(`🔄 [MANAGER] Iniciando polling para ${instanceId} (${interval}ms)`);
    
    pollingIntervals.current[instanceId] = setInterval(async () => {
      try {
        await refreshInstanceStatus(instanceId);
        
        const currentStatus = instanceStates[instanceId];
        if (currentStatus?.status === 'connected' && currentStatus?.phoneNumber) {
          console.log(`✅ [MANAGER] ${instanceId} conectado - parando polling`);
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
      } catch (error) {
        console.error(`❌ [MANAGER] Erro no polling ${instanceId}:`, error);
      }
    }, interval);
  }, [refreshInstanceStatus, instanceStates]);

  const connectInstance = useCallback(async (instanceId: string) => {
    console.log(`🚀 [MANAGER] Conectando instância: ${instanceId}`);
    
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
        title: "Conectando...",
        description: `Instância ${instanceId} iniciando conexão`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER] Erro ao conectar ${instanceId}:`, error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [setupWebSocketListener, refreshInstanceStatus, startPolling, toast]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    console.log(`🔌 [MANAGER] Desconectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      await whatsappService.disconnectClient(instanceId);
      
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
          isStuck: false
        }
      }));
      
      activeConnections.current.delete(instanceId);
      
      toast({
        title: "Desconectado",
        description: `Instância ${instanceId} desconectada`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER] Erro ao desconectar ${instanceId}:`, error);
      toast({
        title: "Erro",
        description: error.message,
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
      isStuck: false
    };
  }, [instanceStates]);

  const isLoading = useCallback((instanceId: string): boolean => {
    return loadingStates[instanceId] || false;
  }, [loadingStates]);

  const cleanup = useCallback((instanceId: string) => {
    console.log(`🧹 [MANAGER] Limpando instância: ${instanceId}`);
    
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

  // Auto-verificar status das conexões ativas a cada 15 segundos (MAIS FREQUENTE)
  useEffect(() => {
    const interval = setInterval(() => {
      activeConnections.current.forEach(instanceId => {
        const currentStatus = instanceStates[instanceId];
        if (!currentStatus?.phoneNumber || currentStatus?.status !== 'connected') {
          console.log(`🔄 [MANAGER] Auto-verificando status de ${instanceId}`);
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
