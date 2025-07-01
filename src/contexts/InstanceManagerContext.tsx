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
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 3;

  // 🔧 NOVA FUNCIONALIDADE v2.3: Gerenciamento robusto de WebSocket
  const initializeWebSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('✅ [MANAGER v2.3] WebSocket já conectado');
      return;
    }

    console.log('🔌 [MANAGER v2.3] Inicializando WebSocket otimizado...');
    
    try {
      socketRef.current = whatsappService.connectSocket();
      
      if (socketRef.current) {
        socketRef.current.on('connect', () => {
          console.log('✅ [MANAGER v2.3] WebSocket conectado - CONNECTION POOL otimizado');
          setWebsocketConnected(true);
          reconnectAttempts.current = 0;
          
          // Reentrar nas salas ativas
          activeConnections.current.forEach(instanceId => {
            whatsappService.joinClientRoom(instanceId);
          });
        });

        socketRef.current.on('disconnect', (reason: string) => {
          console.log(`❌ [MANAGER v2.3] WebSocket desconectado: ${reason}`);
          setWebsocketConnected(false);
          
          // 🔧 NOVA LÓGICA: Só reconectar se não foi intencional
          if (reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(`🔄 [MANAGER v2.3] Tentativa de reconexão ${reconnectAttempts.current}/${maxReconnectAttempts}`);
            
            setTimeout(() => {
              if (!socketRef.current?.connected) {
                initializeWebSocket();
              }
            }, 3000 * reconnectAttempts.current); // Backoff exponencial
          }
        });

        socketRef.current.on('connect_error', (error: any) => {
          console.error('❌ [MANAGER v2.3] Erro WebSocket:', error.message);
          setWebsocketConnected(false);
        });
      }
    } catch (error) {
      console.error('❌ [MANAGER v2.3] Erro ao inicializar WebSocket:', error);
      setWebsocketConnected(false);
    }
  }, []);

  // 🔧 NOVA FUNCIONALIDADE v2.3: Polling inteligente com menos requisições
  const startIntelligentPolling = useCallback((instanceId: string) => {
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
    }

    console.log(`🧠 [MANAGER v2.3] Iniciando polling INTELIGENTE para ${instanceId}`);
    
    let pollCount = 0;
    const maxPolls = 120; // 10 minutos máximo
    
    pollingIntervals.current[instanceId] = setInterval(async () => {
      try {
        pollCount++;
        
        const currentStatus = instanceStates[instanceId];
        
        // 🔧 PARAR polling se conectado ou ultrapassou limite
        if (currentStatus?.reallyConnected || 
            currentStatus?.status === 'connected' || 
            pollCount > maxPolls) {
          console.log(`🛑 [MANAGER v2.3] Parando polling para ${instanceId} - ${currentStatus?.status || 'timeout'}`);
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
          return;
        }
        
        // 🔧 POLLING MENOS AGRESSIVO: 5s → 10s → 15s
        const interval = pollCount < 12 ? 5000 : pollCount < 24 ? 10000 : 15000;
        
        await refreshInstanceStatus(instanceId);
        
      } catch (error) {
        console.error(`❌ [MANAGER v2.3] Erro no polling inteligente ${instanceId}:`, error);
        
        // 🔧 PARAR polling em caso de erro 404 (cliente não existe)
        if (error?.message?.includes('404')) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
          await handleClientNotFound(instanceId);
        }
      }
    }, 5000); // Começar com 5s
  }, [instanceStates]);

  // 🔧 MELHORADA v2.3: Detecção de cliente não encontrado
  const handleClientNotFound = useCallback(async (instanceId: string) => {
    console.log(`🔍 [MANAGER v2.3] Cliente não encontrado no servidor: ${instanceId}`);
    
    // Parar polling
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
      delete pollingIntervals.current[instanceId];
    }
    
    // Limpar estados
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
    delete retryCounters.current[instanceId];
    
    console.log(`✅ [MANAGER v2.3] Cliente ${instanceId} marcado como desconectado`);
    
    toast({
      title: "Cliente Desconectado",
      description: `Cliente ${instanceId} não existe no servidor. Você pode reconectar para criar nova instância.`,
      variant: "destructive",
    });
  }, [toast]);

  // 🔧 MELHORADA v2.3: Verificação de conexão real sem usar /chats
  const checkRealConnection = useCallback(async (instanceId: string, currentStatus: InstanceStatus): Promise<boolean> => {
    try {
      console.log(`🧠 [MANAGER v2.3] Verificando conexão real: ${instanceId}`);
      
      // 1. Telefone válido = conectado
      if (currentStatus.phoneNumber && 
          currentStatus.phoneNumber !== 'null' && 
          currentStatus.phoneNumber.length > 5) {
        console.log(`✅ [MANAGER v2.3] ${instanceId} tem telefone válido: ${currentStatus.phoneNumber}`);
        return true;
      }

      // 2. Status connected = conectado
      if (currentStatus.status === 'connected') {
        console.log(`✅ [MANAGER v2.3] ${instanceId} status connected`);
        return true;
      }

      // 3. Status authenticated = conectado
      if (currentStatus.status === 'authenticated') {
        console.log(`🔐 [MANAGER v2.3] ${instanceId} authenticated`);
        return true;
      }

      return false;
      
    } catch (error) {
      console.error(`❌ [MANAGER v2.3] Erro ao verificar conexão real ${instanceId}:`, error);
      return false;
    }
  }, []);

  // 🔧 MELHORADA v2.3: Refresh status com controle de requisições
  const refreshInstanceStatus = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 [MANAGER v2.3] Verificando status: ${instanceId}`);
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
      
      // Verificar se realmente está conectado
      newStatus.reallyConnected = await checkRealConnection(instanceId, newStatus);
      
      // Log mudanças importantes
      if (statusChanged) {
        console.log(`📱 [MANAGER v2.3] Status mudou ${instanceId}: ${previous?.status || 'N/A'} → ${status.status}`);
      }

      // Forçar status connected se realmente conectado
      if (newStatus.reallyConnected && status.status !== 'connected') {
        console.log(`🎉 [MANAGER v2.3] ${instanceId} REALMENTE CONECTADO! Corrigindo status`);
        newStatus.status = 'connected';
      }
      
      setInstanceStates(prev => ({
        ...prev,
        [instanceId]: newStatus
      }));
      
      // Se conectou, parar polling
      if (newStatus.reallyConnected || (status.status === 'connected' && status.phoneNumber)) {
        console.log(`🎉 [MANAGER v2.3] ${instanceId} CONECTADO! Parando polling`);
        
        if (pollingIntervals.current[instanceId]) {
          clearInterval(pollingIntervals.current[instanceId]);
          delete pollingIntervals.current[instanceId];
        }
        
        toast({
          title: "WhatsApp Conectado! 🎉",
          description: `v2.3: ${status.phoneNumber || 'Telefone detectado'}`,
        });
      }
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.3] Erro ao verificar status ${instanceId}:`, error);
      
      // Detectar cliente não encontrado
      if (error.message.includes('404') || error.message.includes('não encontrado')) {
        await handleClientNotFound(instanceId);
        return;
      }
      
      throw error;
    }
  }, [instanceStates, checkRealConnection, toast, handleClientNotFound]);

  // Inicializar WebSocket
  useEffect(() => {
    console.log('🔌 [MANAGER v2.3] Inicializando InstanceManager com CONNECTION POOL otimizado...');
    
    initializeWebSocket();

    return () => {
      console.log('🧹 [MANAGER v2.3] Limpando InstanceManager...');
      Object.values(pollingIntervals.current).forEach(clearInterval);
      pollingIntervals.current = {};
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initializeWebSocket]);

  // 🔧 NOVA FUNCIONALIDADE v2.3: Auto-verificação menos agressiva
  useEffect(() => {
    const interval = setInterval(() => {
      // Só verificar se há conexões ativas mas não conectadas
      const instancesToCheck = Array.from(activeConnections.current).filter(instanceId => {
        const currentStatus = instanceStates[instanceId];
        return !currentStatus?.reallyConnected && 
               currentStatus?.status !== 'connected' &&
               currentStatus?.status !== 'connecting';
      });

      if (instancesToCheck.length > 0) {
        console.log(`🔄 [MANAGER v2.3] Auto-verificação de ${instancesToCheck.length} instâncias`);
        
        // Verificar apenas uma por vez para evitar spam
        const instanceToCheck = instancesToCheck[0];
        refreshInstanceStatus(instanceToCheck).catch(console.error);
      }
    }, 30000); // 30 segundos em vez de 15

    return () => clearInterval(interval);
  }, [instanceStates, refreshInstanceStatus]);

  const connectInstance = useCallback(async (instanceId: string) => {
    console.log(`🚀 [MANAGER v2.3] Conectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      retryCounters.current[instanceId] = 0;
      
      // Garantir WebSocket conectado
      if (!socketRef.current?.connected) {
        initializeWebSocket();
      }
      
      // Configurar listener WebSocket
      if (socketRef.current?.connected) {
        whatsappService.joinClientRoom(instanceId);
        
        const eventName = `client_status_${instanceId}`;
        const statusHandler = (data: any) => {
          console.log(`📡 [MANAGER v2.3] Status WebSocket ${instanceId}:`, data.status);
          
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
            console.log(`✅ [MANAGER v2.3] ${instanceId} conectado via WebSocket`);
            if (pollingIntervals.current[instanceId]) {
              clearInterval(pollingIntervals.current[instanceId]);
              delete pollingIntervals.current[instanceId];
            }
            
            toast({
              title: "WhatsApp Conectado! 🎉",
              description: `v2.3: ${data.phoneNumber || 'Telefone detectado'}`,
            });
          }
        };

        socketRef.current.off(eventName, statusHandler);
        socketRef.current.on(eventName, statusHandler);
      }
      
      // Chamar API de conexão
      await whatsappService.connectClient(instanceId);
      
      // Verificar status inicial
      setTimeout(() => {
        refreshInstanceStatus(instanceId);
      }, 2000);
      
      // Iniciar polling inteligente
      setTimeout(() => {
        startIntelligentPolling(instanceId);
      }, 3000);
      
      activeConnections.current.add(instanceId);
      
      toast({
        title: "Conectando... 🚀",
        description: `v2.3 CONNECTION POOL otimizado: ${instanceId}`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.3] Erro ao conectar ${instanceId}:`, error);
      
      if (error.message.includes('404') || error.message.includes('não encontrado')) {
        await handleClientNotFound(instanceId);
      }
      
      toast({
        title: "Erro na Conexão",
        description: `v2.3: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [instanceStates, initializeWebSocket, refreshInstanceStatus, startIntelligentPolling, toast, handleClientNotFound]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    console.log(`🔌 [MANAGER v2.3] Desconectando instância: ${instanceId}`);
    
    try {
      setLoadingStates(prev => ({ ...prev, [instanceId]: true }));
      
      // Parar polling
      if (pollingIntervals.current[instanceId]) {
        clearInterval(pollingIntervals.current[instanceId]);
        delete pollingIntervals.current[instanceId];
      }
      
      try {
        await whatsappService.disconnectClient(instanceId);
        console.log(`✅ [MANAGER v2.3] ${instanceId} desconectado com sucesso`);
      } catch (error: any) {
        console.warn(`⚠️ [MANAGER v2.3] Erro ao desconectar ${instanceId} (ignorando):`, error.message);
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
        description: `v2.3: ${instanceId} desconectado`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.3] Erro ao desconectar ${instanceId}:`, error);
      toast({
        title: "Erro",
        description: `v2.3: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast]);

  const forceReconnectInstance = useCallback(async (instanceId: string): Promise<void> => {
    try {
      console.log(`🔄 [MANAGER v2.3] Forçando reconexão: ${instanceId}`);
      
      const currentStatus = instanceStates[instanceId];
      
      if (currentStatus?.reallyConnected) {
        console.log(`✅ [MANAGER v2.3] ${instanceId} realmente conectado - cancelando reconexão`);
        toast({
          title: "Reconexão Cancelada",
          description: "v2.3 detectou que a instância já está conectada",
        });
        return;
      }
      
      retryCounters.current[instanceId] = (retryCounters.current[instanceId] || 0) + 1;
      
      // Parar polling
      if (pollingIntervals.current[instanceId]) {
        clearInterval(pollingIntervals.current[instanceId]);
        delete pollingIntervals.current[instanceId];
      }
      
      // Tentar desconectar
      try {
        await whatsappService.disconnectClient(instanceId);
      } catch (disconnectError: any) {
        console.warn(`⚠️ [MANAGER v2.3] Erro ao desconectar ${instanceId} (ignorando)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reconectar
      await whatsappService.connectClient(instanceId);
      
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
      
      setTimeout(() => {
        startIntelligentPolling(instanceId);
      }, 2000);
      
      toast({
        title: "Reconectando... 🔄",
        description: `v2.3 CONNECTION POOL otimizado (tentativa ${retryCounters.current[instanceId]})`,
      });
      
    } catch (error: any) {
      console.error(`❌ [MANAGER v2.3] Erro na reconexão ${instanceId}:`, error);
      toast({
        title: "Erro na Reconexão",
        description: `v2.3: ${error.message}`,
        variant: "destructive",
      });
    }
  }, [instanceStates, startIntelligentPolling, toast]);

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
    console.log(`🧹 [MANAGER v2.3] Limpando instância: ${instanceId}`);
    
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
