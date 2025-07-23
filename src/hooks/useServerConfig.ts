
import { useState, useEffect } from 'react';
import { serverConfigService, ServerConfig, ServerStatus } from '@/services/serverConfigService';

export const useServerConfig = () => {
  const [config, setConfig] = useState<ServerConfig>(serverConfigService.getConfig());
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    lastCheck: new Date().toISOString(),
    latency: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('🔧 [useServerConfig] Hook inicializado');
    
    // Carregar configuração inicial
    const initialConfig = serverConfigService.getConfig();
    setConfig(initialConfig);
    
    // Verificar status do servidor
    checkServerStatus();
    
    // Configurar listeners para mudanças
    const configChangeHandler = (newConfig: ServerConfig) => {
      console.log('📡 [useServerConfig] Configuração atualizada:', newConfig);
      setConfig(newConfig);
    };

    const statusChangeHandler = (newStatus: ServerStatus) => {
      console.log('📊 [useServerConfig] Status atualizado:', newStatus);
      setStatus(newStatus);
    };

    // Adicionar listeners (simulação, já que não temos eventos reais)
    // Em uma implementação real, você poderia usar EventEmitter ou similar
    
    setIsLoading(false);
    
    return () => {
      // Cleanup listeners se necessário
    };
  }, []);

  const checkServerStatus = async (): Promise<ServerStatus> => {
    try {
      console.log(`🧪 [useServerConfig] Verificando status: ${config.serverUrl}/docs`);
      
      // Usar endpoint /docs que sabemos que existe
      const response = await fetch(`${config.serverUrl}/docs`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        mode: 'cors',
        cache: 'no-cache'
      });
      
      const newStatus: ServerStatus = {
        isOnline: response.ok,
        lastCheck: new Date().toISOString(),
        latency: 0, // Não podemos medir latência facilmente aqui
      };
      
      setStatus(newStatus);
      console.log(`✅ [useServerConfig] Status verificado:`, newStatus);
      
      return newStatus;
      
    } catch (error: any) {
      console.error(`❌ [useServerConfig] Erro ao verificar status:`, error);
      
      const newStatus: ServerStatus = {
        isOnline: false,
        lastCheck: new Date().toISOString(),
        latency: 0,
        error: error.message
      };
      
      setStatus(newStatus);
      
      return newStatus;
    }
  };

  const updateConfig = (updates: Partial<ServerConfig>) => {
    console.log('🔄 [useServerConfig] Atualizando configuração:', updates);
    const newConfig = serverConfigService.updateConfig(updates);
    setConfig(newConfig);
    
    // Re-verificar status se a URL do servidor mudou
    if (updates.serverUrl) {
      checkServerStatus();
    }
  };

  const resetConfig = () => {
    console.log('🔄 [useServerConfig] Resetando configuração');
    const defaultConfig = serverConfigService.resetToDefaults();
    setConfig(defaultConfig);
    checkServerStatus();
  };

  return {
    config,
    status,
    isLoading,
    updateConfig,
    resetConfig,
    checkServerStatus,
    
    // Helpers úteis
    isServerOnline: status.isOnline,
    lastStatusCheck: status.lastCheck,
    hasApiKey: !!config.globalApiKey,
    hasAdminToken: !!config.adminToken,
    serverLatency: status.latency
  };
};
