
// Configuração centralizada de ambiente
export const API_BASE_URL = 'https://api.yumer.com.br';
export const SOCKET_URL = 'wss://api.yumer.com.br';
export const HTTPS_SERVER_URL = 'https://api.yumer.com.br';
export const SERVER_URL = 'https://api.yumer.com.br'; // Legacy support

// Função para obter chave da API global
export const getYumerGlobalApiKey = (): string => {
  const key = import.meta.env.VITE_YUMER_GLOBAL_API_KEY;
  if (!key) {
    console.warn('⚠️ VITE_YUMER_GLOBAL_API_KEY não está configurado');
  }
  return key || '';
};

// Função para verificar se tem API key
export const hasYumerGlobalApiKey = (): boolean => {
  return !!import.meta.env.VITE_YUMER_GLOBAL_API_KEY;
};

// Função para definir API key (localStorage)
export const setYumerGlobalApiKey = (key: string): void => {
  localStorage.setItem('yumer_global_api_key', key);
};

// Função para limpar API key
export const clearYumerGlobalApiKey = (): void => {
  localStorage.removeItem('yumer_global_api_key');
};

// Função para obter token admin
export const getYumerAdminToken = (): string => {
  const token = import.meta.env.VITE_YUMER_ADMIN_TOKEN;
  if (!token) {
    console.warn('⚠️ VITE_YUMER_ADMIN_TOKEN não está configurado');
  }
  return token || '';
};

// Função para obter URL do webhook
export const getYumerWebhookUrl = (): string => {
  const url = import.meta.env.VITE_YUMER_WEBHOOK_URL;
  if (!url) {
    console.warn('⚠️ VITE_YUMER_WEBHOOK_URL não está configurado');
  }
  return url || '';
};

// Função para configuração de servidor (legacy support)
export const getServerConfig = () => {
  return {
    SERVER_URL: API_BASE_URL,
    protocol: 'https',
    isHttps: true,
    apiKey: getYumerGlobalApiKey()
  };
};

// Configuração completa do ambiente
export const ENVIRONMENT_CONFIG = {
  api: {
    baseUrl: API_BASE_URL,
    timeout: 30000,
    version: 'v2'
  },
  auth: {
    globalApiKey: getYumerGlobalApiKey(),
    adminToken: getYumerAdminToken(),
    webhookUrl: getYumerWebhookUrl()
  },
  features: {
    websocketEnabled: false, // Desabilitado para usar apenas REST API
    debugMode: import.meta.env.DEV
  }
};
