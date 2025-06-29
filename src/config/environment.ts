
// ===== CONFIGURAÇÃO SIMPLIFICADA COM HTTP DIRETO =====

const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

// Função para detectar se estamos em desenvolvimento local
const isLocalEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  return isLocalhost;
};

// Cache simples para evitar múltiplas detecções
let connectionCache: { protocol: string; serverUrl: string } | null = null;

// Função para testar conectividade
const testConnection = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    console.log(`❌ Falha ao conectar: ${url}`);
    return false;
  }
};

// Função principal para obter configuração do servidor
export const getServerConfig = async () => {
  // Se já testamos e temos cache, usar
  if (connectionCache) {
    console.log(`🔄 Usando configuração em cache: ${connectionCache.serverUrl}`);
    return connectionCache;
  }

  const isLocal = isLocalEnvironment();
  
  console.log(`🌐 ===== CONFIGURAÇÃO SIMPLIFICADA =====`);
  console.log(`📍 Ambiente: ${isLocal ? 'LOCAL' : 'PRODUÇÃO'}`);
  
  if (isLocal) {
    // ===== AMBIENTE LOCAL =====
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    const config = { serverUrl, protocol: 'http', environment: 'local' };
    connectionCache = config;
    console.log(`🏠 [LOCAL] Usando servidor: ${serverUrl}`);
    return config;
  }
  
  // ===== AMBIENTE DE PRODUÇÃO - HTTP DIRETO =====
  const httpUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  
  console.log(`🔗 [PRODUÇÃO] Usando HTTP direto: ${httpUrl}`);
  
  // Testar se o servidor está respondendo
  const httpWorks = await testConnection(httpUrl);
  
  if (httpWorks) {
    const config = { serverUrl: httpUrl, protocol: 'http', environment: 'production' };
    connectionCache = config;
    console.log(`✅ HTTP funcionando: ${httpUrl}`);
    return config;
  }
  
  // Se não funcionar, usar mesmo assim (servidor pode estar iniciando)
  console.log(`⚠️ Servidor não respondeu, mas usando HTTP: ${httpUrl}`);
  const config = { serverUrl: httpUrl, protocol: 'http', environment: 'production-fallback' };
  connectionCache = config;
  return config;
};

// Função síncrona para uso imediato
export const getServerConfigSync = () => {
  const isLocal = isLocalEnvironment();
  
  if (isLocal) {
    return {
      serverUrl: `http://localhost:${PRODUCTION_PORT}`,
      protocol: 'http',
      environment: 'local'
    };
  }
  
  // Em produção, usar HTTP direto
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

// Exportações principais
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

// Função para obter configuração alternativa (mantida para compatibilidade)
export const getAlternativeServerConfig = () => {
  // Em produção, não há alternativa - sempre HTTP
  return null;
};
