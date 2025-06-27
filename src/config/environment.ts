
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // Detectar se estamos em ambiente local ou produção
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Detectar se a página atual está em HTTPS
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  if (isLocal) {
    // Ambiente local - usar HTTP
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    console.log(`🔗 [LOCAL] Usando servidor HTTP: ${serverUrl}`);
    return serverUrl;
  }
  
  // Ambiente de produção - sempre tentar HTTPS primeiro
  if (isHttps) {
    // Se a página está em HTTPS, usar HTTPS para API também
    const serverUrl = `https://${PRODUCTION_IP}`;
    console.log(`🔒 [PROD-HTTPS] Usando servidor HTTPS: ${serverUrl}`);
    return serverUrl;
  } else {
    // Fallback para HTTP se não conseguir HTTPS
    const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
    console.log(`🔗 [PROD-HTTP] Usando servidor HTTP: ${serverUrl}`);
    return serverUrl;
  }
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

// Debug completo
console.log(`🌐 ===== CONFIGURAÇÃO DE AMBIENTE =====`);
console.log(`  • URL Base: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
console.log(`  • Protocolo da página: ${typeof window !== 'undefined' ? window.location.protocol : 'N/A'}`);
console.log(`  • Hostname: ${typeof window !== 'undefined' ? window.location.hostname : 'N/A'}`);
console.log(`==========================================`);
