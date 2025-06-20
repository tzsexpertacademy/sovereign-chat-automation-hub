
#!/bin/bash

# Script para configurar URLs de produção
# Arquivo: scripts/configure-production-urls.sh

echo "🔧 Configurando URLs para produção..."
echo "=================================="

# Detectar IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')

if [ -z "$SERVER_IP" ]; then
    echo "❌ Não foi possível detectar o IP do servidor"
    echo "💡 Por favor, forneça o IP manualmente:"
    read -p "Digite o IP do servidor: " SERVER_IP
fi

echo "📍 IP detectado/fornecido: $SERVER_IP"

# Configurar URL do servidor
SERVER_URL="http://${SERVER_IP}:4000"

echo ""
echo "🌐 Configurações que serão aplicadas:"
echo "  • Servidor WhatsApp: $SERVER_URL"
echo "  • Frontend: http://${SERVER_IP}:8080"
echo ""

# Criar arquivo .env.local para desenvolvimento
echo "📝 Criando configuração local..."
cat > .env.local << EOF
# Configuração para produção - WhatsApp Multi-Cliente
VITE_SERVER_URL=$SERVER_URL
EOF

echo "✅ Arquivo .env.local criado com sucesso!"

# Mostrar instruções
echo ""
echo "📋 Para aplicar as configurações:"
echo "1. Reinicie o servidor de desenvolvimento (Ctrl+C e npm run dev)"
echo "2. Ou defina a variável de ambiente manualmente:"
echo "   export VITE_SERVER_URL=$SERVER_URL"
echo ""
echo "🔍 Para verificar se funcionou:"
echo "   Acesse http://${SERVER_IP}:8080/admin/instances"
echo "   Os links devem apontar para $SERVER_URL"
echo ""
echo "🎯 URLs finais:"
echo "  • Frontend Admin: http://${SERVER_IP}:8080/admin/instances"
echo "  • WhatsApp Health: $SERVER_URL/health"
echo "  • WhatsApp Swagger: $SERVER_URL/api-docs"

chmod +x scripts/configure-production-urls.sh
