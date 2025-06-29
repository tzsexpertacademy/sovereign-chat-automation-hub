
// Environment configuration for WhatsApp Multi-Client - HTTP SIMPLES
console.log('🌍 Configurando ambiente HTTP SIMPLES...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// HTTP Server configuration (sem HTTPS para evitar problemas)
const HTTP_SERVER = '146.59.227.248';
const SERVER_PORT = '4000';

// Configure URLs for HTTP DIRETO
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
  // Production - use HTTP DIRETO (sem nginx proxy)
  SERVER_HOST = `http://${HTTP_SERVER}:${SERVER_PORT}`;
  API_BASE_URL = `http://${HTTP_SERVER}:${SERVER_PORT}`;
  SOCKET_URL = `ws://${HTTP_SERVER}:${SERVER_PORT}`;
  console.log('🔗 Modo Produção - Usando HTTP DIRETO');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export const DIRECT_SERVER_URL = SERVER_HOST;
export { API_BASE_URL, SOCKET_URL };

// Export additional config
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isProduction,
  isDevelopment,
  isHttps: false, // Forçando HTTP
  protocol: 'http:',
  serverUrl: SERVER_URL,
  usingProxy: false,
  hasMixedContent: false,
  corsEnabled: true,
  directConnection: true // Nova flag
});

console.log('✅ Configuração HTTP DIRETO carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  protocol: 'HTTP',
  directConnection: true,
  port: SERVER_PORT
});
