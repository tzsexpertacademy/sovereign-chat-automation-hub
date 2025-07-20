
import { useState, useEffect } from 'react';
import { serverConfigService, ServerConfig, ServerStatus } from '@/services/serverConfigService';

export const useServerConfig = () => {
  const [config, setConfig] = useState<ServerConfig>(serverConfigService.getConfig());
  const [status, setStatus] = useState<ServerStatus>(serverConfigService.getStatus());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = serverConfigService.subscribe((newConfig) => {
      setConfig(newConfig);
    });

    return unsubscribe;
  }, []);

  const updateConfig = async (updates: Partial<ServerConfig>) => {
    setIsLoading(true);
    try {
      serverConfigService.updateConfig(updates);
      setConfig(serverConfigService.getConfig());
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const newStatus = await serverConfigService.testConnection();
      setStatus(newStatus);
      return newStatus;
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfig = async () => {
    setIsLoading(true);
    try {
      return await serverConfigService.validateConfiguration();
    } finally {
      setIsLoading(false);
    }
  };

  const exportConfig = () => {
    return serverConfigService.exportConfig();
  };

  const importConfig = (configJson: string) => {
    const success = serverConfigService.importConfig(configJson);
    if (success) {
      setConfig(serverConfigService.getConfig());
    }
    return success;
  };

  const resetToDefaults = () => {
    serverConfigService.resetToDefaults();
    setConfig(serverConfigService.getConfig());
  };

  return {
    config,
    status,
    isLoading,
    updateConfig,
    testConnection,
    validateConfig,
    exportConfig,
    importConfig,
    resetToDefaults,
    // Convenience getters
    apiUrl: serverConfigService.getApiUrl(),
    webSocketUrl: serverConfigService.getWebSocketUrl(),
    headers: serverConfigService.getHeaders()
  };
};
