
#!/bin/bash

# Script DEFINITIVO para configurar HTTPS em produção
# Arquivo: scripts/setup-https-production-definitive.sh

echo "🔒 CONFIGURAÇÃO HTTPS DEFINITIVA PARA PRODUÇÃO"
echo "============================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-https-production-definitive.sh"
    exit 1
fi

# Configurações
DOMAIN="146.59.227.248"
EMAIL="admin@whatsapp-multi-client.com"
BACKEND_PORT=4000
FRONTEND_PORT=8080
HTTPS_PORT=443

echo "📋 Configuração HTTPS Definitiva:"
echo "  • Domínio/IP: $DOMAIN"
echo "  • Backend: porta $BACKEND_PORT"
echo "  • Frontend: porta $FRONTEND_PORT"
echo "  • HTTPS: porta $HTTPS_PORT"
echo "  • Email: $EMAIL"
echo ""

# Parar serviços existentes
echo "⏸️ Parando serviços existentes..."
./scripts/production-stop-whatsapp.sh 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Instalar dependências
echo "📦 Instalando dependências..."
apt-get update -y
apt-get install -y nginx openssl curl ufw

# Configurar firewall
echo "🔥 Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow $BACKEND_PORT/tcp
ufw allow $FRONTEND_PORT/tcp
echo "y" | ufw enable 2>/dev/null || true

# Criar certificado SSL autoassinado ROBUSTO
echo "🔐 Criando certificado SSL robusto..."
mkdir -p /etc/ssl/whatsapp-multi-client
rm -f /etc/ssl/whatsapp-multi-client/*

# Configuração SSL avançada
cat > /tmp/ssl-config.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = BR
ST = São Paulo
L = São Paulo
O = WhatsApp Multi-Client
OU = Production Server
CN = $DOMAIN
emailAddress = $EMAIL

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names
basicConstraints = CA:FALSE

[alt_names]
DNS.1 = $DOMAIN
IP.1 = $DOMAIN
DNS.2 = localhost
IP.2 = 127.0.0.1
EOF

# Gerar chave e certificado
openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
    -keyout /etc/ssl/whatsapp-multi-client/private.key \
    -out /etc/ssl/whatsapp-multi-client/certificate.crt \
    -config /tmp/ssl-config.conf \
    -extensions v3_req

# Definir permissões
chmod 600 /etc/ssl/whatsapp-multi-client/private.key
chmod 644 /etc/ssl/whatsapp-multi-client/certificate.crt

echo "✅ Certificado SSL robusto criado!"

# Configurar Nginx HTTPS DEFINITIVO
echo "⚙️ Configurando Nginx HTTPS definitivo..."
cat > /etc/nginx/sites-available/whatsapp-multi-client-https << 'EOF'
# Configuração HTTPS DEFINITIVA - WhatsApp Multi-Client

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
    ssl_certificate /etc/ssl/whatsapp-multi-client/certificate.crt;
    ssl_certificate_key /etc/ssl/whatsapp-multi-client/private.key;
    
    # Configurações SSL modernas e seguras
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Configuração de CORS para Lovable
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
    
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
    
    # API Backend - TODAS as rotas
    location ~ ^/(clients|health|api-docs) {
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
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
        
        # CORS para API responses
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
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
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/whatsapp-multi-client-https
sed -i "s/BACKEND_PORT_PLACEHOLDER/$BACKEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client-https
sed -i "s/FRONTEND_PORT_PLACEHOLDER/$FRONTEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client-https

# Ativar site HTTPS
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/whatsapp-multi-client
ln -sf /etc/nginx/sites-available/whatsapp-multi-client-https /etc/nginx/sites-enabled/

# Testar configuração
echo "🧪 Testando configuração Nginx..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Iniciar serviços
systemctl enable nginx
systemctl restart nginx

echo "✅ Nginx HTTPS configurado e iniciado!"

# Aguardar Nginx
sleep 3

# Iniciar WhatsApp Server
echo "🚀 Iniciando WhatsApp Server..."
if [ -f "./scripts/production-start-whatsapp.sh" ]; then
    ./scripts/production-start-whatsapp.sh
else
    echo "⚠️ Script de produção não encontrado, iniciando manualmente..."
    cd server && nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-server.log 2>&1 &
    echo $! > ../logs/whatsapp-server.pid
    cd ..
fi

# Aguardar servidor inicializar
sleep 5

# Testar conexões
echo "🧪 Testando conexões HTTPS..."

# Testar Health Check
if curl -k -s https://$DOMAIN/health > /dev/null; then
    echo "✅ Health Check HTTPS funcionando!"
else
    echo "⚠️ Health Check HTTPS com problemas"
fi

# Testar API
if curl -k -s https://$DOMAIN/clients > /dev/null; then
    echo "✅ API HTTPS funcionando!"
else
    echo "⚠️ API HTTPS com problemas"
fi

echo ""
echo "🎉 HTTPS CONFIGURADO COM SUCESSO!"
echo "================================="
echo ""
echo "✅ Certificado SSL robusto criado"
echo "✅ Nginx configurado para HTTPS"
echo "✅ CORS habilitado para Lovable"
echo "✅ WhatsApp Server iniciado"
echo ""
echo "🌐 URLs HTTPS:"
echo "  • Frontend: https://$DOMAIN/"
echo "  • Admin: https://$DOMAIN/admin/instances"
echo "  • API Health: https://$DOMAIN/health"
echo "  • Swagger: https://$DOMAIN/api-docs"
echo ""
echo "🔒 Certificado SSL:"
echo "  • Válido por: 365 dias"
echo "  • Localização: /etc/ssl/whatsapp-multi-client/"
echo "  • Tipo: Autoassinado (RSA 4096 bits)"
echo ""
echo "⚠️ IMPORTANTE:"
echo "  • Certificado autoassinado - navegador mostrará aviso"
echo "  • Clique 'Avançado' > 'Prosseguir para $DOMAIN'"
echo "  • Para certificado válido, use Let's Encrypt ou Cloudflare"
echo ""
echo "🔧 Comandos úteis:"
echo "  • Status Nginx: systemctl status nginx"
echo "  • Logs Nginx: tail -f /var/log/nginx/error.log"
echo "  • Logs WhatsApp: tail -f logs/whatsapp-server.log"
echo "  • Renovar certificado: openssl req -x509 -nodes -days 365..."
echo ""
echo "🎯 Próximo passo:"
echo "  • Acesse https://$DOMAIN/ e aceite o certificado"
echo "  • No Lovable, clique 'Verificar Conexão'"
echo "  • Sistema estará 100% HTTPS!"
echo ""
