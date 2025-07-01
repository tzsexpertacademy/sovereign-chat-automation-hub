
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
  
  // Cache inteligente para evitar polling desnecessário
  const lastStatusCheck = useRef<Record<string, number>>({});
  const connectedInstances = useRef<Set<string>>(new Set());
  
  // Socket único reutilizado
  const socketRef = useRef<any>(null);
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Inicializar WebSocket uma única vez
  useEffect(() => {
    console.log('🔌 Inicializando InstanceManager definitivo...');
    
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
      // Limpar todos os intervalos
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
    };
  }, []);

  // Função para polling inteligente - SUPER OTIMIZADA
  const startIntelligentPolling = useCallback((instanceId: string) => {
    // Parar polling existente
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
    }

    // Não fazer polling para instâncias definitivamente conectadas
    const currentStatus = instanceStates[instanceId];
    if (currentStatus?.status === 'connected' && currentStatus.phoneNumber) {
      const timeSinceStatus = Date.now() - (new Date(currentStatus.timestamp || 0).getTime());
      if (timeSinceStatus > 60000) { // 1 minuto
        console.log(`⚠️ [POLLING-INTELIGENTE] Instância ${instanceId} conectada há ${Math.round(timeSinceStatus/1000)}s - parando polling`);
        connectedInstances.current.add(instanceId);
        return;
      }
    }

    console.log(`🔄 [POLLING-INTELIGENTE] Iniciando para ${instanceId}`);
    
    pollingIntervals.current[instanceId] = setInterval(async () => {
      try {
        // Cache ultra-inteligente: não verificar se checou há menos de 30s
        const lastCheck = lastStatusCheck.current[instanceId] || 0;
        const timeSinceLastCheck = Date.now() - lastCheck;
        
        if (timeSinceLastCheck < 30000) { // 30 segundos
          return;
        }

        const status = await whatsappService.getClientStatus(instanceId);
        lastStatusCheck.current[instanceId] = Date.now();
        
        console.log(`📊 [POLLING-INTELIGENTE] Status ${instanceId}:`, status.status, status.phoneNumber || 'no-phone');
        
        // Atualizar estado apenas se mudou SIGNIFICATIVAMENTE
        setInstanceStates(prev => {
          const current = prev[instanceId];
          if (!current || 
              current.status !== status.status || 
              current.phoneNumber !== status.phoneNumber ||
              current.hasQrCode !== status.hasQrCode) {
            
            console.log(`🔄 [POLLING-INTELIGENTE] Estado mudou para ${instanceId}:`, {
              de: current?.status || 'undefined',
              para: status.status,
              phone: status.phoneNumber || 'no-phone'
            });
            
            return {
              ...prev,
              [instanceId]: {
                status: status.status,
                phoneNumber: status.phoneNumber,
                hasQrCode: status.hasQrCode,
                qrCode: status.qrCode,
                timestamp: status.timestamp
              }
            };
          }
          return prev;
        });

        // Parar polling se definitivamente conectado
        if (status.status === 'connected' && status.phoneNumber) {
          console.log(`✅ [POLLING-INTELIGENTE] ${instanceId} definitivamente conectado - parando polling`);
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
          connectedInstances.current.add(instanceId);
        }
        
      } catch (error) {
        console.error(`❌ [POLLING-INTELIGENTE] Erro para ${instanceId}:`, error);
      }
    }, 45000); // 45 segundos entre verificações - MUITO REDUZIDO
  }, [instanceStates]);

  // WebSocket listener DEFINITIVO
  const setupWebSocketListener = useCallback((instanceId: string) => {
    if (!socketRef.current) return;

    console.log(`👂 [WEBSOCKET] Configurando listener para ${instanceId}`);
    
    // Entrar na sala
    whatsappService.joinClientRoom(instanceId);
    
    // Listener específico
    const eventName = `client_status_${instanceId}`;
    
    const statusHandler = (data: any) => {
      console.log(`📡 [WEBSOCKET] Status recebido ${instanceId}:`, data.status, data.phoneNumber || 'no-phone');
      
      // Atualizar estado imediatamente - PRIORIDADE MÁXIMA
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: {
          status: data.status,
          phoneNumber: data.phoneNumber,
          hasQrCode: data.hasQrCode,
          qrCode: data.qrCode,
          timestamp: data.timestamp
        }
      }));

      // Parar polling se conectado via WebSocket - DEFINITIVO
      if (data.status === 'connected' && data.phoneNumber) {
        console.log(`✅ [WEBSOCKET] ${instanceId} conectado - parando polling DEFINITIVAMENTE`);
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        connectedInstances.current.add(instanceId);
      }
    };

    socketRef.current.off(eventName, statusHandler); // Remove listener anterior
    socketRef.current.on(eventName, statusHandler);
    
    return () => {
      socketRef.current?.off(eventName, statusHandler);
    };
  }, []);

  const connectInstance = useCallback(async (instanceId: string) => {
    console.log(`🚀 [CONNECT] Iniciando conexão ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      // Configurar WebSocket listener primeiro - PRIORIDADE
      setupWebSocketListener(instanceId);
      
      // Chamar API de conexão
      await whatsappService.connectClient(instanceId);
      
      // Iniciar polling inteligente apenas como backup
      setTimeout(() => {
        if (!connectedInstances.current.has(instanceId)) {
          console.log(`🔄 [BACKUP] Iniciando polling backup para ${instanceId}`);
          startIntelligentPolling(instanceId);
        }
      }, 10000); // 10 segundos de delay para WebSocket agir
      
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
  }, [setupWebSocketListener, startIntelligentPolling, toast]);

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
