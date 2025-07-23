
// Configuração centralizada da API Yumer
export const YUMER_CONFIG = {
  baseUrl: 'https://api.yumer.com.br',
  timeout: 30000,
  version: 'v2',
  
  // Headers padrão para diferentes tipos de autenticação
  getAdminHeaders: (adminToken: string, globalApiKey: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'apikey': globalApiKey
  }),
  
  getBusinessHeaders: (businessToken: string, globalApiKey: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${businessToken}`,
    'apikey': globalApiKey
  }),
  
  getInstanceHeaders: (instanceJWT: string, globalApiKey: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${instanceJWT}`,
    'apikey': globalApiKey
  })
};

// Configuração do ambiente
export const getEnvironmentConfig = () => {
  const config = {
    adminToken: import.meta.env.VITE_YUMER_ADMIN_TOKEN || '',
    globalApiKey: import.meta.env.VITE_YUMER_GLOBAL_API_KEY || '',
    webhookUrl: import.meta.env.VITE_YUMER_WEBHOOK_URL || '',
  };
  
  // Validação básica
  if (!config.globalApiKey) {
    console.warn('⚠️ YUMER_GLOBAL_API_KEY não configurado');
  }
  
  return config;
};
