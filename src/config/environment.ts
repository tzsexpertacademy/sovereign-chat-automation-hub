
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // SEMPRE usar IP de produção fixo - sem detecção automática
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  console.log(`🔗 Usando servidor de produção: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

// Logs para debug
console.log(`🌐 Configuração FIXA de produção:`);
console.log(`  • Servidor: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
