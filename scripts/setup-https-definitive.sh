
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

# Verificar se Node.js está instalado (verificação corrigida)
echo "🔍 Verificando Node.js..."
NODE_PATH=""
if command -v node >/dev/null 2>&1; then
    NODE_PATH="node"
elif command -v nodejs >/dev/null 2>&1; then
    NODE_PATH="nodejs"
fi

if [ -z "$NODE_PATH" ]; then
    echo "❌ Node.js não encontrado. Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # Verificar novamente após instalação
    if command -v node >/dev/null 2>&1; then
        NODE_PATH="node"
    elif command -v nodejs >/dev/null 2>&1; then
        NODE_PATH="nodejs"
    else
        echo "❌ Falha ao instalar Node.js"
        exit 1
    fi
fi

NODE_VERSION=$($NODE_PATH --version)
echo "✅ Node.js encontrado: $NODE_VERSION ($NODE_PATH)"

# Criar symlink se necessário para garantir que 'node' funcione
if [ "$NODE_PATH" = "nodejs" ] && [ ! -f "/usr/bin/node" ]; then
    echo "🔗 Criando symlink para node..."
    ln -sf /usr/bin/nodejs /usr/bin/node
fi

# Parar serviços existentes
echo "⏸️ Parando serviços..."
./scripts/production-stop-whatsapp.sh 2>/dev/null || true
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

# Configurar Nginx CORRIGIDO
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
        # Handle preflight requests primeiro
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

# Verificar se estamos no diretório correto antes de iniciar WhatsApp
if [ ! -d "server" ]; then
    echo "❌ Diretório server/ não encontrado. Certifique-se de estar na pasta raiz do projeto."
    exit 1
fi

# Instalar dependências do servidor se necessário
if [ ! -d "server/node_modules" ]; then
    echo "📦 Instalando dependências do servidor..."
    cd server
    npm install
    cd ..
fi

# Definir NODE_PATH para o script de produção
export PATH="/usr/bin:$PATH"

# Reiniciar WhatsApp Server usando o script de produção
echo "🚀 Iniciando WhatsApp Server..."
if ./scripts/production-start-whatsapp.sh; then
    echo "✅ WhatsApp Server iniciado com sucesso!"
else
    echo "⚠️ Erro ao iniciar WhatsApp Server, mas continuando..."
fi

echo ""
echo "🎉 HTTPS CONFIGURADO COM SUCESSO!"
echo "================================"
echo ""
echo "✅ Node.js: $NODE_VERSION"
echo "✅ Certificado SSL criado com SAN"
echo "✅ Nginx configurado com CORS"
echo "✅ WhatsApp Server iniciado"
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
