
import { useState, useEffect } from 'react';
import { serverConfigService, ServerConfig, ServerStatus } from '@/services/serverConfigService';

export const useServerConfig = () => {
  const [config, setConfig] = useState<ServerConfig>(serverConfigService.getConfig());
  const [status, setStatus] = useState<ServerStatus>(serverConfigService.getStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = serverConfigService.subscribe((newConfig) => {
      setConfig(newConfig);
    });

    // Verificar status inicial
    testConnection();

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

  const saveConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const success = serverConfigService.saveConfigExplicitly();
      if (success) {
        setConfig(serverConfigService.getConfig());
      }
      return success;
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      console.log(`🔍 [SERVER-CONFIG] Testando conexão com ${config.serverUrl}`);
      
      // Usar endpoint /docs que sabemos que existe na v2.2.1
      const response = await fetch(`${config.serverUrl}/docs`, {
        method: 'GET',
        mode: 'no-cors', // Evitar problemas de CORS para teste básico
        cache: 'no-cache'
      });
      
      // Para modo no-cors, não conseguimos ler a resposta, mas se não houve erro, servidor está respondendo
      console.log(`✅ [SERVER-CONFIG] Servidor respondeu, considerando online`);
      
      const newStatus: ServerStatus = {
        isOnline: true,
        lastCheck: new Date().toISOString(),
        latency: 0, // Não podemos medir latência em modo no-cors
      };
      setStatus(newStatus);
      
      return newStatus;
    } catch (error: any) {
      console.error(`❌ [SERVER-CONFIG] Erro ao testar conexão:`, error);
      
      const newStatus: ServerStatus = {
        isOnline: false,
        lastCheck: new Date().toISOString(),
        latency: 0,
        error: error.message
      };
      
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

  const rollbackConfig = () => {
    const success = serverConfigService.rollbackConfig();
    if (success) {
      setConfig(serverConfigService.getConfig());
    }
    return success;
  };

  return {
    config,
    status,
    isLoading,
    isSaving,
    updateConfig,
    saveConfig,
    testConnection,
    validateConfig,
    exportConfig,
    importConfig,
    resetToDefaults,
    rollbackConfig,
    // Convenience getters
    apiUrl: serverConfigService.getApiUrl(),
    webSocketUrl: serverConfigService.getWebSocketUrl(),
    headers: serverConfigService.getHeaders(),
    frontendIntegration: serverConfigService.getFrontendIntegrationInfo()
  };
};
