
// ===== CONFIGURAÇÃO DE AMBIENTE COM FALLBACK INTELIGENTE =====
// Detecção automática e fallback HTTP/HTTPS

const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

// Função para detectar se estamos em desenvolvimento local
const isLocalEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  return isLocalhost;
};

// Função para verificar se a página atual está em HTTPS
const isHttpsPage = () => {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
};

// Cache para evitar múltiplas tentativas
let connectionCache: { protocol: string; serverUrl: string } | null = null;

// Função para testar conectividade
const testConnection = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5 segundos timeout
    });
    return response.ok;
  } catch (error) {
    console.log(`❌ Falha ao conectar: ${url}`, error.message);
    return false;
  }
};

// Função principal para obter configuração do servidor com fallback
export const getServerConfig = async () => {
  // Se já testamos e temos cache, usar
  if (connectionCache) {
    console.log(`🔄 Usando configuração em cache: ${connectionCache.serverUrl}`);
    return connectionCache;
  }

  const isLocal = isLocalEnvironment();
  const isHttps = isHttpsPage();
  
  console.log(`🌐 ===== CONFIGURAÇÃO COM FALLBACK INTELIGENTE =====`);
  console.log(`📍 Ambiente: ${isLocal ? 'LOCAL' : 'PRODUÇÃO'}`);
  console.log(`🔒 Protocolo da página: ${isHttps ? 'HTTPS' : 'HTTP'}`);
  
  if (isLocal) {
    // ===== AMBIENTE LOCAL =====
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    const config = { serverUrl, protocol: 'http', environment: 'local' };
    connectionCache = config;
    console.log(`🏠 [LOCAL] Usando servidor: ${serverUrl}`);
    return config;
  }
  
  // ===== AMBIENTE DE PRODUÇÃO COM FALLBACK =====
  const httpsUrl = `https://${PRODUCTION_IP}`;
  const httpUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  
  console.log(`🔍 Testando conectividade...`);
  
  // Tentar HTTPS primeiro se a página é HTTPS
  if (isHttps) {
    console.log(`🔒 Testando HTTPS: ${httpsUrl}`);
    const httpsWorks = await testConnection(httpsUrl);
    
    if (httpsWorks) {
      const config = { serverUrl: httpsUrl, protocol: 'https', environment: 'production' };
      connectionCache = config;
      console.log(`✅ HTTPS funcionando: ${httpsUrl}`);
      return config;
    }
    
    console.log(`⚠️ HTTPS falhou, tentando HTTP: ${httpUrl}`);
  }
  
  // Testar HTTP
  console.log(`🔗 Testando HTTP: ${httpUrl}`);
  const httpWorks = await testConnection(httpUrl);
  
  if (httpWorks) {
    const config = { serverUrl: httpUrl, protocol: 'http', environment: 'production' };
    connectionCache = config;
    console.log(`✅ HTTP funcionando: ${httpUrl}`);
    return config;
  }
  
  // Se nada funcionar, usar HTTP como padrão
  console.log(`❌ Ambos falharam, usando HTTP como padrão`);
  const config = { serverUrl: httpUrl, protocol: 'http', environment: 'production-fallback' };
  connectionCache = config;
  return config;
};

// Função síncrona para uso imediato (sem teste)
export const getServerConfigSync = () => {
  const isLocal = isLocalEnvironment();
  
  if (isLocal) {
    return {
      serverUrl: `http://localhost:${PRODUCTION_PORT}`,
      protocol: 'http',
      environment: 'local'
    };
  }
  
  // Em produção, preferir HTTP por estar funcionando
  return {
    serverUrl: `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`,
    protocol: 'http',
    environment: 'production'
  };
};

// Função para forçar nova detecção
export const resetConnectionCache = () => {
  connectionCache = null;
  console.log('🔄 Cache de conexão resetado');
};

// Exportações principais (síncronas para compatibilidade)
const defaultConfig = getServerConfigSync();
export const SERVER_URL = defaultConfig.serverUrl;
export const API_BASE_URL = `${defaultConfig.serverUrl}/api`;
export const SOCKET_URL = defaultConfig.serverUrl;

// Debug completo no console
console.log(`🌐 ===== CONFIGURAÇÃO INICIAL =====`);
console.log(`  • Servidor: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
console.log(`  • Protocolo: ${defaultConfig.protocol}`);
console.log(`  • Ambiente: ${defaultConfig.environment}`);
if (typeof window !== 'undefined') {
  console.log(`  • Página atual: ${window.location.protocol}//${window.location.host}`);
  console.log(`  • Hostname: ${window.location.hostname}`);
}
console.log(`=====================================`);

// Função para obter configuração alternativa em caso de erro
export const getAlternativeServerConfig = () => {
  const currentConfig = getServerConfigSync();
  const isLocal = isLocalEnvironment();
  
  if (isLocal) {
    return null; // Sem alternativa em local
  }
  
  // Alternar entre HTTP e HTTPS
  if (currentConfig.protocol === 'https') {
    return {
      serverUrl: `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`,
      protocol: 'http',
      environment: 'production-fallback'
    };
  } else {
    return {
      serverUrl: `https://${PRODUCTION_IP}`,
      protocol: 'https',
      environment: 'production-fallback'
    };
  }
};
