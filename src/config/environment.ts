
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // Sempre usar IP de produção fixo
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  console.log(`🔗 Usando servidor fixo: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

console.log(`🔗 Configuração final do servidor: ${SERVER_URL}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);
console.log(`🔌 Socket URL: ${SOCKET_URL}`);
