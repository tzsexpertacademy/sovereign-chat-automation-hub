
#!/bin/bash

# Script definitivo para configurar HTTPS no WhatsApp Multi-Client
# Arquivo: scripts/setup-https-definitive.sh

echo "🔒 CONFIGURAÇÃO HTTPS DEFINITIVA"
echo "================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-https-definitive.sh"
    exit 1
fi

# Configurações
DOMAIN="146.59.227.248"
EMAIL="admin@example.com"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "📋 Configurações:"
echo "  • Domínio/IP: $DOMAIN"
echo "  • Backend: porta $BACKEND_PORT"
echo "  • Frontend: porta $FRONTEND_PORT"
echo ""

# Parar serviços existentes
echo "⏸️ Parando serviços..."
./production-stop-whatsapp.sh 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Instalar dependências
echo "📦 Instalando dependências..."
apt-get update -y
apt-get install -y nginx openssl curl

# Configurar firewall
echo "🔥 Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow $BACKEND_PORT/tcp
ufw allow $FRONTEND_PORT/tcp
echo "y" | ufw enable 2>/dev/null || true

# Criar certificado autoassinado melhorado
echo "🔐 Criando certificado SSL..."
mkdir -p /etc/ssl/whatsapp
rm -f /etc/ssl/whatsapp/*

# Criar certificado com SAN (Subject Alternative Names)
cat > /tmp/ssl.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = BR
ST = SP
L = São Paulo
O = WhatsApp Multi-Client
CN = $DOMAIN

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
IP.1 = $DOMAIN
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/whatsapp/privkey.pem \
    -out /etc/ssl/whatsapp/fullchain.pem \
    -config /tmp/ssl.conf \
    -extensions v3_req

chmod 600 /etc/ssl/whatsapp/privkey.pem
chmod 644 /etc/ssl/whatsapp/fullchain.pem

echo "✅ Certificado SSL criado com SAN!"

# Configurar Nginx DEFINITIVO
echo "⚙️ Configurando Nginx..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# Configuração HTTPS Definitiva para WhatsApp Multi-Client

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS Principal
server {
    listen 443 ssl;
    server_name DOMAIN_PLACEHOLDER;
    
    # Certificados SSL
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    # Configurações SSL modernas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # CORS Headers para todas as rotas
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
    
    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
        add_header Access-Control-Max-Age 1728000;
        add_header Content-Type 'text/plain; charset=utf-8';
        add_header Content-Length 0;
        return 204;
    }
    
    # Frontend (React app)
    location / {
        proxy_pass http://127.0.0.1:FRONTEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API Backend - TODAS as rotas da API
    location ~ ^/(clients|health|api-docs) {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        
        # CORS específico para API
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Substituir placeholders
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/whatsapp-multi-client
sed -i "s/BACKEND_PORT_PLACEHOLDER/$BACKEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client
sed -i "s/FRONTEND_PORT_PLACEHOLDER/$FRONTEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client

# Ativar site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/

# Testar configuração
echo "🧪 Testando configuração Nginx..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Iniciar Nginx
systemctl enable nginx
systemctl restart nginx

echo "✅ Nginx configurado e reiniciado!"

# Aguardar Nginx inicializar
sleep 3

# Verificar se Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx não está rodando"
    systemctl status nginx
    exit 1
fi

echo "✅ Nginx está rodando!"

# Reiniciar WhatsApp Server
echo "🚀 Iniciando WhatsApp Server..."
cd "$(dirname "$0")/.."
./scripts/production-start-whatsapp.sh

echo ""
echo "🎉 HTTPS CONFIGURADO COM SUCESSO!"
echo "================================"
echo ""
echo "✅ Certificado SSL criado com SAN"
echo "✅ Nginx configurado com CORS"
echo "✅ WhatsApp Server reiniciado"
echo ""
echo "🌐 URLs HTTPS:"
echo "  • Frontend: https://$DOMAIN/"
echo "  • Admin: https://$DOMAIN/admin/instances"
echo "  • API Health: https://$DOMAIN/health"
echo "  • Swagger: https://$DOMAIN/api-docs"
echo ""
echo "⚠️ IMPORTANTE:"
echo "  • Certificado autoassinado - navegador mostrará aviso"
echo "  • Clique 'Avançado' > 'Prosseguir para $DOMAIN'"
echo "  • Teste a API: curl -k https://$DOMAIN/health"
echo ""
echo "🔧 Logs úteis:"
echo "  • Nginx: tail -f /var/log/nginx/error.log"
echo "  • WhatsApp: tail -f logs/whatsapp-multi-client.log"
echo ""
