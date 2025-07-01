import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface InstanceStatus {
  status: string;
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
}

interface InstanceManagerContextType {
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => InstanceStatus;
  isLoading: (instanceId: string) => boolean;
  websocketConnected: boolean;
  cleanup: (instanceId: string) => void;
  refreshInstanceStatus: (instanceId: string) => Promise<void>;
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

  // Inicializar WebSocket com reconexão automática
  useEffect(() => {
    console.log('🔌 Inicializando InstanceManager com WebSocket...');
    
    const initSocket = () => {
      try {
        socketRef.current = whatsappService.connectSocket();
        
        if (socketRef.current) {
          socketRef.current.on('connect', () => {
            console.log('✅ WebSocket InstanceManager conectado');
            setWebsocketConnected(true);
          });

          socketRef.current.on('disconnect', () => {
            console.log('❌ WebSocket InstanceManager desconectado');
            setWebsocketConnected(false);
            
            // Tentar reconectar após 3 segundos
            setTimeout(() => {
              if (!socketRef.current?.connected) {
                console.log('🔄 Tentando reconectar WebSocket...');
                initSocket();
              }
            }, 3000);
          });

          socketRef.current.on('connect_error', (error: any) => {
            console.error('❌ Erro de conexão WebSocket:', error);
            setWebsocketConnected(false);
          });
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar WebSocket:', error);
        setWebsocketConnected(false);
      }
    };

    initSocket();

    return () => {
      console.log('🧹 Limpando InstanceManager...');
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Função para verificar status via API (CORRIGIDA)
  const refreshInstanceStatus = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 Verificando status via API: ${instanceId}`);
      const status = await whatsappService.getClientStatus(instanceId);
      
      console.log(`📊 Status obtido via API para ${instanceId}:`, {
        status: status.status,
        phoneNumber: status.phoneNumber,
        hasQrCode: status.hasQrCode
      });
      
      // FORÇAR atualização do estado mesmo se for igual
      const newStatus = {
        status: status.status,
        phoneNumber: status.phoneNumber,
        hasQrCode: status.hasQrCode,
        qrCode: status.qrCode,
        timestamp: new Date().toISOString()
      };
      
      setInstanceStates(prev => {
        const updated = { ...prev, [instanceId]: newStatus };
        console.log(`📱 Estado atualizado para ${instanceId}:`, updated[instanceId]);
        return updated;
      });
      
      // Se conectou, notificar
      if (status.status === 'connected' && status.phoneNumber) {
        console.log(`🎉 ${instanceId} CONECTADO! Telefone: ${status.phoneNumber}`);
        toast({
          title: "WhatsApp Conectado!",
          description: `Instância conectada: ${status.phoneNumber}`,
        });
      }
      
    } catch (error) {
      console.error(`❌ Erro ao verificar status via API ${instanceId}:`, error);
      throw error;
    }
  }, [toast]);

  // Configurar listener WebSocket para uma instância específica
  const setupWebSocketListener = useCallback((instanceId: string) => {
    if (!socketRef.current) {
      console.warn(`⚠️ WebSocket não disponível para ${instanceId}`);
      return;
    }

    console.log(`👂 Configurando listener WebSocket para ${instanceId}`);
    
    // Entrar na sala da instância
    whatsappService.joinClientRoom(instanceId);
    
    const eventName = `client_status_${instanceId}`;
    
    const statusHandler = (data: any) => {
      console.log(`📡 Status WebSocket recebido para ${instanceId}:`, {
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: data.hasQrCode
      });
      
      const newStatus = {
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: data.hasQrCode,
        qrCode: data.qrCode,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setInstanceStates(prev => {
        const updated = { ...prev, [instanceId]: newStatus };
        console.log(`📱 Estado WebSocket atualizado para ${instanceId}:`, updated[instanceId]);
        return updated;
      });

      // Se conectou com sucesso, parar polling e notificar
      if (data.status === 'connected' && data.phoneNumber) {
        console.log(`✅ ${instanceId} conectado via WebSocket - parando polling`);
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
    
    return () => {
      socketRef.current?.off(eventName, statusHandler);
    };
  }, [toast]);

  // Polling AGRESSIVO como backup (CORRIGIDO)
  const startPolling = useCallback((instanceId: string) => {
    // Parar polling existente
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
    }

    console.log(`🔄 Iniciando polling AGRESSIVO para ${instanceId}`);
    
    pollingIntervals.current[instanceId] = setInterval(async () => {
      try {
        await refreshInstanceStatus(instanceId);
        
        // Verificar se conectou para parar polling
        const currentStatus = instanceStates[instanceId];
        if (currentStatus?.status === 'connected' && currentStatus?.phoneNumber) {
          console.log(`✅ ${instanceId} conectado via polling - parando polling`);
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
      } catch (error) {
        console.error(`❌ Erro no polling ${instanceId}:`, error);
      }
    }, 5000); // Verificar a cada 5 segundos (mais agressivo)
  }, [refreshInstanceStatus, instanceStates]);

  const connectInstance = useCallback(async (instanceId: string) => {
    console.log(`🚀 Conectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      // Configurar WebSocket listener primeiro
      setupWebSocketListener(instanceId);
      
      // Chamar API de conexão
      await whatsappService.connectClient(instanceId);
      
      // Verificar status inicial IMEDIATAMENTE
      setTimeout(() => {
        console.log(`🔍 Verificação inicial de status para ${instanceId}`);
        refreshInstanceStatus(instanceId);
      }, 2000);
      
      // Iniciar polling backup SEMPRE
      setTimeout(() => {
        console.log(`🔄 Iniciando polling backup para ${instanceId}`);
        startPolling(instanceId);
      }, 3000);
      
      activeConnections.current.add(instanceId);
      
      toast({
        title: "Conectando...",
        description: `Instância ${instanceId} iniciando conexão`,
      });
      
    } catch (error: any) {
      console.error(`❌ Erro ao conectar ${instanceId}:`, error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [setupWebSocketListener, startPolling, refreshInstanceStatus, toast]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    console.log(`🔌 Desconectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      await whatsappService.disconnectClient(instanceId);
      
      // Limpar estado local
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: {
          status: 'disconnected',
          phoneNumber: undefined,
          hasQrCode: false,
          qrCode: undefined,
          timestamp: new Date().toISOString()
        }
      }));
      
      activeConnections.current.delete(instanceId);
      
      toast({
        title: "Desconectado",
        description: `Instância ${instanceId} desconectada`,
      });
      
    } catch (error: any) {
      console.error(`❌ Erro ao desconectar ${instanceId}:`, error);
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
    const cached = instanceStates[instanceId];
    
    if (!cached) {
      return {
        status: 'disconnected',
        phoneNumber: undefined,
        hasQrCode: false,
        qrCode: undefined
      };
    }
    
    return cached;
  }, [instanceStates]);

  const isLoading = useCallback((instanceId: string): boolean => {
    return loadingStates[instanceId] || false;
  }, [loadingStates]);

  const cleanup = useCallback((instanceId: string) => {
    console.log(`🧹 Limpando instância: ${instanceId}`);
    
    // Parar polling
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
      delete pollingIntervals.current[instanceId];
    }
    
    // Remover das conexões ativas
    activeConnections.current.delete(instanceId);
    
    // Limpar estado
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
    
    // Remover listener WebSocket
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
          console.log(`🔄 Auto-verificando status de ${instanceId}`);
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
    refreshInstanceStatus
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
