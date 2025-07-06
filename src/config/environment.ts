
// Environment configuration for WhatsApp Multi-Client - CORREÇÃO DEFINITIVA SSL
console.log('🔒 Configurando ambiente SSL CORRIGIDO...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// HTTPS Server configuration - SEM PORTA (usar Nginx proxy)
const HTTPS_SERVER = '146.59.227.248';

// Configure URLs - CORREÇÃO: usar porta 443 via Nginx, não 4000 direto
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development - use localhost with HTTP for local development
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost HTTP');
} else {
  // Production - HTTPS via Nginx (porta 443 padrão, sem especificar)
  SERVER_HOST = `https://${HTTPS_SERVER}`;
  API_BASE_URL = `https://${HTTPS_SERVER}`;
  SOCKET_URL = `wss://${HTTPS_SERVER}`;
  console.log('🔒 Modo Produção - HTTPS via Nginx proxy (porta 443)');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export const HTTPS_SERVER_URL = `https://${HTTPS_SERVER}`;
export { API_BASE_URL, SOCKET_URL };

// Export additional config
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  HTTPS_SERVER_URL,
  isProduction,
  isDevelopment,
  isHttps: !isDevelopment,
  protocol: isDevelopment ? 'http:' : 'https:',
  serverUrl: SERVER_URL,
  requiresHttps: !isDevelopment,
  nginxProxy: !isDevelopment, // Usar Nginx proxy em produção
  corsEnabled: true,
  sslRequired: !isDevelopment,
  httpsServer: HTTPS_SERVER,
  useNginxProxy: !isDevelopment,
  directConnection: isDevelopment, // Conexão direta apenas em dev
  proxyConnection: !isDevelopment // Proxy via Nginx em produção
});

console.log('✅ Configuração SSL CORRIGIDA:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: !isDevelopment,
  nginxProxy: !isDevelopment,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'https-production',
  note: 'Usando Nginx proxy na porta 443 para produção'
});
