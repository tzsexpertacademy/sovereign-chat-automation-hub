
// Environment configuration for YUMER WhatsApp Backend Integration
console.log('🚀 Configurando ambiente YUMER Backend...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// YUMER Backend configuration - porta 8083
const YUMER_SERVER = '146.59.227.248:8083';

// Configure URLs for YUMER Backend
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development - ainda apontando para YUMER em desenvolvimento
  SERVER_HOST = `https://${YUMER_SERVER}`;
  API_BASE_URL = `https://${YUMER_SERVER}`;
  SOCKET_URL = `wss://${YUMER_SERVER}`;
  console.log('🛠️ Modo Desenvolvimento - Conectando ao YUMER Backend');
} else {
  // Production - YUMER Backend HTTPS
  SERVER_HOST = `https://${YUMER_SERVER}`;
  API_BASE_URL = `https://${YUMER_SERVER}`;
  SOCKET_URL = `wss://${YUMER_SERVER}`;
  console.log('🔒 Modo Produção - YUMER Backend via HTTPS');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export const HTTPS_SERVER_URL = `https://${YUMER_SERVER}`; // Para compatibilidade
export const YUMER_SERVER_URL = `https://${YUMER_SERVER}`;
export { API_BASE_URL, SOCKET_URL };

// Export additional config for YUMER Backend
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  HTTPS_SERVER_URL,
  YUMER_SERVER_URL,
  isProduction,
  isDevelopment,
  isHttps: true, // YUMER sempre HTTPS
  protocol: 'https:',
  serverUrl: SERVER_URL,
  requiresHttps: true,
  nginxProxy: false, // Para compatibilidade
  corsEnabled: true,
  sslRequired: true,
  yumerServer: YUMER_SERVER,
  yumerPort: 8083,
  directConnection: true, // Conexão direta ao YUMER
  backendType: 'yumer' // Identificador do backend
});

console.log('✅ Configuração YUMER Backend:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: true,
  backendType: 'yumer',
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'yumer-production',
  note: 'Conectando diretamente ao YUMER Backend na porta 8083'
});
