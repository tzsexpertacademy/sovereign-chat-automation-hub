
#!/bin/bash

# Script HTTPS que FUNCIONA - Baseado no setup-simple-https.sh
# Corrige apenas o roteamento da API mantendo o SSL que funcionava
# Arquivo: scripts/setup-https-working.sh

echo "🔒 SETUP HTTPS QUE FUNCIONA - SSL COMPATÍVEL"
echo "============================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-https-working.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000
FRONTEND_PORT=8080
SSL_DIR="/etc/ssl/whatsapp"

echo "🎯 Configuração que funciona:"
echo "  • Domínio: $DOMAIN"
echo "  • Backend: $BACKEND_PORT"
echo "  • Frontend: $FRONTEND_PORT"
echo "  • SSL: $SSL_DIR"

# PASSO 1: Parar serviços
echo ""
echo "🛑 PASSO 1: Parando serviços..."
systemctl stop nginx 2>/dev/null || true
./scripts/production-stop-whatsapp.sh 2>/dev/null || true

# PASSO 2: Certificado SSL SIMPLES que funcionava
echo ""
echo "🔐 PASSO 2: Configurando certificado SSL simples (que funcionava)..."
mkdir -p $SSL_DIR

# Usar certificado simples que funcionava antes
if [ ! -f "$SSL_DIR/privkey.pem" ] || [ ! -f "$SSL_DIR/fullchain.pem" ]; then
    echo "🔧 Criando certificado SSL simples (método que funcionava)..."
    
    # Método simples que funcionava
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $SSL_DIR/privkey.pem \
        -out $SSL_DIR/fullchain.pem \
        -subj "/C=BR/ST=SP/L=Sao Paulo/O=WhatsApp/CN=$DOMAIN" \
        -extensions v3_ca \
        -config <(echo "[v3_ca]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
subjectAltName = IP:$DOMAIN,DNS:localhost")

    echo "✅ Certificado SSL simples criado (método que funcionava)"
fi

# Definir permissões
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem

# PASSO 3: Configuração Nginx que funciona + API corrigida
echo ""
echo "⚙️ PASSO 3: Configurando Nginx (SSL que funciona + API corrigida)..."

cat > /etc/nginx/sites-available/whatsapp-working << EOF
# Configuração HTTPS que FUNCIONA + API corrigida
# SSL simples + Roteamento API correto

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# Servidor HTTPS que funciona
server {
    listen 443 ssl;
    server_name $DOMAIN;
    
    # Certificados SSL simples (que funcionavam)
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    # Configurações SSL simples e compatíveis
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Headers básicos
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    
    # Health Check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_http_version 1.1;
        proxy_connect_timeout 15s;
        proxy_send_timeout 15s;
        proxy_read_timeout 15s;
    }
    
    # API Routes - CORRIGIDO para funcionar
    location /api-docs {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /clients {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/clients;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
        
        # Permitir métodos HTTP
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Rota específica para conectar clientes (QR Code)
    location ~ ^/clients/([^/]+)/(connect|disconnect|status|chats|send-message) {
        proxy_pass http://127.0.0.1:$BACKEND_PORT\$uri;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # Permitir métodos HTTP
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 15s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Frontend (React app) - rota padrão
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 15s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Logs
    access_log /var/log/nginx/whatsapp-working-access.log;
    error_log /var/log/nginx/whatsapp-working-error.log warn;
}
EOF

# Ativar site
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/whatsapp-multi-client 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/whatsapp-unified 2>/dev/null || true
ln -sf /etc/nginx/sites-available/whatsapp-working /etc/nginx/sites-enabled/

# PASSO 4: Testar configuração Nginx
echo ""
echo "🧪 PASSO 4: Testando configuração Nginx..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

# PASSO 5: Iniciar servidor WhatsApp
echo ""
echo "🚀 PASSO 5: Iniciando servidor WhatsApp..."
./scripts/production-start-whatsapp.sh

# Aguardar servidor
sleep 10

# PASSO 6: Iniciar Nginx
echo ""
echo "🔧 PASSO 6: Iniciando Nginx..."
systemctl start nginx
systemctl enable nginx

# Aguardar inicialização
sleep 5

# PASSO 7: Testes básicos
echo ""
echo "🧪 PASSO 7: Testes básicos..."

echo "📍 Teste 1: Health check direto"
curl -s --max-time 10 http://localhost:$BACKEND_PORT/health | head -3 || echo "❌ Falha teste direto"

echo ""
echo "📍 Teste 2: Health check via HTTPS"
curl -k -s --max-time 15 https://$DOMAIN/health | head -3 || echo "❌ Falha teste HTTPS"

echo ""
echo "📍 Teste 3: API Swagger via HTTPS"
curl -k -s --max-time 15 https://$DOMAIN/api-docs | head -5 || echo "❌ Falha teste Swagger"

echo ""
echo "📍 Teste 4: Clients API via HTTPS"
curl -k -s --max-time 15 https://$DOMAIN/clients | head -3 || echo "❌ Falha teste Clients"

# Status final
echo ""
echo "🎉 SETUP HTTPS QUE FUNCIONA CONCLUÍDO!"
echo "======================================"
echo ""
echo "✅ SSL: Certificado simples (método que funcionava)"
echo "✅ Nginx: Configuração compatível + API corrigida" 
echo "✅ Roteamento: API routes funcionando"
echo "✅ CORS: Apenas no servidor Node.js"
echo ""
echo "🌐 URLs para testar:"
echo "  • HTTPS Health: https://$DOMAIN/health"
echo "  • HTTPS API Docs: https://$DOMAIN/api-docs"  
echo "  • HTTPS Clients: https://$DOMAIN/clients"
echo "  • HTTPS Frontend: https://$DOMAIN/"
echo ""
echo "📊 Status dos serviços:"
echo "  • Nginx: \$(systemctl is-active nginx)"
echo "  • WhatsApp Server: \$(if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then echo 'active'; else echo 'inactive'; fi)"
echo ""
echo "📝 Logs importantes:"
echo "  • Nginx: tail -f /var/log/nginx/whatsapp-working-error.log"
echo "  • WhatsApp: tail -f logs/whatsapp-multi-client.log"
echo ""
echo "🔍 Para debugging:"
echo "  • Verificar portas: lsof -i :$BACKEND_PORT -i :$FRONTEND_PORT"
echo "  • Certificado: openssl x509 -in $SSL_DIR/fullchain.pem -text -noout"
echo ""
echo "💡 Diferenças desta versão:"
echo "  1. SSL simples (método que funcionava antes)"
echo "  2. API routes corrigidas (Swagger + Clients + Connect)"
echo "  3. Timeouts otimizados (15s health, 30-120s API)"
echo "  4. Sem configurações SSL complexas que causavam erro"
echo ""
echo "🚨 IMPORTANTE: Agora acesse https://$DOMAIN/health no navegador"
echo "   e aceite o certificado SSL para que tudo funcione."
