
#!/bin/bash

# Script simples para configurar HTTPS com certificado autoassinado
# Arquivo: scripts/setup-simple-https.sh

echo "🔒 CONFIGURANDO HTTPS COM CERTIFICADO AUTOASSINADO"
echo "================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-simple-https.sh"
    exit 1
fi

# Configurações
DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "📋 Configurando certificado autoassinado para $DOMAIN"
echo "⏰ Aguarde alguns minutos..."

# Parar servidor WhatsApp temporariamente
echo "⏸️ Parando servidor WhatsApp..."
if command -v pm2 > /dev/null; then
    pm2 stop whatsapp-multi-client 2>/dev/null || true
fi
pkill -f "whatsapp-multi-client-server" 2>/dev/null || true

# Instalar nginx se necessário
if ! command -v nginx > /dev/null; then
    echo "📦 Instalando Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Parar Nginx e limpar configurações antigas
echo "🧹 Limpando configurações antigas..."
systemctl stop nginx 2>/dev/null || true

# Remover configurações conflitantes
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/whatsapp-*
rm -f /etc/nginx/sites-available/whatsapp-*

# Criar diretório SSL
echo "🔐 Criando certificado SSL..."
mkdir -p $SSL_DIR

# Criar arquivo de configuração SSL temporário
cat > /tmp/ssl_config.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=BR
ST=State
L=City
O=WhatsApp
OU=MultiClient
CN=$DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
IP.1 = $DOMAIN
EOF

# Gerar chave privada e certificado autoassinado COMPATÍVEL COM LOVABLE
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $SSL_DIR/privkey.pem \
    -out $SSL_DIR/fullchain.pem \
    -config /tmp/ssl_config.conf \
    -extensions v3_req

# Limpar arquivo temporário
rm -f /tmp/ssl_config.conf

# Definir permissões
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem

echo "✅ Certificado SSL compatível com Lovable criado!"

# Criar configuração Nginx OTIMIZADA PARA LOVABLE - VERSÃO CORRIGIDA
echo "⚙️ Configurando Nginx para HTTPS + Lovable (Versão Corrigida)..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server - OTIMIZADO PARA LOVABLE
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration - COMPATÍVEL COM LOVABLE
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de segurança COMPATÍVEIS COM LOVABLE
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    
    # CORS Headers GLOBAIS para LOVABLE
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
    add_header Access-Control-Max-Age 1728000 always;
    
    # Configurações de proxy
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    
    # ROTA PRINCIPAL - Frontend React (ESSENCIAL PARA LOVABLE)
    location / {
        # Handle preflight OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        # Proxy para frontend React
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts otimizados
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health Check - ESSENCIAL PARA LOVABLE
    location /health {
        # Handle preflight OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_http_version 1.1;
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    # API Docs
    location /api-docs {
        # Handle preflight OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_http_version 1.1;
    }
    
    # API Backend - Clients (ROTA PRINCIPAL PARA LOVABLE)
    location /clients {
        # Handle preflight OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:$BACKEND_PORT/clients;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Logs específicos para debug
    access_log /var/log/nginx/whatsapp-lovable-access.log;
    error_log /var/log/nginx/whatsapp-lovable-error.log warn;
}
EOF

# Ativar site
echo "🔗 Ativando configuração..."
ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/

# Testar configuração
echo "🧪 Testando configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida!"
    
    # Reiniciar Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    echo "🔄 Nginx reiniciado!"
else
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Aguardar Nginx inicializar
sleep 3

# Reiniciar servidor WhatsApp
echo "▶️ Reiniciando servidor WhatsApp..."
if command -v pm2 > /dev/null; then
    pm2 start whatsapp-multi-client 2>/dev/null || true
fi

echo ""
echo "🎉 HTTPS CONFIGURADO PARA LOVABLE (VERSÃO CORRIGIDA)!"
echo "===================================================="
echo ""
echo "✅ Certificado compatível com Lovable criado!"
echo "✅ CORS headers configurados globalmente"
echo "✅ Preflight OPTIONS configurado para todas as rotas"
echo "✅ Rota principal (/) configurada corretamente"
echo "✅ Timeouts otimizados para Lovable"
echo ""
echo "🌐 Teste TODAS as rotas:"
echo "  • Rota Principal: https://$DOMAIN/"
echo "  • Health Check: https://$DOMAIN/health"
echo "  • API Docs: https://$DOMAIN/api-docs"
echo "  • Clients API: https://$DOMAIN/clients"
echo ""
echo "⚠️ IMPORTANTE: CERTIFICADO AUTOASSINADO"
echo "O navegador mostrará um aviso de segurança."
echo ""
echo "🔧 Para aceitar o certificado:"
echo "1. Acesse https://$DOMAIN/ (ROTA PRINCIPAL)"
echo "2. Clique em 'Avançado' ou 'Advanced'"
echo "3. Clique em 'Prosseguir para $DOMAIN'"
echo "4. Depois teste as outras rotas"
echo ""
echo "🧪 Testes de verificação:"
echo "curl -k https://$DOMAIN/"
echo "curl -k https://$DOMAIN/health"
echo "curl -k https://$DOMAIN/clients"
echo ""
echo "🔍 Teste CORS Lovable (rota principal):"
echo "curl -k -X OPTIONS https://$DOMAIN/ \\"
echo "  -H \"Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com\" \\"
echo "  -H \"Access-Control-Request-Method: GET\" -i"
echo ""
echo "📋 Próximo passo:"
echo "Execute: ./scripts/update-frontend-urls.sh"
echo ""
echo "✅ Configuração CORRIGIDA concluída!"

