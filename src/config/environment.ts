
// Environment configuration for WhatsApp Multi-Client - HTTPS DEFINITIVO CORRETO
console.log('🔒 Configurando ambiente HTTPS DEFINITIVO CORRETO...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// HTTPS Server configuration - PORTA 4000 CORRETA
const HTTPS_SERVER = '146.59.227.248';
const SERVER_PORT = '4000'; // PORTA CORRETA DO SERVIDOR

// Configure URLs for HTTPS DEFINITIVO
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
  // Production - HTTPS DEFINITIVO com PORTA 4000
  SERVER_HOST = `https://${HTTPS_SERVER}:${SERVER_PORT}`;
  API_BASE_URL = `https://${HTTPS_SERVER}:${SERVER_PORT}`;
  SOCKET_URL = `wss://${HTTPS_SERVER}:${SERVER_PORT}`;
  console.log('🔒 Modo Produção - HTTPS DEFINITIVO porta 4000');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export const HTTPS_SERVER_URL = `https://${HTTPS_SERVER}:${SERVER_PORT}`;
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
  requiresHttps: true,
  lovableCompatible: !isDevelopment,
  corsEnabled: true,
  sslRequired: !isDevelopment,
  httpsPort: SERVER_PORT,
  serverIP: HTTPS_SERVER,
  serverPort: SERVER_PORT
});

console.log('✅ Configuração HTTPS DEFINITIVO CORRETO carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  HTTPS_SERVER_URL,
  isHttps: !isDevelopment,
  requiresHttps: true,
  lovableCompatible: !isDevelopment,
  httpsPort: SERVER_PORT,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'https-production'
});
