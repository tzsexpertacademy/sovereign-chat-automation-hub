
#!/bin/bash

# Script para atualizar URLs do frontend após configurar HTTPS
# Arquivo: scripts/update-frontend-urls.sh

echo "🔧 ATUALIZANDO URLs DO FRONTEND PARA HTTPS"
echo "========================================="

DOMAIN="146.59.227.248"
HTTPS_PORT="443"

echo "📋 Configurações:"
echo "  • Domínio: $DOMAIN"
echo "  • Protocolo: HTTPS"
echo "  • Porta: $HTTPS_PORT"
echo ""

# Verificar se o arquivo de configuração existe
CONFIG_FILE="src/config/environment.ts"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Arquivo de configuração não encontrado: $CONFIG_FILE"
    exit 1
fi

echo "📝 Criando backup do arquivo de configuração..."
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔄 Atualizando configurações para HTTPS..."

# Criar nova configuração
cat > "$CONFIG_FILE" << 'EOF'
// Environment configuration for WhatsApp Multi-Client - HTTPS Enabled
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

// Export additional config functions
export const getServerConfig = () => ({
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isProduction,
  isDevelopment,
  isHttps: true,
  protocol: 'https:',
  serverUrl: SERVER_URL
});

console.log('✅ Configuração HTTPS:', {
  SERVER_URL,
  API_BASE_URL,
  SOCKET_URL,
  isHttps: true,
  environment: isProduction ? 'production' : isDevelopment ? 'development' : 'fallback'
});
EOF

echo "✅ Configuração atualizada para HTTPS!"
echo ""
echo "📋 Mudanças realizadas:"
echo "  • Protocolo: HTTP → HTTPS"
echo "  • WebSocket: WS → WSS"
echo "  • Removido sistema de proxy CORS"
echo ""
echo "🔄 Para aplicar as mudanças:"
echo "  1. Faça commit das alterações"
echo "  2. Faça push para o repositório"
echo "  3. Recompile o frontend se necessário"
echo ""
echo "🌐 Novas URLs:"
echo "  • API Base: https://$DOMAIN"
echo "  • WebSocket: wss://$DOMAIN"
echo ""

# Verificar se existe arquivo de backup
if [ -f "$CONFIG_FILE.backup."* ]; then
    echo "💾 Backup salvo em: $CONFIG_FILE.backup.*"
fi

echo "✅ Atualização concluída!"
EOF
