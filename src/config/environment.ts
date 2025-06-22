
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // Se estivermos no servidor (porta 8080), usar localhost
  if (typeof window !== 'undefined' && window.location.port === '8080') {
    // Se o servidor tem HTTPS configurado, usar HTTPS
    if (window.location.protocol === 'https:') {
      const serverUrl = `https://localhost/api`;
      console.log(`🔒 Usando servidor local HTTPS: ${serverUrl}`);
      return serverUrl.replace('/api', '');
    } else {
      const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
      console.log(`🔗 Usando servidor local HTTP: ${serverUrl}`);
      return serverUrl;
    }
  }
  
  // Para Lovable e outros ambientes, tentar HTTPS primeiro
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const serverUrl = `https://${PRODUCTION_IP}`;
    console.log(`🔒 Usando servidor HTTPS: ${serverUrl}`);
    return serverUrl;
  }
  
  // Fallback para HTTP
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  console.log(`🔗 Usando servidor HTTP: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

// Logs para debug
console.log(`🌐 Configuração automática:`);
console.log(`  • Protocolo: ${typeof window !== 'undefined' ? window.location.protocol : 'N/A'}`);
console.log(`  • Porta atual: ${typeof window !== 'undefined' ? window.location.port : 'N/A'}`);
console.log(`  • Servidor: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
