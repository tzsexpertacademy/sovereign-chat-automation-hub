
#!/bin/bash

# Script para atualizar URLs do frontend para HTTPS
# Arquivo: scripts/update-frontend-urls.sh

echo "🔧 ATUALIZANDO FRONTEND PARA HTTPS"
echo "=================================="

DOMAIN="146.59.227.248"

echo "📋 Atualizando configuração para:"
echo "  • Servidor: https://$DOMAIN"
echo "  • Protocolo: HTTPS"
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

# Criar nova configuração
echo "🔄 Atualizando configuração..."
cat > "$CONFIG_FILE" << 'EOF'
// Environment configuration for WhatsApp Multi-Client - HTTPS
console.log('🌍 Configurando ambiente HTTPS...');

// Detect environment
const isProduction = window.location.hostname.includes('lovableproject.com');
const isDevelopment = window.location.hostname === 'localhost';

// HTTPS Server configuration
const HTTPS_SERVER = '146.59.227.248';

// Configure URLs for HTTPS
let SERVER_HOST: string;
let API_BASE_URL: string;
let SOCKET_URL: string;

if (isDevelopment) {
  // Development - use localhost
  SERVER_HOST = 'http://localhost:4000';
  API_BASE_URL = 'http://localhost:4000';
  SOCKET_URL = 'ws://localhost:4000';
  console.log('🛠️ Modo Desenvolvimento - Usando localhost');
} else {
  // Production - use HTTPS
  SERVER_HOST = `https://${HTTPS_SERVER}`;
  API_BASE_URL = `https://${HTTPS_SERVER}`;
  SOCKET_URL = `wss://${HTTPS_SERVER}`;
  console.log('🔒 Modo Produção - Usando HTTPS');
}

// Export the configured URLs
export const SERVER_URL = SERVER_HOST;
export { API_BASE_URL, SOCKET_URL };

// Export additional config
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isProduction,
  isDevelopment,
  isHttps: !isDevelopment,
  protocol: isDevelopment ? 'http:' : 'https:',
  serverUrl: SERVER_URL
});

console.log('✅ Configuração HTTPS carregada:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: !isDevelopment,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'https'
});
EOF

echo "✅ Frontend atualizado para HTTPS!"
echo ""
echo "📋 Mudanças aplicadas:"
echo "  • Protocolo: HTTP → HTTPS"
echo "  • WebSocket: WS → WSS"
echo "  • Removido proxy CORS"
echo ""
echo "🌐 Novas URLs:"
echo "  • API: https://$DOMAIN"
echo "  • WebSocket: wss://$DOMAIN"
echo ""
echo "🔄 Para aplicar:"
echo "  1. Faça commit das mudanças"
echo "  2. A configuração será aplicada automaticamente"
echo ""
echo "✅ Configuração concluída!"
EOF
