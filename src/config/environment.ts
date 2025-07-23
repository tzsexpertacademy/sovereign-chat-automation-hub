
// Environment Configuration for CodeChat API v2.2.1
import { domainDetector } from '@/utils/domainDetector';

// Detectar domínio atual automaticamente
const currentDomainInfo = typeof window !== 'undefined' ? domainDetector.detectCurrentDomain() : {
  current: 'https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app',
  corsOrigins: [
    'https://id-preview--19c6b746-780c-41f1-97e3-86e1c8f2c488.lovable.app',
    'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com',
    'https://ymygyagbvbsdfkduxmgu.supabase.co'
  ]
};

export const environment = {
  // API Configuration - CodeChat v2.2.1
  api: {
    version: 'v2.2.1',
    baseUrl: 'https://api.yumer.com.br',
    basePath: '/api/v2',
    timeout: 15000,
    retryAttempts: 3
  },
  
  // Server Configuration - CodeChat API v2.2.1
  server: {
    host: 'api.yumer.com.br',
    port: 443,
    protocol: 'https' as const,
    ssl: true
  },
  
  // Authentication - CodeChat API v2.2.1
  auth: {
    adminToken: 'qTtC8k3M%9zAPfXw7vKmDrLzNqW@ea45JgyZhXpULBvydM67s3TuWKC!$RMo1FnB',
    jwtSecret: 'eZf#9vPpGq^3x@ZbWcNvJskH*mL74DwYcFgxKwUaTrpQgzVe',
    sessionSecret: 'M^r6Z!Lp9vAqTrXc@kYwFh#D2zGjTbUq'
  },
  
  // Frontend Integration - CORS dinâmico baseado no domínio atual
  frontend: {
    lovableDomain: currentDomainInfo.current,
    lovableDomainFallback: 'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com',
    supabaseUrl: 'https://ymygyagbvbsdfkduxmgu.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI',
    corsOrigins: currentDomainInfo.corsOrigins
  },
  
  // Webhooks Configuration - CodeChat API v2.2.1 - URLs corretas
  webhooks: {
    qrCodeWebhook: {
      enabled: true,
      url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-webhook',
      name: 'QR Code Updates',
      events: ['qrcodeUpdated', 'qr.updated', 'QR_CODE_UPDATED']
    },
    messageWebhook: {
      enabled: true,
      url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-webhook',
      name: 'Message Processing',
      events: ['messagesUpsert', 'sendMessage', 'messages.upsert']
    },
    statusWebhook: {
      enabled: true,
      url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/yumer-webhook',
      name: 'Instance Status',
      events: ['connectionUpdated', 'statusInstance', 'connection.update']
    }
  },
  
  // Development/Production Detection
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  
  // Logging - CodeChat API v2.2.1
  logging: {
    level: import.meta.env.DEV ? 'debug' : 'info',
    enableConsole: true,
    enableRemote: false
  }
};

// Export individual configurations for easier access
export const { api, server, auth, frontend, webhooks, logging } = environment;

// Helper functions
export const getApiUrl = () => `${api.baseUrl}${api.basePath}`;
export const getServerUrl = () => `${server.protocol}://${server.host}:${server.port}`;
export const getSwaggerUrl = () => `${api.baseUrl}/docs`;

// Version info - CodeChat API v2.2.1
export const VERSION_INFO = {
  api: 'v2.2.1',
  frontend: '1.0.0',
  lastUpdated: '2025-01-23'
};

// Legacy exports for backward compatibility
export const SERVER_URL = getServerUrl();
export const API_BASE_URL = getApiUrl();
export const SOCKET_URL = `wss://${server.host}:${server.port}/ws`;

// API Key management functions
let globalApiKey: string | null = null;

export const getYumerGlobalApiKey = (): string | null => {
  if (globalApiKey) return globalApiKey;
  return localStorage.getItem('yumer_global_api_key') || auth.adminToken;
};

export const setYumerGlobalApiKey = (key: string): void => {
  globalApiKey = key;
  localStorage.setItem('yumer_global_api_key', key);
};

export const clearYumerGlobalApiKey = (): void => {
  globalApiKey = null;
  localStorage.removeItem('yumer_global_api_key');
};

export const hasYumerGlobalApiKey = (): boolean => {
  return !!getYumerGlobalApiKey();
};

// Server config compatibility function
export const getServerConfig = () => ({
  SERVER_URL: getServerUrl(),
  API_BASE_URL: getApiUrl(),
  API_KEY: getYumerGlobalApiKey(),
  ADMIN_TOKEN: auth.adminToken,
  JWT_SECRET: auth.jwtSecret,
  protocol: server.protocol,
  isHttps: server.ssl,
  nginxProxy: false // Default value for backward compatibility
});

console.log('🚀 Environment loaded for CodeChat API v2.2.1:', {
  apiVersion: api.version,
  serverUrl: getApiUrl(),
  swaggerDocs: getSwaggerUrl(),
  environment: environment.isDevelopment ? 'development' : 'production'
});
