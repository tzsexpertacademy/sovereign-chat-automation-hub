
// Environment configuration for WhatsApp Multi-Client - HTTPS ONLY
console.log('🔒 Configurando ambiente HTTPS OBRIGATÓRIO...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// HTTPS Server configuration - REQUIRED for Lovable integration
const HTTPS_SERVER = '146.59.227.248';
const HTTPS_PORT = '443'; // Standard HTTPS port

// Configure URLs for HTTPS ONLY
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
  // Production - HTTPS OBRIGATÓRIO para Lovable
  SERVER_HOST = `https://${HTTPS_SERVER}`;
  API_BASE_URL = `https://${HTTPS_SERVER}`;
  SOCKET_URL = `wss://${HTTPS_SERVER}`;
  console.log('🔒 Modo Produção - HTTPS OBRIGATÓRIO');
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
  isHttps: !isDevelopment, // HTTPS obrigatório em produção
  protocol: isDevelopment ? 'http:' : 'https:',
  serverUrl: SERVER_URL,
  requiresHttps: true, // Flag para indicar que HTTPS é obrigatório
  lovableCompatible: !isDevelopment, // Compatível com Lovable apenas em HTTPS
  corsEnabled: true,
  sslRequired: !isDevelopment // SSL obrigatório em produção
});

console.log('✅ Configuração HTTPS OBRIGATÓRIO carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  HTTPS_SERVER_URL,
  isHttps: !isDevelopment,
  requiresHttps: true,
  lovableCompatible: !isDevelopment,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'https-production'
});
