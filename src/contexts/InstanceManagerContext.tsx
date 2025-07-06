
import React, { createContext, useContext, ReactNode } from 'react';
import { useSimplifiedInstanceManager } from '@/hooks/useSimplifiedInstanceManager';

interface InstanceManagerContextType {
  instances: Record<string, any>;
  loading: Record<string, boolean>;
  websocketConnected: boolean;
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => any;
  isLoading: (instanceId: string) => boolean;
  cleanup: (instanceId: string) => void;
  refreshStatus: (instanceId: string) => Promise<void>;
}

const InstanceManagerContext = createContext<InstanceManagerContextType | undefined>(undefined);

export const InstanceManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const manager = useSimplifiedInstanceManager();

  return (
    <InstanceManagerContext.Provider value={manager}>
      {children}
    </InstanceManagerContext.Provider>
  );
};

export const useInstanceManager = () => {
  const context = useContext(InstanceManagerContext);
  if (context === undefined) {
    throw new Error('useInstanceManager must be used within an InstanceManagerProvider');
  }
  return context;
};
