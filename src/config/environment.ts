
// Environment configuration for WhatsApp Multi-Client
console.log('🌍 Configurando ambiente...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// Dynamic server configuration
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isProduction) {
  // Production URLs - use the VPS server with HTTP (not HTTPS for now)
  SERVER_HOST = 'http://146.59.227.248:4000';
  API_BASE_URL = 'http://146.59.227.248:4000';
  SOCKET_URL = 'http://146.59.227.248:4000';
  console.log('🚀 Modo Produção - Usando servidor VPS');
} else if (isDevelopment) {
  // Development URLs - use localhost
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'http://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost');
} else {
  // Fallback - try VPS with HTTP
  SERVER_HOST = 'http://146.59.227.248:4000';
  API_BASE_URL = 'http://146.59.227.248:4000';
  SOCKET_URL = 'http://146.59.227.248:4000';
  console.log('🔄 Modo Fallback - Usando servidor VPS');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export { API_BASE_URL, SOCKET_URL };

// Export additional config functions
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isProduction,
  isDevelopment,
  protocol: SERVER_HOST.startsWith('https:') ? 'https:' : 'http:',
  serverUrl: SERVER_URL
});

export const getAlternativeServerConfig = () => ({
  SERVER_URL: isDevelopment ? 'http://146.59.227.248:4000' : 'http://localhost:4000',
  API_BASE_URL: isDevelopment ? 'http://146.59.227.248:4000' : 'http://localhost:4000',
  SOCKET_URL: isDevelopment ? 'http://146.59.227.248:4000' : 'http://localhost:4000'
});

console.log('✅ Configuração de ambiente:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'fallback'
});
