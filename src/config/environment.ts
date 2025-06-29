
// Environment configuration for WhatsApp Multi-Client - HTTPS
console.log('🌍 Configurando ambiente HTTPS...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// HTTPS Server configuration
const HTTPS_SERVER = '146.59.227.248';

// Configure URLs for HTTPS
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development - use localhost
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost');
} else {
  // Production - use HTTPS
  SERVER_HOST = `https://${HTTPS_SERVER}`;
  API_BASE_URL = `https://${HTTPS_SERVER}`;
  SOCKET_URL = `wss://${HTTPS_SERVER}`;
  console.log('🔒 Modo Produção - Usando HTTPS');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export const DIRECT_SERVER_URL = SERVER_HOST; // For compatibility
export { API_BASE_URL, SOCKET_URL };

// Export additional config
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isProduction,
  isDevelopment,
  isHttps: !isDevelopment,
  protocol: isDevelopment ? 'http:' : 'https:',
  serverUrl: SERVER_URL,
  usingProxy: false, // No longer using CORS proxy
  hasMixedContent: false, // HTTPS setup resolves this
  corsEnabled: true // Direct HTTPS connection
});

console.log('✅ Configuração HTTPS carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: !isDevelopment,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'https'
});
