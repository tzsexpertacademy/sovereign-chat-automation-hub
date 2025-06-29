
// Environment configuration for WhatsApp Multi-Client
console.log('🌍 Configurando ambiente...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// CORS Proxy para resolver Mixed Content (HTTPS -> HTTP)
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const DIRECT_SERVER = '146.59.227.248:4000';

// Dynamic server configuration
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isProduction) {
  // Production URLs - usar proxy CORS para resolver Mixed Content
  SERVER_HOST = `${CORS_PROXY}http://${DIRECT_SERVER}`;
  API_BASE_URL = `${CORS_PROXY}http://${DIRECT_SERVER}`;
  SOCKET_URL = `wss://ws-proxy.herokuapp.com/?url=ws://${DIRECT_SERVER}`;
  console.log('🚀 Modo Produção - Usando proxy CORS para Mixed Content');
} else if (isDevelopment) {
  // Development URLs - use localhost
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'http://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost');
} else {
  // Fallback - usar proxy CORS
  SERVER_HOST = `${CORS_PROXY}http://${DIRECT_SERVER}`;
  API_BASE_URL = `${CORS_PROXY}http://${DIRECT_SERVER}`;
  SOCKET_URL = `wss://ws-proxy.herokuapp.com/?url=ws://${DIRECT_SERVER}`;
  console.log('🔄 Modo Fallback - Usando proxy CORS');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export { API_BASE_URL, SOCKET_URL };

// Export direct server info for diagnostics
export const DIRECT_SERVER_URL = `http://${DIRECT_SERVER}`;
export const CORS_PROXY_URL = CORS_PROXY;

// Export additional config functions
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  DIRECT_SERVER_URL,
  CORS_PROXY_URL,
  isProduction,
  isDevelopment,
  protocol: SERVER_HOST.startsWith('https:') ? 'https:' : 'http:',
  serverUrl: SERVER_URL,
  usingProxy: isProduction || (!isDevelopment && !SERVER_HOST.includes('localhost'))
});

export const getAlternativeServerConfig = () => ({
  SERVER_URL: isDevelopment ? `${CORS_PROXY}http://${DIRECT_SERVER}` : 'http://localhost:4000',
  API_BASE_URL: isDevelopment ? `${CORS_PROXY}http://${DIRECT_SERVER}` : 'http://localhost:4000',
  SOCKET_URL: isDevelopment ? `wss://ws-proxy.herokuapp.com/?url=ws://${DIRECT_SERVER}` : 'http://localhost:4000'
});

console.log('✅ Configuração de ambiente:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  DIRECT_SERVER_URL,
  usingProxy: isProduction || (!isDevelopment && !SERVER_HOST.includes('localhost')),
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'fallback'
});
