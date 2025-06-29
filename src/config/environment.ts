
// ===== CONFIGURAÇÃO DE AMBIENTE DEFINITIVA =====
// Sistema robusto com fallback automático e detecção inteligente

const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

// Função para detectar ambiente
const isLocalEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  return isLocalhost;
};

// Função para verificar se servidor está respondendo
const testServerConnection = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    console.warn(`❌ Servidor não respondeu: ${url}`, error);
    return false;
  }
};

// Função principal para obter configuração do servidor com fallback
export const getServerConfig = async () => {
  const isLocal = isLocalEnvironment();
  
  console.log(`🌐 ===== CONFIGURAÇÃO INTELIGENTE DE AMBIENTE =====`);
  console.log(`📍 Ambiente: ${isLocal ? 'LOCAL' : 'PRODUÇÃO'}`);
  
  if (isLocal) {
    // ===== AMBIENTE LOCAL =====
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    console.log(`🏠 [LOCAL] Servidor: ${serverUrl}`);
    return {
      serverUrl,
      protocol: 'http',
      environment: 'local',
      fallbackUrl: null
    };
  }
  
  // ===== AMBIENTE DE PRODUÇÃO COM FALLBACK INTELIGENTE =====
  const httpsUrl = `https://${PRODUCTION_IP}`;
  const httpUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  
  console.log(`🔍 Testando conectividade HTTPS: ${httpsUrl}`);
  const httpsWorks = await testServerConnection(httpsUrl);
  
  if (httpsWorks) {
    console.log(`✅ [PROD-HTTPS] Servidor respondeu: ${httpsUrl}`);
    return {
      serverUrl: httpsUrl,
      protocol: 'https',
      environment: 'production',
      fallbackUrl: httpUrl
    };
  }
  
  console.log(`⚠️ HTTPS falhou, testando HTTP: ${httpUrl}`);
  const httpWorks = await testServerConnection(httpUrl);
  
  if (httpWorks) {
    console.log(`✅ [PROD-HTTP] Servidor respondeu: ${httpUrl}`);
    return {
      serverUrl: httpUrl,
      protocol: 'http',
      environment: 'production',
      fallbackUrl: httpsUrl
    };
  }
  
  console.error(`❌ Nenhum servidor respondeu. Usando HTTP como padrão.`);
  return {
    serverUrl: httpUrl,
    protocol: 'http',
    environment: 'production-fallback',
    fallbackUrl: httpsUrl
  };
};

// Cache de configuração
let cachedConfig: any = null;

// Função para obter configuração (com cache)
export const getConfig = async () => {
  if (!cachedConfig) {
    cachedConfig = await getServerConfig();
  }
  return cachedConfig;
};

// Função para invalidar cache e recarregar
export const reloadConfig = async () => {
  cachedConfig = null;
  cachedConfig = await getServerConfig();
  return cachedConfig;
};

// Exportações principais (síncronas para compatibilidade)
const config = isLocalEnvironment() 
  ? { serverUrl: `http://localhost:${PRODUCTION_PORT}`, protocol: 'http', environment: 'local' }
  : { serverUrl: `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`, protocol: 'http', environment: 'production' };

export const SERVER_URL = config.serverUrl;
export const API_BASE_URL = `${config.serverUrl}/api`;
export const SOCKET_URL = config.serverUrl;

console.log(`🌐 ===== CONFIGURAÇÃO INICIAL =====`);
console.log(`  • Servidor: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
console.log(`====================================`);
