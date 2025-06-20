
#!/bin/bash

# Script para configurar HTTPS em produção
# Arquivo: scripts/setup-https-production.sh

echo "🔒 CONFIGURANDO HTTPS PARA WHATSAPP MULTI-CLIENTE"
echo "================================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-https-production.sh"
    exit 1
fi

# Verificar sistema operacional
if ! command -v apt-get &> /dev/null && ! command -v yum &> /dev/null; then
    echo "❌ Sistema não suportado. Use Ubuntu/Debian ou CentOS/RHEL"
    exit 1
fi

# Configurações
DOMAIN="146.59.227.248"
EMAIL="admin@example.com"  # Altere para seu email
BACKEND_PORT=4000
FRONTEND_PORT=8080
HTTPS_PORT=443

echo "📋 Configurações:"
echo "  • Domínio/IP: $DOMAIN"
echo "  • Backend: porta $BACKEND_PORT"
echo "  • Frontend: porta $FRONTEND_PORT"
echo "  • HTTPS: porta $HTTPS_PORT"
echo ""

read -p "🤔 Continuar com a instalação? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Instalação cancelada"
    exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
if command -v apt-get &> /dev/null; then
    apt-get update -y
    apt-get install -y nginx certbot python3-certbot-nginx ufw curl
else
    yum update -y
    yum install -y nginx certbot python3-certbot-nginx firewalld curl
fi

# Configurar firewall
echo "🔥 Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow $BACKEND_PORT/tcp
    ufw allow $FRONTEND_PORT/tcp
    echo "y" | ufw enable
else
    firewall-cmd --permanent --add-port=22/tcp
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --permanent --add-port=$BACKEND_PORT/tcp
    firewall-cmd --permanent --add-port=$FRONTEND_PORT/tcp
    firewall-cmd --reload
fi

# Backup configuração nginx existente
if [ -f "/etc/nginx/nginx.conf" ]; then
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
fi

# Criar configuração Nginx
echo "⚙️ Configurando Nginx..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# Configuração para WhatsApp Multi-Cliente com HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirecionar HTTP para HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # Certificados SSL (serão configurados pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Configurações SSL seguras
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Frontend (React app na porta 8080)
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API Backend (WhatsApp Multi-Cliente na porta 4000)
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # Swagger API Docs
    location /api-docs {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Ativar site
if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

# Testar configuração Nginx
echo "🧪 Testando configuração Nginx..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# Iniciar Nginx
systemctl enable nginx
systemctl restart nginx

# Aguardar Nginx inicializar
sleep 3

echo "🔐 Obtendo certificado SSL..."
# Obter certificado Let's Encrypt
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

if [ $? -eq 0 ]; then
    echo "✅ Certificado SSL configurado com sucesso!"
    
    # Configurar renovação automática
    echo "🔄 Configurando renovação automática..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    # Recarregar Nginx
    systemctl reload nginx
    
    echo ""
    echo "🎉 HTTPS CONFIGURADO COM SUCESSO!"
    echo "================================"
    echo ""
    echo "📱 URLs de acesso HTTPS:"
    echo "  • Frontend: https://$DOMAIN/"
    echo "  • Admin: https://$DOMAIN/admin/instances"
    echo "  • API: https://$DOMAIN/api/"
    echo "  • Health: https://$DOMAIN/health"
    echo "  • Swagger: https://$DOMAIN/api-docs"
    echo ""
    echo "🔧 Comandos úteis:"
    echo "  • Status Nginx: systemctl status nginx"
    echo "  • Logs Nginx: tail -f /var/log/nginx/error.log"
    echo "  • Renovar SSL: certbot renew"
    echo "  • Status SSL: certbot certificates"
    echo ""
    echo "⚠️ IMPORTANTE:"
    echo "  • Certifique-se que os serviços estão rodando:"
    echo "    - Frontend na porta $FRONTEND_PORT"
    echo "    - Backend na porta $BACKEND_PORT"
    echo "  • Use o script: ./scripts/production-start-whatsapp.sh"
    echo ""
    
else
    echo "❌ Falha ao obter certificado SSL"
    echo "💡 Alternativas:"
    echo "  1. Use um domínio real em vez de IP"
    echo "  2. Configure certificado autoassinado"
    echo "  3. Use Cloudflare como proxy HTTPS"
    exit 1
fi
EOF
