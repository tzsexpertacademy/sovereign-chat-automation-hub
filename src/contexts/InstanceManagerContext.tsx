
import React, { createContext, useContext, ReactNode, useState, useMemo } from 'react';

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
  const [instances, setInstances] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);

  const contextValue = useMemo(() => ({
    instances,
    loading,
    websocketConnected,
    connectInstance: async (instanceId: string) => {
      console.log('🔍 [InstanceManager] Connecting instance:', instanceId);
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      try {
        // Safe implementation with fallback
        await new Promise(resolve => setTimeout(resolve, 1000));
        setInstances(prev => ({ 
          ...prev, 
          [instanceId]: { id: instanceId, status: 'connected' } 
        }));
      } catch (error) {
        console.error('🚨 [InstanceManager] Connection error:', error);
      } finally {
        setLoading(prev => ({ ...prev, [instanceId]: false }));
      }
    },
    disconnectInstance: async (instanceId: string) => {
      console.log('🔍 [InstanceManager] Disconnecting instance:', instanceId);
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      try {
        setInstances(prev => ({ 
          ...prev, 
          [instanceId]: { id: instanceId, status: 'disconnected' } 
        }));
      } catch (error) {
        console.error('🚨 [InstanceManager] Disconnect error:', error);
      } finally {
        setLoading(prev => ({ ...prev, [instanceId]: false }));
      }
    },
    getInstanceStatus: (instanceId: string) => {
      return instances[instanceId] || { status: 'disconnected' };
    },
    isLoading: (instanceId: string) => {
      return loading[instanceId] || false;
    },
    cleanup: (instanceId: string) => {
      console.log('🔍 [InstanceManager] Cleaning up instance:', instanceId);
      setInstances(prev => {
        const { [instanceId]: removed, ...rest } = prev;
        return rest;
      });
      setLoading(prev => {
        const { [instanceId]: removed, ...rest } = prev;
        return rest;
      });
    },
    refreshStatus: async (instanceId: string) => {
      console.log('🔍 [InstanceManager] Refreshing status:', instanceId);
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('🚨 [InstanceManager] Refresh error:', error);
      } finally {
        setLoading(prev => ({ ...prev, [instanceId]: false }));
      }
    }
  }), [instances, loading, websocketConnected]);

  return (
    <InstanceManagerContext.Provider value={contextValue}>
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
