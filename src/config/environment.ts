
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // Sempre usar IP de produção para conexões externas
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  console.log(`🎯 [CONFIG] Servidor configurado: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

// Forçar logs para debug
console.log(`🔧 [CONFIG] Configuração final:`);
console.log(`  • SERVER_URL: ${SERVER_URL}`);
console.log(`  • API_BASE_URL: ${API_BASE_URL}`);
console.log(`  • SOCKET_URL: ${SOCKET_URL}`);
