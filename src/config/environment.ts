
// ===== CONFIGURAÇÃO DE AMBIENTE SIMPLIFICADA =====
// Sempre usar HTTP em produção para o servidor WhatsApp

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

// Função principal para obter configuração do servidor
export const getServerConfig = () => {
  const isLocal = isLocalEnvironment();
  
  console.log(`🌐 ===== CONFIGURAÇÃO DE AMBIENTE CORRIGIDA =====`);
  console.log(`📍 Ambiente: ${isLocal ? 'LOCAL' : 'PRODUÇÃO'}`);
  
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
  
  // ===== AMBIENTE DE PRODUÇÃO - SEMPRE HTTP =====
  const serverUrl = `http://${PRODUCTION_IP}:${PRODUCTION_PORT}`;
  const protocol = 'http';
  
  console.log(`🔗 [PRODUÇÃO] Usando servidor WhatsApp: ${serverUrl}`);
  console.log(`✅ [PRODUÇÃO] Protocolo fixo: HTTP (servidor WhatsApp não suporta HTTPS)`);
  
  return {
    serverUrl,
    protocol,
    environment: 'production'
  };
};

// Função para obter configuração alternativa (removida - não é mais necessária)
export const getAlternativeServerConfig = () => {
  console.log(`⚠️ [INFO] Configuração alternativa não é mais necessária - usando sempre HTTP`);
  return null;
};

// Exportações principais
const config = getServerConfig();
export const SERVER_URL = config.serverUrl;
export const API_BASE_URL = `${config.serverUrl}/api`;
export const SOCKET_URL = config.serverUrl;

// Debug completo no console
console.log(`🌐 ===== CONFIGURAÇÃO FINAL CORRIGIDA =====`);
console.log(`  • Servidor WhatsApp: ${SERVER_URL}`);
console.log(`  • API: ${API_BASE_URL}`);
console.log(`  • Socket: ${SOCKET_URL}`);
console.log(`  • Protocolo: ${config.protocol} (FIXO)`);
console.log(`  • Ambiente: ${config.environment}`);
console.log(`  • ✅ Sempre HTTP para servidor WhatsApp em produção`);
if (typeof window !== 'undefined') {
  console.log(`  • Página atual: ${window.location.protocol}//${window.location.host}`);
  console.log(`  • Hostname: ${window.location.hostname}`);
}
console.log(`=====================================`);
