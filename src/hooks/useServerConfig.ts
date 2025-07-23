import { useState, useEffect } from 'react';
import { serverConfigService, ServerConfig, ServerStatus } from '@/services/serverConfigService';
import { toast } from '@/hooks/use-toast';

export const useServerConfig = () => {
  const [config, setConfig] = useState<ServerConfig>(serverConfigService.getConfig());
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    lastCheck: new Date().toISOString(),
    latency: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    console.log('🔧 [useServerConfig] Hook inicializado');
    
    // Carregar configuração inicial
    const initialConfig = serverConfigService.getConfig();
    setConfig(initialConfig);
    
    // Verificar status do servidor
    checkServerStatus();
    
    setIsLoading(false);
  }, []);

  const checkServerStatus = async (): Promise<ServerStatus> => {
    try {
      console.log(`🧪 [useServerConfig] Verificando status: ${config.serverUrl}/docs`);
      
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
        latency: 0,
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
    serverConfigService.updateConfig(updates);
    const newConfig = serverConfigService.getConfig();
    setConfig(newConfig);
    
    // Re-verificar status se a URL do servidor mudou
    if (updates.serverUrl) {
      checkServerStatus();
    }
  };

  const resetConfig = () => {
    console.log('🔄 [useServerConfig] Resetando configuração');
    serverConfigService.resetToDefaults();
    const defaultConfig = serverConfigService.getConfig();
    setConfig(defaultConfig);
    checkServerStatus();
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      // Configuração já é salva automaticamente no updateConfig
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
      toast({
        title: "Configuração salva",
        description: "As configurações foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    const result = await checkServerStatus();
    if (result.isOnline) {
      toast({
        title: "Conexão bem-sucedida",
        description: "O servidor está respondendo corretamente.",
      });
    } else {
      toast({
        title: "Falha na conexão",
        description: result.error || "Não foi possível conectar ao servidor.",
        variant: "destructive",
      });
    }
    return result;
  };

  const validateConfig = async () => {
    try {
      const validation = await serverConfigService.validateConfiguration();
      if (validation.valid) {
        toast({
          title: "Configuração válida",
          description: "Todas as configurações estão corretas.",
        });
      } else {
        toast({
          title: "Configuração inválida",
          description: validation.errors.join(', '),
          variant: "destructive",
        });
      }
      return validation;
    } catch (error) {
      toast({
        title: "Erro na validação",
        description: "Não foi possível validar a configuração.",
        variant: "destructive",
      });
      return { valid: false, errors: ['Erro na validação'] };
    }
  };

  const exportConfig = () => {
    try {
      const configData = JSON.stringify(config, null, 2);
      const blob = new Blob([configData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'server-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Configuração exportada",
        description: "O arquivo de configuração foi baixado.",
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar a configuração.",
        variant: "destructive",
      });
    }
  };

  const importConfig = (configJson: string) => {
    try {
      const importedConfig = JSON.parse(configJson) as Partial<ServerConfig>;
      updateConfig(importedConfig);
      toast({
        title: "Configuração importada",
        description: "A configuração foi importada com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: "JSON inválido ou formato incorreto.",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = () => {
    resetConfig();
    toast({
      title: "Configuração resetada",
      description: "A configuração foi restaurada para os valores padrão.",
    });
  };

  const rollbackConfig = () => {
    const success = serverConfigService.rollbackConfig();
    if (success) {
      const rolledBackConfig = serverConfigService.getConfig();
      setConfig(rolledBackConfig);
      toast({
        title: "Configuração restaurada",
        description: "A configuração anterior foi restaurada.",
      });
    } else {
      toast({
        title: "Erro ao restaurar",
        description: "Não há configuração anterior para restaurar.",
        variant: "destructive",
      });
    }
  };

  // Helper methods for getting API URL and headers
  const getApiUrl = () => serverConfigService.getApiUrl();
  const getHeaders = () => serverConfigService.getAdminHeaders();

  return {
    config,
    status,
    isLoading,
    isSaving,
    updateConfig,
    resetConfig,
    checkServerStatus,
    saveConfig,
    testConnection,
    validateConfig,
    exportConfig,
    importConfig,
    resetToDefaults,
    rollbackConfig,
    
    // API helpers
    apiUrl: getApiUrl(),
    headers: getHeaders(),
    
    // Helpers úteis
    isServerOnline: status.isOnline,
    lastStatusCheck: status.lastCheck,
    hasApiKey: !!config.globalApiKey,
    hasAdminToken: !!config.adminToken,
    serverLatency: status.latency
  };
};