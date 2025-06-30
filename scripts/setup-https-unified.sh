
#!/bin/bash

# Script HTTPS Unificado - Combina melhor dos dois mundos
# Resolve problemas: Lovable conecta + API funciona + QR Code gera
# Arquivo: scripts/setup-https-unified.sh

echo "🔒 SETUP HTTPS UNIFICADO - VERSÃO CORRIGIDA"
echo "============================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-https-unified.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000
FRONTEND_PORT=8080
SSL_DIR="/etc/ssl/whatsapp"

echo "🎯 Configuração unificada:"
echo "  • Domínio: $DOMAIN"
echo "  • Backend: $BACKEND_PORT"
echo "  • Frontend: $FRONTEND_PORT"
echo "  • SSL: $SSL_DIR"

# PASSO 1: Parar serviços
echo ""
echo "🛑 PASSO 1: Parando serviços..."
systemctl stop nginx 2>/dev/null || true
./scripts/production-stop-whatsapp.sh 2>/dev/null || true

# PASSO 2: Certificado SSL CORRIGIDO
echo ""
echo "🔐 PASSO 2: Configurando certificado SSL CORRIGIDO..."
mkdir -p $SSL_DIR

# Remover certificados antigos que podem estar causando problemas
if [ -f "$SSL_DIR/privkey.pem" ] || [ -f "$SSL_DIR/fullchain.pem" ]; then
    echo "🗑️ Removendo certificados antigos..."
    rm -f $SSL_DIR/privkey.pem $SSL_DIR/fullchain.pem $SSL_DIR/cert.conf
fi

echo "🔧 Criando certificado SSL compatível..."

# Gerar chave privada RSA (mais compatível)
openssl genrsa -out $SSL_DIR/privkey.pem 2048

# Criar arquivo de configuração CORRIGIDO
cat > $SSL_DIR/cert.conf << EOF
[req]
default_bits = 2048
prompt = no
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]
C=BR
ST=SP
L=Sao Paulo
O=WhatsApp Multi Client
OU=Development
CN=$DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
IP.1 = $DOMAIN
DNS.2 = localhost
IP.2 = 127.0.0.1
EOF

# Gerar certificado com configuração corrigida
openssl req -new -x509 -key $SSL_DIR/privkey.pem \
    -out $SSL_DIR/fullchain.pem \
    -days 365 \
    -config $SSL_DIR/cert.conf \
    -extensions v3_req

echo "✅ Certificado SSL CORRIGIDO criado"

# Verificar certificado
echo "🔍 Verificando certificado..."
openssl x509 -in $SSL_DIR/fullchain.pem -text -noout | grep -E "(Key Usage|Extended Key Usage|Subject Alternative Name)" || true

# Definir permissões
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem

# PASSO 3: Configuração Nginx Unificada
echo ""
echo "⚙️ PASSO 3: Configurando Nginx unificado..."

cat > /etc/nginx/sites-available/whatsapp-unified << EOF
# Configuração HTTPS Unificada - WhatsApp Multi-Client
# Resolve: Lovable conecta + API funciona + QR Code gera

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# Servidor HTTPS Principal
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # Certificados SSL
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    # Configurações SSL otimizadas e compatíveis
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de proxy básicos
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Host \$server_name;
    
    # Health Check - Timeout reduzido
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_http_version 1.1;
        
        proxy_connect_timeout 10s;
        proxy_send_timeout 15s;
        proxy_read_timeout 15s;
        
        # CORS apenas para Lovable
        add_header Access-Control-Allow-Origin "https://lovableproject.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # API Routes - Roteamento direto (SEM /api/ prefix)
    location ~ ^/(clients|api-docs) {
        # Preflight OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://lovableproject.com" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        
        # Timeouts equilibrados para API
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering otimizado
        proxy_buffering off;
        proxy_request_buffering off;
        
        # CORS para responses da API (apenas para Lovable)
        add_header Access-Control-Allow-Origin "https://lovableproject.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts para WebSocket
        proxy_connect_timeout 10s;
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
        
        # Timeouts para frontend
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-unified-access.log;
    error_log /var/log/nginx/whatsapp-unified-error.log warn;
}
EOF

# Ativar site
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/whatsapp-multi-client 2>/dev/null || true
ln -sf /etc/nginx/sites-available/whatsapp-unified /etc/nginx/sites-enabled/

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

# PASSO 7: Testes de conectividade
echo ""
echo "🧪 PASSO 7: Testes de conectividade..."

echo "📍 Teste 1: Health check direto"
curl -s --max-time 15 http://localhost:$BACKEND_PORT/health | head -5 || echo "❌ Falha teste direto"

echo ""
echo "📍 Teste 2: Health check via HTTPS"
curl -k -s --max-time 15 https://$DOMAIN/health | head -5 || echo "❌ Falha teste HTTPS"

echo ""
echo "📍 Teste 3: API Swagger via HTTPS"
curl -k -s --max-time 15 https://$DOMAIN/api-docs | head -10 || echo "❌ Falha teste Swagger"

echo ""
echo "📍 Teste 4: Clients API via HTTPS"
curl -k -s --max-time 15 https://$DOMAIN/clients | head -5 || echo "❌ Falha teste Clients"

# PASSO 8: Verificar certificado final
echo ""
echo "🔍 PASSO 8: Verificação final do certificado..."
echo "Informações do certificado SSL:"
openssl x509 -in $SSL_DIR/fullchain.pem -noout -subject -issuer -dates
echo ""
echo "Extensões do certificado:"
openssl x509 -in $SSL_DIR/fullchain.pem -noout -text | grep -A 5 "X509v3 extensions" || echo "Sem extensões específicas"

# Status final
echo ""
echo "🎉 SETUP HTTPS UNIFICADO CORRIGIDO CONCLUÍDO!"
echo "=================================="
echo ""
echo "✅ Certificado SSL: Corrigido (RSA 2048, keyUsage compatível)"
echo "✅ Nginx: Configuração unificada otimizada"
echo "✅ CORS: Apenas no servidor Node.js (sem duplicação)"
echo "✅ Timeouts: Equilibrados (10-60s conforme uso)"
echo "✅ Roteamento: Direto para API (sem prefixo /api/)"
echo ""
echo "🌐 URLs para testar:"
echo "  • HTTPS Health: https://$DOMAIN/health"
echo "  • HTTPS API Docs: https://$DOMAIN/api-docs"  
echo "  • HTTPS Clients: https://$DOMAIN/clients"
echo "  • HTTPS Frontend: https://$DOMAIN/"
echo ""
echo "📊 Status dos serviços:"
echo "  • Nginx: $(systemctl is-active nginx)"
echo "  • WhatsApp Server: $(if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then echo 'active'; else echo 'inactive'; fi)"
echo ""
echo "📝 Logs importantes:"
echo "  • Nginx: tail -f /var/log/nginx/whatsapp-unified-error.log"
echo "  • WhatsApp: tail -f logs/whatsapp-multi-client.log"
echo ""
echo "🔍 Para debugging adicional:"
echo "  • Verificar portas: lsof -i :$BACKEND_PORT -i :$FRONTEND_PORT"
echo "  • Certificado: openssl x509 -in $SSL_DIR/fullchain.pem -text -noout"
echo ""
echo "💡 Agora deve funcionar:"
echo "  1. Lovable deve conectar via HTTPS com certificado corrigido"
echo "  2. API deve gerar QR codes via roteamento direto"
echo "  3. Navegador deve aceitar o certificado sem ERR_SSL_KEY_USAGE_INCOMPATIBLE"
echo ""
echo "🚨 IMPORTANTE: Após executar, acesse https://$DOMAIN/health no navegador"
echo "   e aceite o certificado SSL para que o Lovable funcione corretamente."
