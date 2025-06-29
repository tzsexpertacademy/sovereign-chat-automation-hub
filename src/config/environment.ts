
// Configuração de ambiente para WhatsApp Multi-Client

// URLs base para o servidor
export const SERVER_IP = "146.59.227.248";
export const SERVER_HTTP_PORT = "4000";
export const SERVER_HTTPS_PORT = "4000";

// URLs HTTP (para APIs que funcionam)
export const HTTP_BASE_URL = `http://${SERVER_IP}:${SERVER_HTTP_PORT}`;
export const HTTP_SOCKET_URL = `http://${SERVER_IP}:${SERVER_HTTP_PORT}`;

// URLs HTTPS (apenas para health check e detecção)
export const HTTPS_BASE_URL = `https://${SERVER_IP}:${SERVER_HTTPS_PORT}`;
export const HTTPS_SOCKET_URL = `https://${SERVER_IP}:${SERVER_HTTPS_PORT}`;

// URLs principais (HTTP por padrão para funcionar no Lovable)
export const SERVER_URL = HTTP_BASE_URL;
export const API_BASE_URL = HTTP_BASE_URL;
export const SOCKET_URL = HTTP_SOCKET_URL;

// URL para health check (HTTPS para detectar servidor)
export const HEALTH_CHECK_URL = HTTPS_BASE_URL;

// Configuração do servidor
export const getServerConfig = () => {
  return {
    serverIp: SERVER_IP,
    httpPort: SERVER_HTTP_PORT,
    httpsPort: SERVER_HTTPS_PORT,
    isHttps: false, // Usar HTTP por padrão
    corsEnabled: true,
    healthCheckHttps: true // Health check ainda usa HTTPS
  };
};

// URLs para diferentes contextos
export const getUrls = () => {
  const config = getServerConfig();
  
  return {
    // APIs funcionais (HTTP)
    api: HTTP_BASE_URL,
    socket: HTTP_SOCKET_URL,
    
    // Health check (HTTPS para detectar servidor)
    healthCheck: HTTPS_BASE_URL,
    
    // URLs específicas
    healthEndpoint: `${HTTP_BASE_URL}/health`,
    healthCheckEndpoint: `${HTTPS_BASE_URL}/health`,
    apiDocs: `${HTTP_BASE_URL}/api-docs`,
    apiDocsHttps: `${HTTPS_BASE_URL}/api-docs`
  };
};

console.log('🔧 Configuração de ambiente carregada:', {
  HTTP_BASE_URL,
  HTTPS_BASE_URL,
  API_BASE_URL,
  SOCKET_URL,
  HEALTH_CHECK_URL
});
