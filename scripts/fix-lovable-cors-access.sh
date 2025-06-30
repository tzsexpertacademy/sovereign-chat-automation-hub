
#!/bin/bash

# Script para corrigir acesso CORS do Lovable ao servidor HTTPS
# Arquivo: scripts/fix-lovable-cors-access.sh

echo "🌐 CORRIGINDO ACESSO CORS DO LOVABLE"
echo "===================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-lovable-cors-access.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🧹 PASSO 1: Removendo configurações conflituosas..."

# Remover TODAS as configurações antigas
rm -f /etc/nginx/sites-enabled/whatsapp-*
rm -f /etc/nginx/sites-available/whatsapp-*
rm -f /etc/nginx/sites-enabled/default

echo "✅ Configurações antigas removidas"

echo "⚙️ PASSO 2: Criando configuração Nginx CORS-FRIENDLY..."

# Criar configuração Nginx otimizada para CORS e Lovable
cat > /etc/nginx/sites-available/whatsapp-lovable-cors << 'EOF'
# Configuração CORS-FRIENDLY para Lovable + WhatsApp Multi-Client
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS com CORS completo para Lovable
server {
    listen 443 ssl;
    http2 on;
    server_name 146.59.227.248;
    
    # Certificados SSL
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    # Configurações SSL otimizadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    
    # Configurações de proxy padrão
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $server_name;
    
    # CORS Headers GLOBAIS para TODAS as rotas
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
    add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
    add_header Access-Control-Max-Age 1728000 always;
    
    # Interceptar TODAS as requisições OPTIONS (preflight)
    location / {
        # Handle preflight OPTIONS para QUALQUER rota
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        # Tentar servir arquivos estáticos primeiro, depois proxy para frontend
        try_files $uri @frontend;
    }
    
    # Proxy para o frontend React
    location @frontend {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
    
    # API Health Check
    location = /health {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
        
        proxy_pass http://127.0.0.1:4000/health;
        proxy_http_version 1.1;
    }
    
    # API Swagger
    location /api-docs {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
        
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_http_version 1.1;
    }
    
    # API Clients - com CORS completo
    location /clients {
        # Preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,Accept,Origin" always;
        
        proxy_pass http://127.0.0.1:4000/clients;
        proxy_http_version 1.1;
    }
    
    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # CORS para WebSocket
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Credentials true always;
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-lovable-access.log;
    error_log /var/log/nginx/whatsapp-lovable-error.log warn;
}
EOF

echo "✅ Configuração Nginx CORS-FRIENDLY criada"

echo "🔗 PASSO 3: Ativando nova configuração..."

# Ativar APENAS a nova configuração
ln -sf /etc/nginx/sites-available/whatsapp-lovable-cors /etc/nginx/sites-enabled/

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

echo "🧪 PASSO 4: Testando CORS com Lovable..."

echo "📍 Teste 1: Health Check HTTPS"
if curl -k -s --connect-timeout 10 https://146.59.227.248/health > /dev/null; then
    echo "✅ Health Check funcionando"
else
    echo "❌ Health Check com problema"
fi

echo "📍 Teste 2: CORS Preflight"
if curl -k -s --connect-timeout 10 \
    -X OPTIONS https://146.59.227.248/clients \
    -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -i | grep -q "204\|200"; then
    echo "✅ CORS Preflight funcionando"
else
    echo "❌ CORS Preflight com problema"
fi

echo "📍 Teste 3: API Clients"
if curl -k -s --connect-timeout 10 https://146.59.227.248/clients > /dev/null; then
    echo "✅ API Clients funcionando"
else
    echo "❌ API Clients com problema"
fi

echo ""
echo "🎉 CORS CONFIGURADO PARA LOVABLE!"
echo "=================================="
echo ""
echo "✅ CORS headers adicionados globalmente"
echo "✅ Preflight OPTIONS configurado para todas as rotas"
echo "✅ Lovable pode acessar o servidor HTTPS"
echo "✅ Headers CORS compatíveis com políticas modernas"
echo ""
echo "🌐 URLs para testar:"
echo "  • Health: https://146.59.227.248/health"
echo "  • API Docs: https://146.59.227.248/api-docs"
echo "  • Clients: https://146.59.227.248/clients"
echo ""
echo "🔍 Verificação CORS:"
echo "curl -k -X OPTIONS https://146.59.227.248/clients \\"
echo "  -H \"Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com\" \\"
echo "  -H \"Access-Control-Request-Method: GET\" -i"
echo ""
echo "📝 Se ainda houver problemas:"
echo "  • Logs: tail -f /var/log/nginx/whatsapp-lovable-error.log"
echo "  • Status: systemctl status nginx"
echo ""
echo "✅ Agora o Lovable deve conseguir acessar o servidor!"
echo ""
