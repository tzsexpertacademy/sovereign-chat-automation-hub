
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

# Criar diretório SSL
echo "🔐 Criando certificado SSL..."
mkdir -p $SSL_DIR

# Gerar chave privada e certificado autoassinado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $SSL_DIR/privkey.pem \
    -out $SSL_DIR/fullchain.pem \
    -subj "/C=BR/ST=State/L=City/O=WhatsApp/OU=MultiClient/CN=$DOMAIN" \
    2>/dev/null

# Definir permissões
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem

echo "✅ Certificado SSL criado!"

# Criar configuração Nginx com HTTPS
echo "⚙️ Configurando Nginx para HTTPS..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Frontend
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health Check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
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
    }
}
EOF

# Ativar site
echo "🔗 Ativando configuração..."
ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

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
echo "🎉 HTTPS CONFIGURADO COM SUCESSO!"
echo "================================="
echo ""
echo "✅ Certificado autoassinado criado e configurado!"
echo "🌐 Acesse: https://$DOMAIN/"
echo ""
echo "⚠️ IMPORTANTE: AVISO DE SEGURANÇA"
echo "Seu navegador mostrará um aviso de segurança porque o certificado é autoassinado."
echo ""
echo "🔧 Para aceitar o certificado:"
echo "1. Acesse https://$DOMAIN/"
echo "2. Clique em 'Avançado' ou 'Advanced'"
echo "3. Clique em 'Prosseguir para $DOMAIN' ou 'Proceed to $DOMAIN'"
echo ""
echo "🌐 URLs HTTPS disponíveis:"
echo "  • Frontend: https://$DOMAIN/"
echo "  • Admin: https://$DOMAIN/admin/instances"
echo "  • API: https://$DOMAIN/api/"
echo "  • Health: https://$DOMAIN/health"
echo ""
echo "🔧 Comandos úteis:"
echo "  • Status Nginx: systemctl status nginx"
echo "  • Logs Nginx: tail -f /var/log/nginx/error.log"
echo "  • Reiniciar Nginx: systemctl restart nginx"
echo ""
echo "📋 Próximo passo:"
echo "Execute: ./scripts/update-frontend-urls.sh"
echo ""
EOF
