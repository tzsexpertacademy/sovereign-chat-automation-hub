
// Dynamic Environment Configuration using ServerConfigService
import { serverConfigService } from '@/services/serverConfigService';

console.log('🚀 Configurando ambiente dinâmico YUMER Backend...');

// Get current configuration from service
const config = serverConfigService.getConfig();

// Dynamic URLs based on current configuration
export const SERVER_URL = config.serverUrl;
export const API_BASE_URL = config.serverUrl + config.basePath;
export const SOCKET_URL = serverConfigService.getWebSocketUrl();
export const HTTPS_SERVER_URL = config.serverUrl;
export const YUMER_SERVER_URL = config.serverUrl;
export const YUMER_API_URL = config.serverUrl;

// Detect environment dynamically
const isProduction = config.environment === 'production';
const isDevelopment = config.environment === 'development';

// ============ API KEY CONFIGURATION ============
export const getYumerGlobalApiKey = (): string | null => {
  // First try from dynamic config, then fallback to localStorage
  return config.globalApiKey || localStorage.getItem('yumer_global_api_key');
};

export const setYumerGlobalApiKey = (apiKey: string): void => {
  localStorage.setItem('yumer_global_api_key', apiKey);
  serverConfigService.updateConfig({ globalApiKey: apiKey });
  console.log('🔑 API Key global YUMER configurada dinamicamente');
};

export const clearYumerGlobalApiKey = (): void => {
  localStorage.removeItem('yumer_global_api_key');
  serverConfigService.updateConfig({ globalApiKey: '' });
  console.log('🗑️ API Key global YUMER removida');
};

export const hasYumerGlobalApiKey = (): boolean => {
  return !!getYumerGlobalApiKey();
};

// Export dynamic config
export const getServerConfig = () => {
  const currentConfig = serverConfigService.getConfig();
  
  return {
    SERVER_URL: currentConfig.serverUrl,
    API_BASE_URL: currentConfig.serverUrl + currentConfig.basePath,
    SOCKET_URL: serverConfigService.getWebSocketUrl(),
    HTTPS_SERVER_URL: currentConfig.serverUrl,
    YUMER_SERVER_URL: currentConfig.serverUrl,
    isProduction: currentConfig.environment === 'production',
    isDevelopment: currentConfig.environment === 'development',
    isHttps: currentConfig.protocol === 'https',
    protocol: currentConfig.protocol + ':',
    serverUrl: currentConfig.serverUrl,
    requiresHttps: currentConfig.sslRequired,
    nginxProxy: false,
    corsEnabled: currentConfig.corsEnabled,
    sslRequired: currentConfig.sslRequired,
    yumerServer: currentConfig.host + ':' + currentConfig.port,
    yumerPort: currentConfig.port,
    directConnection: true,
    backendType: 'yumer',
    hasApiKey: hasYumerGlobalApiKey(),
    getApiKey: getYumerGlobalApiKey,
    
    // New dynamic fields
    webSocketEnabled: currentConfig.webSocketEnabled,
    environment: currentConfig.environment,
    requestTimeout: currentConfig.requestTimeout,
    retryAttempts: currentConfig.retryAttempts,
    offlineMode: currentConfig.offlineMode,
    fallbackServerUrl: currentConfig.fallbackServerUrl
  };
};

// Subscribe to configuration changes
serverConfigService.subscribe((newConfig) => {
  console.log('🔄 Configuração do servidor atualizada:', newConfig);
  
  // Update global variables (if needed by legacy code)
  (window as any).YUMER_CONFIG = {
    SERVER_URL: newConfig.serverUrl,
    API_BASE_URL: newConfig.serverUrl + newConfig.basePath,
    SOCKET_URL: serverConfigService.getWebSocketUrl(),
    config: newConfig
  };
});

console.log('✅ Configuração YUMER Backend Dinâmica:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: config.protocol === 'https',
  backendType: 'yumer',
  environment: config.environment,
  configurable: true,
  note: 'Configuração totalmente dinâmica via AdminPanel'
});
