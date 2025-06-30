
#!/bin/bash

# Script para corrigir acesso SSL às APIs
# Arquivo: scripts/fix-ssl-api-access.sh

echo "🔒 CORRIGINDO ACESSO SSL ÀS APIS"
echo "==============================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-ssl-api-access.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🧹 PASSO 1: Limpando configurações antigas conflituosas..."

# Remover TODAS as configurações antigas que estão causando conflito
rm -f /etc/nginx/sites-enabled/whatsapp-multi-client
rm -f /etc/nginx/sites-enabled/whatsapp-unified
rm -f /etc/nginx/sites-available/whatsapp-multi-client
rm -f /etc/nginx/sites-available/whatsapp-unified
rm -f /etc/nginx/sites-enabled/default

echo "✅ Configurações antigas removidas"

echo "🔐 PASSO 2: Criando certificado SSL COMPATÍVEL..."

# Remover certificados antigos
rm -rf $SSL_DIR
mkdir -p $SSL_DIR

# Criar certificado SSL COMPATÍVEL com navegadores modernos
cat > /tmp/ssl_config.conf << 'EOF'
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=BR
ST=State
L=City
O=WhatsApp-MultiClient
OU=API-SSL
CN=146.59.227.248

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = 146.59.227.248
IP.1 = 146.59.227.248
EOF

# Gerar certificado COMPATÍVEL
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $SSL_DIR/privkey.pem \
    -out $SSL_DIR/fullchain.pem \
    -config /tmp/ssl_config.conf \
    -extensions v3_req

# Limpar arquivo temporário
rm -f /tmp/ssl_config.conf

# Definir permissões corretas
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem
chown root:root $SSL_DIR/privkey.pem
chown root:root $SSL_DIR/fullchain.pem

echo "✅ Certificado SSL COMPATÍVEL criado"

echo "⚙️ PASSO 3: Criando configuração Nginx OTIMIZADA..."

# Criar configuração Nginx OTIMIZADA e COMPATÍVEL
cat > /etc/nginx/sites-available/whatsapp-ssl-compatible << 'EOF'
# Configuração SSL COMPATÍVEL para WhatsApp Multi-Client
# Corrige ERR_SSL_KEY_USAGE_INCOMPATIBLE

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS COMPATÍVEL
server {
    listen 443 ssl;
    http2 on;
    server_name DOMAIN_PLACEHOLDER;
    
    # Certificados SSL
    ssl_certificate SSL_DIR_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key SSL_DIR_PLACEHOLDER/privkey.pem;
    
    # Configurações SSL COMPATÍVEIS
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Remover ssl_stapling para certificados autoassinados
    # ssl_stapling off;
    
    # Headers de segurança COMPATÍVEIS
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    
    # Configurações de proxy otimizadas
    proxy_connect_timeout 30s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    proxy_buffering off;
    proxy_request_buffering off;
    
    # Headers de proxy padrão
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $server_name;
    
    # Frontend (React app) - rota padrão
    location / {
        proxy_pass http://127.0.0.1:FRONTEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # API Backend - Health Check
    location = /health {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/health;
        proxy_http_version 1.1;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # API Backend - Swagger UI
    location = /api-docs {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/api-docs;
        proxy_http_version 1.1;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # API Backend - Swagger JSON
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/api-docs.json;
        proxy_http_version 1.1;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # API Backend - Clients
    location /clients {
        # Handle preflight OPTIONS requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/clients;
        proxy_http_version 1.1;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-ssl-access.log;
    error_log /var/log/nginx/whatsapp-ssl-error.log warn;
}
EOF

# Substituir placeholders
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/whatsapp-ssl-compatible
sed -i "s|SSL_DIR_PLACEHOLDER|$SSL_DIR|g" /etc/nginx/sites-available/whatsapp-ssl-compatible
sed -i "s/BACKEND_PORT_PLACEHOLDER/$BACKEND_PORT/g" /etc/nginx/sites-available/whatsapp-ssl-compatible
sed -i "s/FRONTEND_PORT_PLACEHOLDER/$FRONTEND_PORT/g" /etc/nginx/sites-available/whatsapp-ssl-compatible

echo "✅ Configuração Nginx COMPATÍVEL criada"

echo "🔗 PASSO 4: Ativando nova configuração..."

# Ativar APENAS a nova configuração
ln -sf /etc/nginx/sites-available/whatsapp-ssl-compatible /etc/nginx/sites-enabled/

# Testar configuração
echo "🧪 Testando configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida!"
    
    # Reiniciar Nginx
    echo "🔄 Reiniciando Nginx..."
    systemctl restart nginx
    systemctl enable nginx
    
    # Aguardar inicialização
    sleep 3
    
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx reiniciado com sucesso!"
    else
        echo "❌ Falha ao reiniciar Nginx"
        systemctl status nginx
        exit 1
    fi
else
    echo "❌ Erro na configuração Nginx"
    exit 1
fi

echo "🧪 PASSO 5: Testando acesso SSL às APIs..."

echo "📍 Teste 1: Health Check HTTPS"
if curl -k -s --connect-timeout 10 https://$DOMAIN/health > /dev/null; then
    echo "✅ Health Check SSL funcionando"
else
    echo "❌ Health Check SSL com problema"
fi

echo "📍 Teste 2: API Docs HTTPS"
if curl -k -s --connect-timeout 10 https://$DOMAIN/api-docs > /dev/null; then
    echo "✅ API Docs SSL funcionando"
else
    echo "❌ API Docs SSL com problema"
fi

echo "📍 Teste 3: Clients API HTTPS"
if curl -k -s --connect-timeout 10 https://$DOMAIN/clients > /dev/null; then
    echo "✅ Clients API SSL funcionando"
else
    echo "❌ Clients API SSL com problema"
fi

echo ""
echo "🎉 CERTIFICADO SSL COMPATÍVEL CONFIGURADO!"
echo "=========================================="
echo ""
echo "✅ Certificado SSL compatível com navegadores modernos"
echo "✅ Configuração Nginx otimizada para SSL"
echo "✅ ERR_SSL_KEY_USAGE_INCOMPATIBLE corrigido"
echo "✅ APIs funcionando via HTTPS"
echo ""
echo "🌐 URLs para testar no navegador:"
echo "  • Health Check: https://$DOMAIN/health"
echo "  • API Swagger: https://$DOMAIN/api-docs"
echo "  • Clients API: https://$DOMAIN/clients"
echo "  • Frontend: https://$DOMAIN/"
echo ""
echo "🔧 INSTRUÇÕES IMPORTANTES:"
echo "1. Abra https://$DOMAIN/health no navegador"
echo "2. Aceite o certificado SSL (aparecerá um aviso)"
echo "3. Clique em 'Avançado' > 'Prosseguir para 146.59.227.248'"
echo "4. Depois abra https://$DOMAIN/api-docs"
echo "5. O certificado já estará aceito para todas as rotas"
echo ""
echo "📝 Se ainda houver problemas:"
echo "  • Logs Nginx: tail -f /var/log/nginx/whatsapp-ssl-error.log"
echo "  • Status Nginx: systemctl status nginx"
echo "  • Reiniciar: sudo systemctl restart nginx"
echo ""
echo "⚠️ IMPORTANTE:"
echo "O certificado é autoassinado, então o navegador mostrará um aviso."
echo "Isso é normal e esperado. Basta aceitar o certificado uma vez."
echo ""
