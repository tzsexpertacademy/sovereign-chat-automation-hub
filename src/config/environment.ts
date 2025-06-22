
// Configuração de ambiente para URLs do servidor
const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

export const getServerConfig = () => {
  // Se estivermos no Lovable, sempre usar o IP de produção
  if (typeof window !== 'undefined' && window.location.hostname.includes('lovableproject.com')) {
    // No Lovable, tentar HTTP primeiro (sem SSL)
    const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
    console.log(`🎯 [LOVABLE] Usando servidor HTTP: ${serverUrl}`);
    return serverUrl;
  }
  
  // Se estivermos no servidor local (porta 8080), usar localhost
  if (typeof window !== 'undefined' && window.location.port === '8080') {
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    console.log(`🔗 [LOCAL] Usando servidor local: ${serverUrl}`);
    return serverUrl;
  }
  
  // Para outros casos, usar IP de produção
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  console.log(`🌐 [DEFAULT] Usando servidor padrão: ${serverUrl}`);
  return serverUrl;
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

// Logs detalhados para debug
console.log(`🔧 [CONFIG] Configuração de ambiente:`);
console.log(`  • URL atual: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`);
console.log(`  • Hostname: ${typeof window !== 'undefined' ? window.location.hostname : 'N/A'}`);
console.log(`  • Porta: ${typeof window !== 'undefined' ? window.location.port : 'N/A'}`);
console.log(`  • Protocolo: ${typeof window !== 'undefined' ? window.location.protocol : 'N/A'}`);
console.log(`  • Servidor configurado: ${SERVER_URL}`);
console.log(`  • API Base: ${API_BASE_URL}`);
console.log(`  • Socket URL: ${SOCKET_URL}`);
