
#!/bin/bash

# Script CIRÚRGICO para configurar HTTPS - PRESERVANDO O QUE FUNCIONA
# Arquivo: scripts/setup-simple-https.sh

echo "🔒 CONFIGURANDO HTTPS - PRESERVANDO CONFIGURAÇÃO FUNCIONANDO"
echo "==========================================================="

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

# Criar diretório SSL APENAS se não existir (preservar certificados existentes)
if [ ! -d "$SSL_DIR" ]; then
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
else
    echo "✅ Certificado SSL já existe - PRESERVANDO"
fi

# Criar configuração Nginx CIRÚRGICA - Adicionar apenas rotas que faltam
echo "⚙️ Configurando Nginx CIRURGICAMENTE - Adicionando rotas da API..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server - CONFIGURAÇÃO CIRÚRGICA
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration - PRESERVADA (funciona)
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # CORS Headers - PRESERVADOS (funcionam com Lovable)
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Client-Info, User-Agent, Referer' always;
    add_header 'Access-Control-Allow-Credentials' 'false' always;
    add_header 'Access-Control-Max-Age' '86400' always;
    
    # Frontend - PRESERVADO (funciona)
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health Check - PRESERVADO (funciona)
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # NOVA: API Clients - ADICIONADA CIRURGICAMENTE
    location /clients {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/clients;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Handle preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
            add_header 'Access-Control-Allow-Headers' '*' always;
            add_header 'Access-Control-Max-Age' 86400 always;
            return 204;
        }
    }
    
    # NOVA: Swagger API Docs - ADICIONADA CIRURGICAMENTE
    location /api-docs {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # NOVA: Swagger JSON - ADICIONADA CIRURGICAMENTE
    location /api-docs.json {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs.json;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket para Socket.IO - PRESERVADO (funciona)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
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
echo "🎉 CONFIGURAÇÃO CIRÚRGICA APLICADA COM SUCESSO!"
echo "=============================================="
echo ""
echo "✅ PRESERVADO (já funcionava):"
echo "  • Certificado SSL autoassinado"
echo "  • Rota principal / (frontend)"
echo "  • Rota /health (health check)"
echo "  • Rota /socket.io/ (WebSocket)"
echo "  • Headers CORS para Lovable"
echo ""
echo "➕ ADICIONADO (rotas da API):"
echo "  • Rota /clients (API de clientes)"
echo "  • Rota /api-docs (Swagger UI)"
echo "  • Rota /api-docs.json (Swagger JSON)"
echo ""
echo "🌐 URLs HTTPS disponíveis:"
echo "  • Frontend: https://$DOMAIN/"
echo "  • Health: https://$DOMAIN/health"
echo "  • API Clients: https://$DOMAIN/clients"
echo "  • Swagger: https://$DOMAIN/api-docs"
echo ""
echo "⚠️ IMPORTANTE: ACEITE O CERTIFICADO"
echo "1. Acesse https://$DOMAIN/"
echo "2. Clique em 'Avançado' → 'Prosseguir'"
echo "3. Teste as novas rotas da API"
echo ""
echo "🔧 Para testar: ./scripts/test-https-connection.sh"
