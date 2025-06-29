
// Environment configuration for WhatsApp Multi-Client
console.log('🌍 Configurando ambiente...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// Direct server configuration - simplified approach
const DIRECT_SERVER = '146.59.227.248:4000';

// Use direct HTTP connection for all environments
// Mixed Content will be handled by fetch configuration
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development URLs - use localhost if available
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost');
} else {
  // Production/Fallback - use direct server
  SERVER_HOST = `http://${DIRECT_SERVER}`;
  API_BASE_URL = `http://${DIRECT_SERVER}`;
  SOCKET_URL = `ws://${DIRECT_SERVER}`;
  console.log('🚀 Modo Produção - Usando servidor direto');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export { API_BASE_URL, SOCKET_URL };

// Export direct server info for diagnostics
export const DIRECT_SERVER_URL = `http://${DIRECT_SERVER}`;

// Export additional config functions
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  DIRECT_SERVER_URL,
  isProduction,
  isDevelopment,
  protocol: SERVER_URL.startsWith('https:') ? 'https:' : 'http:',
  serverUrl: SERVER_URL,
  usingDirectConnection: true
});

console.log('✅ Configuração de ambiente:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  DIRECT_SERVER_URL,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'fallback'
});
