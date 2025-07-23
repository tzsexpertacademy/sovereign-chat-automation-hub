
// Environment Configuration for CodeChat API v2.2.1
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
  
  // Frontend Integration
  frontend: {
    lovableDomain: 'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com',
    supabaseUrl: 'https://ymygyagbvbsdfkduxmgu.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI'
  },
  
  // Webhooks Configuration - CodeChat API v2.2.1
  webhooks: {
    qrCodeWebhook: {
      enabled: true,
      url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/codechat-v2-webhook',
      events: ['qrcodeUpdated', 'qr.updated', 'QR_CODE_UPDATED']
    },
    messageWebhook: {
      enabled: true,
      url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/codechat-v2-webhook',
      events: ['messagesUpsert', 'sendMessage']
    },
    statusWebhook: {
      enabled: true,
      url: 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/codechat-v2-webhook',
      events: ['connectionUpdated', 'statusInstance']
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

console.log('🚀 Environment loaded for CodeChat API v2.2.1:', {
  apiVersion: api.version,
  serverUrl: getApiUrl(),
  swaggerDocs: getSwaggerUrl(),
  environment: isDevelopment ? 'development' : 'production'
});
