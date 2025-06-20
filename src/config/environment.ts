
// Configuração de ambiente para URLs do servidor
export const getServerConfig = () => {
  // Primeiro, verificar variável de ambiente
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  // Detecção automática baseada no ambiente
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Se estamos em localhost ou ambiente de desenvolvimento Lovable
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('lovable')) {
      return `${protocol}//${hostname}:4000`;
    }
    
    // Para produção - usar o mesmo hostname/IP do frontend mas porta 4000
    return `${protocol}//${hostname}:4000`;
  }
  
  // Fallback para desenvolvimento
  return 'http://localhost:4000';
};

export const SERVER_URL = getServerConfig();
export const API_BASE_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = SERVER_URL;

console.log(`🔗 Configuração do servidor: ${SERVER_URL}`);
