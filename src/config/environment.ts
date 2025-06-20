
// Configuração de ambiente para URLs do servidor
export const getServerConfig = () => {
  // Primeiro, verificar variável de ambiente
  if (import.meta.env.VITE_SERVER_URL) {
    console.log(`🔧 Usando VITE_SERVER_URL: ${import.meta.env.VITE_SERVER_URL}`);
    return import.meta.env.VITE_SERVER_URL;
  }

  // Detecção automática baseada no ambiente
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    console.log(`🌐 Hostname detectado: ${hostname}`);
    
    // Se estamos em localhost ou ambiente de desenvolvimento Lovable
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('🏠 Ambiente de desenvolvimento local detectado');
      return `${protocol}//${hostname}:4000`;
    }
    
    // Se estamos no ambiente Lovable
    if (hostname.includes('lovableproject.com')) {
      console.log('☁️ Ambiente Lovable detectado - usando IP de produção');
      return 'http://146.59.227.248:4000';
    }
    
    // Para qualquer outro ambiente - usar o mesmo hostname/IP do frontend mas porta 4000
    const serverUrl = `${protocol}//${hostname}:4000`;
    console.log(`🌍 Ambiente de produção detectado: ${serverUrl}`);
    return serverUrl;
  }
  
  // Fallback para desenvolvimento
  console.log('🔄 Usando fallback para desenvolvimento');
  return 'http://localhost:4000';
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

console.log(`🔗 Configuração final do servidor: ${SERVER_URL}`);
console.log(`📡 API Base URL: ${API_BASE_URL}`);
console.log(`🔌 Socket URL: ${SOCKET_URL}`);
