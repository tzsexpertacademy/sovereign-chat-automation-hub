
#!/bin/bash

# Script alternativo para certificado autoassinado
# Arquivo: scripts/setup-self-signed-ssl.sh

echo "🔒 CONFIGURANDO CERTIFICADO AUTOASSINADO"
echo "======================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-self-signed-ssl.sh"
    exit 1
fi

# Configurações
DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "📋 Configurando certificado autoassinado para $DOMAIN"

# Criar diretório SSL
mkdir -p $SSL_DIR

# Gerar chave privada e certificado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $SSL_DIR/privkey.pem \
    -out $SSL_DIR/fullchain.pem \
    -subj "/C=BR/ST=State/L=City/O=Organization/OU=OrgUnit/CN=$DOMAIN"

# Definir permissões
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem

# Instalar Nginx se necessário
if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y nginx
    else
        yum install -y nginx
    fi
fi

# Criar configuração Nginx com certificado autoassinado
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar e reiniciar Nginx
nginx -t && systemctl restart nginx

echo ""
echo "✅ Certificado autoassinado configurado!"
echo "⚠️ AVISO: Seu navegador mostrará um aviso de segurança"
echo "💡 Para aceitar: Clique em 'Avançado' > 'Prosseguir para $DOMAIN'"
echo ""
echo "🌐 Acesse: https://$DOMAIN/"
EOF
