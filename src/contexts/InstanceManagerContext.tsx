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
}

const InstanceManagerContext = createContext<InstanceManagerContextType | undefined>(undefined);

export const InstanceManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // Estados centralizados
  const [instanceStates, setInstanceStates] = useState<Record<string, InstanceStatus>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  
  // Cache inteligente para evitar chamadas desnecessárias
  const lastStatusCheck = useRef<Record<string, number>>({});
  const connectedInstances = useRef<Set<string>>(new Set());
  
  // Socket único reutilizado
  const socketRef = useRef<any>(null);
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Inicializar WebSocket uma única vez
  useEffect(() => {
    console.log('🔌 Inicializando InstanceManager DEFINITIVO...');
    
    if (!socketRef.current) {
      socketRef.current = whatsappService.connectSocket();
      
      if (socketRef.current) {
        socketRef.current.on('connect', () => {
          console.log('✅ WebSocket InstanceManager conectado');
          setWebsocketConnected(true);
        });

        socketRef.current.on('disconnect', () => {
          console.log('❌ WebSocket InstanceManager desconectado');
          setWebsocketConnected(false);
        });
      }
    }

    return () => {
      console.log('🧹 Limpando InstanceManager...');
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
    };
  }, []);

  // Função para atualização IMEDIATA de status
  const updateInstanceStatusImmediate = useCallback((instanceId: string, statusData: InstanceStatus) => {
    console.log(`⚡ [IMMEDIATE-UPDATE] ${instanceId}:`, statusData);
    
    setInstanceStates(prev => {
      const current = prev[instanceId];
      
      // Só atualizar se houve mudança significativa
      if (!current || 
          current.status !== statusData.status || 
          current.phoneNumber !== statusData.phoneNumber ||
          current.hasQrCode !== statusData.hasQrCode) {
        
        console.log(`🔄 [STATE-CHANGE] ${instanceId}:`, {
          de: current?.status || 'undefined',
          para: statusData.status,
          phone: statusData.phoneNumber || 'none'
        });
        
        // Se conectou, parar polling
        if (statusData.status === 'connected' && statusData.phoneNumber) {
          console.log(`✅ [CONNECTED] ${instanceId} - PARANDO polling definitivamente`);
          if (pollingIntervals.current[instanceId]) {
            clearInterval(pollingIntervals.current[instanceId]);
            delete pollingIntervals.current[instanceId];
          }
          connectedInstances.current.add(instanceId);
        }
        
        return {
          ...prev,
          [instanceId]: {
            ...statusData,
            timestamp: statusData.timestamp || new Date().toISOString()
          }
        };
      }
      
      return prev;
    });
  }, []);

  // Função para polling APENAS como backup
  const startBackupPolling = useCallback((instanceId: string) => {
    // Não fazer polling se já conectado
    if (connectedInstances.current.has(instanceId)) {
      console.log(`⚠️ [POLLING-SKIP] ${instanceId} já conectado - não fazendo polling`);
      return;
    }

    console.log(`🔄 [BACKUP-POLLING] Iniciando para ${instanceId}`);
    
    // Parar polling existente
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
    }
    
    pollingIntervals.current[instanceId] = setInterval(async () => {
      try {
        // Não verificar se já conectado
        const currentStatus = instanceStates[instanceId];
        if (currentStatus?.status === 'connected' && currentStatus.phoneNumber) {
          console.log(`✅ [BACKUP-POLLING] ${instanceId} conectado - parando polling`);
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
          return;
        }

        // Cache: não verificar se checou há menos de 15s
        const lastCheck = lastStatusCheck.current[instanceId] || 0;
        const timeSinceLastCheck = Date.now() - lastCheck;
        
        if (timeSinceLastCheck < 15000) { // 15 segundos
          return;
        }

        console.log(`📊 [BACKUP-POLLING] Verificando ${instanceId}...`);
        const status = await whatsappService.getClientStatus(instanceId);
        lastStatusCheck.current[instanceId] = Date.now();
        
        // Atualizar estado apenas se mudou
        updateInstanceStatusImmediate(instanceId, {
          status: status.status,
          phoneNumber: status.phoneNumber,
          hasQrCode: status.hasQrCode,
          qrCode: status.qrCode,
          timestamp: status.timestamp
        });
        
      } catch (error) {
        console.error(`❌ [BACKUP-POLLING] Erro para ${instanceId}:`, error);
      }
    }, 20000); // 20 segundos - REDUZIDO drasticamente
  }, [instanceStates, updateInstanceStatusImmediate]);

  // WebSocket listener PRIORITÁRIO
  const setupWebSocketListener = useCallback((instanceId: string) => {
    if (!socketRef.current) return;

    console.log(`👂 [WEBSOCKET-PRIORITY] Configurando para ${instanceId}`);
    
    // Entrar na sala
    whatsappService.joinClientRoom(instanceId);
    
    // Listener específico
    const eventName = `client_status_${instanceId}`;
    
    const statusHandler = (data: any) => {
      console.log(`📡 [WEBSOCKET-PRIORITY] Status recebido ${instanceId}:`, data);
      
      // Atualizar estado IMEDIATAMENTE - PRIORIDADE MÁXIMA
      updateInstanceStatusImmediate(instanceId, {
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: data.hasQrCode,
        qrCode: data.qrCode,
        timestamp: data.timestamp
      });

      // Se conectado via WebSocket, parar polling DEFINITIVAMENTE
      if (data.status === 'connected' && data.phoneNumber) {
        console.log(`✅ [WEBSOCKET-PRIORITY] ${instanceId} conectado - parando polling`);
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        connectedInstances.current.add(instanceId);
      }
    };

    socketRef.current.off(eventName, statusHandler);
    socketRef.current.on(eventName, statusHandler);
    
    return () => {
      socketRef.current?.off(eventName, statusHandler);
    };
  }, [updateInstanceStatusImmediate]);

  const connectInstance = useCallback(async (instanceId: string) => {
    console.log(`🚀 [CONNECT] Iniciando conexão ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      // 1. Configurar WebSocket listener PRIMEIRO
      setupWebSocketListener(instanceId);
      
      // 2. Chamar API de conexão
      await whatsappService.connectClient(instanceId);
      
      // 3. Verificar status inicial IMEDIATAMENTE
      setTimeout(async () => {
        try {
          const initialStatus = await whatsappService.getClientStatus(instanceId);
          updateInstanceStatusImmediate(instanceId, {
            status: initialStatus.status,
            phoneNumber: initialStatus.phoneNumber,
            hasQrCode: initialStatus.hasQrCode,
            qrCode: initialStatus.qrCode,
            timestamp: initialStatus.timestamp
          });
        } catch (error) {
          console.error(`❌ [INITIAL-STATUS] Erro ${instanceId}:`, error);
        }
      }, 2000);
      
      // 4. Iniciar polling backup apenas se não conectar via WebSocket em 15s
      setTimeout(() => {
        const currentStatus = instanceStates[instanceId];
        if (!currentStatus || currentStatus.status !== 'connected') {
          console.log(`🔄 [BACKUP] Iniciando polling backup para ${instanceId}`);
          startBackupPolling(instanceId);
        }
      }, 15000);
      
      toast({
        title: "Conectando...",
        description: `Instância ${instanceId} iniciando conexão`,
      });
      
    } catch (error: any) {
      console.error(`❌ [CONNECT] Erro ${instanceId}:`, error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [setupWebSocketListener, startBackupPolling, toast, instanceStates, updateInstanceStatusImmediate]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    console.log(`🔌 [DISCONNECT] Desconectando ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      await whatsappService.disconnectClient(instanceId);
      
      // Limpar estado local DEFINITIVAMENTE
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
      
      toast({
        title: "Desconectado",
        description: `Instância ${instanceId} desconectada`,
      });
      
    } catch (error: any) {
      console.error(`❌ [DISCONNECT] Erro ${instanceId}:`, error);
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
    
    // Retornar estado padrão se não existir
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
    console.log(`🧹 [CLEANUP] Limpando ${instanceId}`);
    
    // Parar polling DEFINITIVAMENTE
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
      delete pollingIntervals.current[instanceId];
    }
    
    // Remover do cache de conectados
    connectedInstances.current.delete(instanceId);
    
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

  const value = {
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
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
