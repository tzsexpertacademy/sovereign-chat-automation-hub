
#!/bin/bash

# Script para atualizar URLs do frontend para HTTPS
# Arquivo: scripts/update-frontend-urls.sh

echo "🔧 ATUALIZANDO FRONTEND PARA HTTPS LOVABLE"
echo "=========================================="

DOMAIN="146.59.227.248"

echo "📋 Atualizando configuração para:"
echo "  • Servidor: https://$DOMAIN"
echo "  • Protocolo: HTTPS"
echo "  • Compatibilidade: LOVABLE"
echo ""

# Verificar se o arquivo existe
CONFIG_FILE="src/config/environment.ts"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Arquivo não encontrado: $CONFIG_FILE"
    echo "💡 Execute este script no diretório raiz do projeto"
    exit 1
fi

# Fazer backup
echo "💾 Criando backup..."
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Criar nova configuração COMPATÍVEL COM LOVABLE
echo "🔄 Atualizando configuração para Lovable..."
cat > "$CONFIG_FILE" << 'FRONTEND_CONFIG'
// Environment configuration for WhatsApp Multi-Client - HTTPS LOVABLE COMPATÍVEL
console.log('🔒 Configurando ambiente HTTPS LOVABLE COMPATÍVEL...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';
const isLovable = window.location.hostname.includes('lovableproject.com');

// HTTPS Server configuration
const HTTPS_SERVER = '146.59.227.248';

// Configure URLs for HTTPS LOVABLE COMPATÍVEL
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development - use localhost with HTTP for local development
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost HTTP');
} else {
  // Production/Lovable - HTTPS via Nginx (porta 443)
  SERVER_HOST = `https://${HTTPS_SERVER}`;
  API_BASE_URL = `https://${HTTPS_SERVER}`;
  SOCKET_URL = `wss://${HTTPS_SERVER}`;
  console.log('🔒 Modo Produção/Lovable - HTTPS via Nginx');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export const HTTPS_SERVER_URL = `https://${HTTPS_SERVER}`;
export { API_BASE_URL, SOCKET_URL };

// Export additional config
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  HTTPS_SERVER_URL,
  isProduction,
  isDevelopment,
  isLovable,
  isHttps: !isDevelopment,
  protocol: isDevelopment ? 'http:' : 'https:',
  serverUrl: SERVER_URL,
  requiresHttps: !isDevelopment,
  lovableCompatible: isLovable,
  corsEnabled: true,
  sslRequired: !isDevelopment,
  nginxProxy: !isDevelopment,
  acceptSelfSigned: !isDevelopment // Para aceitar certificados autoassinados
});

console.log('✅ Configuração HTTPS LOVABLE COMPATÍVEL carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  HTTPS_SERVER_URL,
  isHttps: !isDevelopment,
  isLovable,
  requiresHttps: !isDevelopment,
  lovableCompatible: isLovable,
  nginxProxy: !isDevelopment,
  acceptSelfSigned: !isDevelopment,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'lovable-https'
});
FRONTEND_CONFIG

echo "✅ Frontend atualizado para HTTPS LOVABLE COMPATÍVEL!"
echo ""
echo "📋 Mudanças aplicadas:"
echo "  • Protocolo: HTTP → HTTPS"
echo "  • WebSocket: WS → WSS"
echo "  • Compatibilidade: LOVABLE"
echo "  • Self-signed SSL: ACEITO"
echo ""
echo "🌐 Novas URLs:"
echo "  • API: https://$DOMAIN"
echo "  • WebSocket: wss://$DOMAIN"
echo ""
echo "🔄 Para aplicar:"
echo "  1. Faça commit das mudanças"
echo "  2. A configuração será aplicada automaticamente"
echo ""
echo "🧪 Teste a conexão:"
echo "curl -k https://$DOMAIN/health"
echo ""
echo "✅ Configuração LOVABLE COMPATÍVEL concluída!"
