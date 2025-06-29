
#!/bin/bash

# Script para configurar HTTPS no WhatsApp Multi-Client Server
# Arquivo: scripts/setup-https.sh

echo "🔒 CONFIGURANDO HTTPS PARA WHATSAPP MULTI-CLIENT"
echo "==============================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-https.sh"
    exit 1
fi

# Configurações - ALTERE CONFORME NECESSÁRIO
DOMAIN="146.59.227.248"
EMAIL="admin@example.com"  # Altere para seu email
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "📋 Configurações:"
echo "  • Domínio/IP: $DOMAIN"
echo "  • Email: $EMAIL"
echo "  • Backend: porta $BACKEND_PORT"
echo "  • Frontend: porta $FRONTEND_PORT"
echo ""

read -p "🤔 Continuar com a instalação? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Instalação cancelada"
    exit 1
fi

# Detectar sistema operacional
if command -v apt-get &> /dev/null; then
    OS="ubuntu"
elif command -v yum &> /dev/null; then
    OS="centos"
else
    echo "❌ Sistema não suportado. Use Ubuntu/Debian ou CentOS/RHEL"
    exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
if [ "$OS" = "ubuntu" ]; then
    apt-get update -y
    apt-get install -y nginx certbot python3-certbot-nginx ufw curl
else
    yum update -y
    yum install -y nginx certbot python3-certbot-nginx firewalld curl
fi

# Configurar firewall
echo "🔥 Configurando firewall..."
if [ "$OS" = "ubuntu" ]; then
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

# Parar servidor WhatsApp temporariamente
echo "⏸️ Parando servidor WhatsApp..."
if command -v pm2 &> /dev/null; then
    pm2 stop whatsapp-multi-client 2>/dev/null || true
fi
pkill -f "whatsapp-multi-client-server" 2>/dev/null || true

# Criar configuração Nginx
echo "⚙️ Configurando Nginx..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# Configuração inicial para WhatsApp Multi-Client
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    
    # Permitir acesso ao Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Frontend temporário
    location / {
        proxy_pass http://127.0.0.1:FRONTEND_PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
    }
}
EOF

# Substituir placeholders
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/whatsapp-multi-client
sed -i "s/BACKEND_PORT_PLACEHOLDER/$BACKEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client
sed -i "s/FRONTEND_PORT_PLACEHOLDER/$FRONTEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client

# Ativar site
if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

# Criar diretório para Let's Encrypt
mkdir -p /var/www/html/.well-known/acme-challenge

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

# Verificar se podemos usar Let's Encrypt com IP
echo "🔐 Verificando possibilidade de certificado SSL..."
if [[ $DOMAIN =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "⚠️ Detectado IP em vez de domínio."
    echo "💡 Let's Encrypt não funciona com IPs. Opções:"
    echo "   1. Use um domínio próprio (exemplo.com)"
    echo "   2. Use certificado autoassinado"
    echo "   3. Use Cloudflare como proxy"
    echo ""
    read -p "🤔 Criar certificado autoassinado? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Criar certificado autoassinado
        echo "🔒 Criando certificado autoassinado..."
        mkdir -p /etc/ssl/whatsapp
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/ssl/whatsapp/privkey.pem \
            -out /etc/ssl/whatsapp/fullchain.pem \
            -subj "/C=BR/ST=State/L=City/O=Organization/OU=OrgUnit/CN=$DOMAIN"
        
        # Configurar Nginx para HTTPS
        cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://127.0.0.1:FRONTEND_PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
        
        # Substituir placeholders
        sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/whatsapp-multi-client
        sed -i "s/BACKEND_PORT_PLACEHOLDER/$BACKEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client
        sed -i "s/FRONTEND_PORT_PLACEHOLDER/$FRONTEND_PORT/g" /etc/nginx/sites-available/whatsapp-multi-client
        
        nginx -t && systemctl reload nginx
        
        echo ""
        echo "✅ Certificado autoassinado configurado!"
        echo "⚠️ AVISO: Navegadores mostrarão aviso de segurança"
        echo "💡 Para aceitar: Clique 'Avançado' > 'Prosseguir para $DOMAIN'"
        HTTPS_CONFIGURED=true
    else
        echo "❌ HTTPS não configurado"
        HTTPS_CONFIGURED=false
    fi
else
    # Tentar Let's Encrypt
    echo "🔐 Obtendo certificado Let's Encrypt..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
    
    if [ $? -eq 0 ]; then
        echo "✅ Certificado Let's Encrypt configurado!"
        
        # Configurar renovação automática
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        HTTPS_CONFIGURED=true
    else
        echo "❌ Falha ao obter certificado Let's Encrypt"
        HTTPS_CONFIGURED=false
    fi
fi

# Reiniciar servidor WhatsApp
echo "▶️ Reiniciando servidor WhatsApp..."
if command -v pm2 &> /dev/null; then
    pm2 start whatsapp-multi-client 2>/dev/null || true
fi

echo ""
echo "🎉 CONFIGURAÇÃO CONCLUÍDA!"
echo "========================"
echo ""

if [ "$HTTPS_CONFIGURED" = true ]; then
    echo "✅ HTTPS configurado com sucesso!"
    echo "🌐 URLs HTTPS:"
    echo "  • Frontend: https://$DOMAIN/"
    echo "  • Admin: https://$DOMAIN/admin/instances"
    echo "  • API: https://$DOMAIN/api/"
    echo "  • Health: https://$DOMAIN/health"
else
    echo "⚠️ HTTPS não configurado - usando HTTP"
    echo "🌐 URLs HTTP:"
    echo "  • Frontend: http://$DOMAIN/"
    echo "  • Admin: http://$DOMAIN/admin/instances"
    echo "  • API: http://$DOMAIN/api/"
    echo "  • Health: http://$DOMAIN/health"
fi

echo ""
echo "🔧 Comandos úteis:"
echo "  • Status Nginx: systemctl status nginx"
echo "  • Logs Nginx: tail -f /var/log/nginx/error.log"
echo "  • Recarregar Nginx: systemctl reload nginx"
if [ "$HTTPS_CONFIGURED" = true ]; then
    echo "  • Status SSL: certbot certificates"
    echo "  • Renovar SSL: certbot renew"
fi
echo ""
echo "⚠️ IMPORTANTE:"
echo "  • Certifique-se que os serviços estão rodando:"
echo "    - Backend na porta $BACKEND_PORT"
echo "    - Frontend na porta $FRONTEND_PORT"
echo "  • Atualize as URLs no frontend para usar HTTPS"
echo ""
