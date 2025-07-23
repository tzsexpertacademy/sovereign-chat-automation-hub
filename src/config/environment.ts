
// Dynamic Environment Configuration using ServerConfigService
import { serverConfigService } from '@/services/serverConfigService';

console.log('🚀 Configurando ambiente dinâmico YUMER Backend CodeChat API v2.1.3...');

// Get current configuration from service
const config = serverConfigService.getConfig();

// Dynamic URLs based on current configuration - NOVO SERVIDOR
export const SERVER_URL = config.serverUrl; // https://api.yumer.com.br
export const API_BASE_URL = config.serverUrl + config.basePath; // https://api.yumer.com.br/api/v2
export const SOCKET_URL = serverConfigService.getWebSocketUrl();
export const HTTPS_SERVER_URL = config.serverUrl;
export const YUMER_SERVER_URL = config.serverUrl;
export const YUMER_API_URL = config.serverUrl + config.basePath;

// Detect environment dynamically
const isProduction = config.environment === 'production';
const isDevelopment = config.environment === 'development';

// ============ API KEY CONFIGURATION ============
export const getYumerGlobalApiKey = (): string | null => {
  // Get from dynamic config (always up to date)
  const currentConfig = serverConfigService.getConfig();
  return currentConfig.globalApiKey || localStorage.getItem('yumer_global_api_key');
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

// Export dynamic config with real-time updates
export const getServerConfig = () => {
  // Always get fresh config
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
    nginxProxy: true, // CloudPanel Nginx configurado
    corsEnabled: currentConfig.corsEnabled,
    sslRequired: currentConfig.sslRequired,
    yumerServer: currentConfig.host + ':' + currentConfig.port,
    yumerPort: currentConfig.port,
    directConnection: true,
    backendType: 'codechat-v2',
    hasApiKey: hasYumerGlobalApiKey(),
    getApiKey: getYumerGlobalApiKey,
    
    // New dynamic fields
    webSocketEnabled: currentConfig.webSocketEnabled,
    environment: currentConfig.environment,
    requestTimeout: currentConfig.requestTimeout,
    retryAttempts: currentConfig.retryAttempts,
    offlineMode: currentConfig.offlineMode,
    fallbackServerUrl: currentConfig.fallbackServerUrl,
    
    // Frontend integration
    lovableDomain: currentConfig.lovableDomain,
    supabaseUrl: currentConfig.supabaseUrl,
    corsOrigins: currentConfig.corsOrigins,
    
    // Webhooks for admin
    adminWebhooks: currentConfig.adminWebhooks,
    
    // CodeChat API v2.1.3 específico
    swaggerDocs: currentConfig.serverUrl + '/docs',
    apiVersion: currentConfig.apiVersion,
    basePath: currentConfig.basePath
  };
};

// Subscribe to configuration changes and update global variables
serverConfigService.subscribe((newConfig) => {
  console.log('🔄 Configuração do servidor CodeChat v2.1.3 atualizada:', newConfig);
  
  // Update global variables (for compatibility with existing code)
  (window as any).YUMER_CONFIG = {
    SERVER_URL: newConfig.serverUrl,
    API_BASE_URL: newConfig.serverUrl + newConfig.basePath,
    SOCKET_URL: serverConfigService.getWebSocketUrl(),
    config: newConfig
  };
  
  // Dispatch custom event for components that need to react to config changes
  window.dispatchEvent(new CustomEvent('yumer-config-updated', { detail: newConfig }));
});

// Initialize global config on window for backward compatibility
(window as any).YUMER_CONFIG = {
  SERVER_URL: config.serverUrl,
  API_BASE_URL: config.serverUrl + config.basePath,
  SOCKET_URL: serverConfigService.getWebSocketUrl(),
  config: config
};

console.log('✅ Configuração YUMER Backend CodeChat API v2.1.3:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: config.protocol === 'https',
  backendType: 'codechat-v2',
  environment: config.environment,
  configurable: true,
  adminConfigurable: true,
  swaggerDocs: config.serverUrl + '/docs',
  note: 'Sistema 100% configurável via Admin Panel - CodeChat API v2.1.3'
});

// Export compatibility functions for existing code
export {
  isProduction,
  isDevelopment,
  serverConfigService
};
