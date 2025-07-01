
// Environment configuration for WhatsApp Multi-Client
console.log('🔧 Carregando configuração de ambiente...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// Server configuration
const SERVER_IP = '146.59.227.248';
const SERVER_PORT = '4000';

// Configure URLs based on environment
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development - use localhost HTTP
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost HTTP');
} else {
  // Production - use direct IP HTTP (servidor está em HTTP na porta 4000)
  SERVER_HOST = `http://${SERVER_IP}:${SERVER_PORT}`;
  API_BASE_URL = `http://${SERVER_IP}:${SERVER_PORT}`;
  SOCKET_URL = `ws://${SERVER_IP}:${SERVER_PORT}`;
  console.log('🌐 Modo Produção - Usando IP direto HTTP');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export { API_BASE_URL, SOCKET_URL };

// Export additional config
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isProduction,
  isDevelopment,
  isHttps: false, // Servidor está em HTTP na porta 4000
  protocol: 'http:',
  serverUrl: SERVER_URL,
  requiresHttps: false,
  corsEnabled: true,
  serverIP: SERVER_IP,
  serverPort: SERVER_PORT
});

console.log('✅ Configuração carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: false,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'lovable-production',
  serverIP: SERVER_IP,
  serverPort: SERVER_PORT
});
