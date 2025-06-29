
// Environment configuration for WhatsApp Multi-Client
console.log('🌍 Configurando ambiente...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// Direct server configuration
const DIRECT_SERVER = '146.59.227.248:4000';

// CORS Proxy configuration for Mixed Content resolution
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com';

// Configure URLs based on Mixed Content situation
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

// Check if we have Mixed Content situation (HTTPS trying to access HTTP)
const hasMixedContent = window.location.protocol === 'https:';

if (isDevelopment) {
  // Development - use localhost
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost');
} else if (hasMixedContent) {
  // Production with Mixed Content - use CORS proxy
  SERVER_HOST = `${CORS_PROXY}/http://${DIRECT_SERVER}`;
  API_BASE_URL = `${CORS_PROXY}/http://${DIRECT_SERVER}`;
  SOCKET_URL = `wss://${DIRECT_SERVER}`;
  console.log('🔒 Modo Mixed Content - Usando proxy CORS');
} else {
  // Production without Mixed Content - direct connection
  SERVER_HOST = `http://${DIRECT_SERVER}`;
  API_BASE_URL = `http://${DIRECT_SERVER}`;
  SOCKET_URL = `ws://${DIRECT_SERVER}`;
  console.log('🚀 Modo Produção - Conexão direta');
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
  hasMixedContent,
  usingProxy: hasMixedContent,
  protocol: hasMixedContent ? 'https:' : SERVER_URL.startsWith('https:') ? 'https:' : 'http:',
  serverUrl: SERVER_URL
});

console.log('✅ Configuração de ambiente:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  DIRECT_SERVER_URL,
  CORS_PROXY_URL,
  hasMixedContent,
  usingProxy: hasMixedContent,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'fallback'
});
