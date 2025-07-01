
// Configuração simplificada para funcionar com o servidor atual
const SERVER_BASE = 'https://146.59.227.248';

export const SERVER_URL = SERVER_BASE;
export const API_BASE_URL = SERVER_BASE;
export const SOCKET_URL = SERVER_BASE;
export const HTTPS_SERVER_URL = SERVER_BASE;

export const getServerConfig = () => ({
  isHttps: true,
  isDevelopment: false,
  nginxProxy: true,
  lovableCompatible: true
});

console.log('🔧 Configuração do servidor carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: true
});
