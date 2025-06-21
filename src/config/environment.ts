
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // Se estivermos no servidor (porta 8080), usar localhost
  if (typeof window !== 'undefined' && window.location.port === '8080') {
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    console.log(`🔗 Usando servidor local: ${serverUrl}`);
    return serverUrl;
  }
  
  // Para Lovable e outros ambientes, usar HTTP na porta 4000
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  console.log(`🔗 Usando servidor de produção: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

// Logs para debug
console.log(`🌐 Configuração do servidor:`);
console.log(`  • Protocolo: ${typeof window !== 'undefined' ? window.location.protocol : 'N/A'}`);
console.log(`  • Porta atual: ${typeof window !== 'undefined' ? window.location.port : 'N/A'}`);
console.log(`  • Servidor: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
