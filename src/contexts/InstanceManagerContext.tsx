import React, { createContext, useContext, useState, useEffect } from 'react';
import { useInstanceManager } from '@/hooks/useInstanceManager';

interface InstanceManagerContextType {
  globalInstanceStatus: Record<string, any>;
  connectGlobalInstance: (instanceId: string) => Promise<void>;
  disconnectGlobalInstance: (instanceId: string) => Promise<void>;
  isGlobalLoading: (instanceId: string) => boolean;
  websocketConnected: boolean;
  refreshInstanceStatus: (instanceId: string) => void;
}

const InstanceManagerContext = createContext<InstanceManagerContextType | null>(null);

export const InstanceManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [globalInstanceStatus, setGlobalInstanceStatus] = useState<Record<string, any>>({});
  
  const {
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
  } = useInstanceManager();

  const connectGlobalInstance = async (instanceId: string) => {
    console.log(`🌐 [GLOBAL] Conectando instância global: ${instanceId}`);
    await connectInstance(instanceId);
    updateGlobalStatus(instanceId);
  };

  const disconnectGlobalInstance = async (instanceId: string) => {
    console.log(`🌐 [GLOBAL] Desconectando instância global: ${instanceId}`);
    await disconnectInstance(instanceId);
    cleanup(instanceId);
    updateGlobalStatus(instanceId);
  };

  const isGlobalLoading = (instanceId: string) => {
    return isLoading(instanceId);
  };

  const updateGlobalStatus = (instanceId: string) => {
    const status = getInstanceStatus(instanceId);
    setGlobalInstanceStatus(prev => ({
      ...prev,
      [instanceId]: status
    }));
  };

  const refreshInstanceStatus = (instanceId: string) => {
    updateGlobalStatus(instanceId);
  };

  // Atualizar status global periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      Object.keys(globalInstanceStatus).forEach(instanceId => {
        updateGlobalStatus(instanceId);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [globalInstanceStatus]);

  return (
    <InstanceManagerContext.Provider value={{
      globalInstanceStatus,
      connectGlobalInstance,
      disconnectGlobalInstance,
      isGlobalLoading,
      websocketConnected,
      refreshInstanceStatus
    }}>
      {children}
    </InstanceManagerContext.Provider>
  );
};

export const useGlobalInstanceManager = () => {
  const context = useContext(InstanceManagerContext);
  if (!context) {
    throw new Error('useGlobalInstanceManager deve ser usado dentro do InstanceManagerProvider');
  }
  return context;
};