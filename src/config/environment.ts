
// ===== CONFIGURAÇÃO DE AMBIENTE INTELIGENTE =====
// Detecção automática de local/produção e HTTP/HTTPS

const PRODUCTION_IP = '146.59.227.248';
const PRODUCTION_PORT = '4000';

// Função para detectar se estamos em desenvolvimento local
const isLocalEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  console.log(`🔍 Detectando ambiente:`, {
    hostname,
    isLocalhost,
    protocol: window.location.protocol,
    port: window.location.port
  });
  
  return isLocalhost;
};

// Função para verificar se a página atual está em HTTPS
const isHttpsPage = () => {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
};

// Função principal para obter configuração do servidor
export const getServerConfig = () => {
  const isLocal = isLocalEnvironment();
  const isHttps = isHttpsPage();
  
  console.log(`🌐 ===== CONFIGURAÇÃO DE AMBIENTE =====`);
  console.log(`📍 Ambiente: ${isLocal ? 'LOCAL' : 'PRODUÇÃO'}`);
  console.log(`🔒 Protocolo da página: ${isHttps ? 'HTTPS' : 'HTTP'}`);
  
  if (isLocal) {
    // ===== AMBIENTE LOCAL =====
    const serverUrl = `http://localhost:${PRODUCTION_PORT}`;
    console.log(`🏠 [LOCAL] Usando servidor: ${serverUrl}`);
    return {
      serverUrl,
      protocol: 'http',
      environment: 'local'
    };
  }
  
  // ===== AMBIENTE DE PRODUÇÃO =====
  let serverUrl;
  let protocol;
  
  if (isHttps) {
    // Página em HTTPS - tentar HTTPS primeiro
    serverUrl = `https://${PRODUCTION_IP}`;
    protocol = 'https';
    console.log(`🔒 [PROD-HTTPS] Usando servidor: ${serverUrl}`);
  } else {
    // Página em HTTP - usar HTTP
    serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
    protocol = 'http';
    console.log(`🔗 [PROD-HTTP] Usando servidor: ${serverUrl}`);
  }
  
  return {
    serverUrl,
    protocol,
    environment: 'production'
  };
};

// Função para tentar URL alternativa em caso de erro
export const getAlternativeServerConfig = () => {
  const isLocal = isLocalEnvironment();
  
  if (isLocal) {
    // Em local, não há alternativa
    return null;
  }
  
  // Em produção, alternar entre HTTP e HTTPS
  const currentConfig = getServerConfig();
  const isCurrentHttps = currentConfig.protocol === 'https';
  
  let alternativeUrl;
  let alternativeProtocol;
  
  if (isCurrentHttps) {
    // Se atual é HTTPS, tentar HTTP
    alternativeUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
    alternativeProtocol = 'http';
    console.log(`🔄 [FALLBACK] Tentando HTTP: ${alternativeUrl}`);
  } else {
    // Se atual é HTTP, tentar HTTPS
    alternativeUrl = `https://${PRODUCTION_IP}`;
    alternativeProtocol = 'https';
    console.log(`🔄 [FALLBACK] Tentando HTTPS: ${alternativeUrl}`);
  }
  
  return {
    serverUrl: alternativeUrl,
    protocol: alternativeProtocol,
    environment: 'production-fallback'
  };
};

// Exportações principais
const config = getServerConfig();
export const SERVER_URL = config.serverUrl;
export const API_BASE_URL = `${config.serverUrl}/api`;
export const SOCKET_URL = config.serverUrl;

// Debug completo no console
console.log(`🌐 ===== CONFIGURAÇÃO FINAL =====`);
console.log(`  • Servidor: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
console.log(`  • Protocolo: ${config.protocol}`);
console.log(`  • Ambiente: ${config.environment}`);
if (typeof window !== 'undefined') {
  console.log(`  • Página atual: ${window.location.protocol}//${window.location.host}`);
  console.log(`  • Hostname: ${window.location.hostname}`);
}
console.log(`=====================================`);
