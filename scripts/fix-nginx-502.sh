
#!/bin/bash

# Script para corrigir erro 502 Bad Gateway no Nginx
# Arquivo: scripts/fix-nginx-502.sh

echo "🔧 CORRIGINDO ERRO 502 BAD GATEWAY DO NGINX"
echo "=========================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-nginx-502.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🔍 Diagnosticando problema..."

# Verificar se servidor Node.js está rodando
if ! curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
    echo "❌ Servidor Node.js não está respondendo na porta $BACKEND_PORT"
    echo "🔧 Iniciando servidor..."
    cd /home/ubuntu/sovereign-chat-automation-hub || cd .
    ./scripts/production-start-whatsapp.sh
    sleep 10
fi

# Verificar novamente
if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
    echo "✅ Servidor Node.js respondendo na porta $BACKEND_PORT"
else
    echo "❌ Falha ao iniciar servidor Node.js"
    exit 1
fi

# Parar Nginx
echo "⏸️ Parando Nginx..."
systemctl stop nginx

# Criar nova configuração Nginx corrigida
echo "⚙️ Criando nova configuração Nginx..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# Configuração HTTPS Corrigida - WhatsApp Multi-Client

# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS Principal
server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    # Certificados SSL
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    # Configurações SSL otimizadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Configurações de proxy otimizadas - TIMEOUTS AUMENTADOS
    proxy_connect_timeout 30s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
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
        
        # Timeouts específicos para frontend
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # API Backend - Health Check
    location /health {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER/health;
        proxy_http_version 1.1;
        
        # Timeouts reduzidos para health check
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # API Backend - Todas as rotas da API
    location ~ ^/(clients|api-docs) {
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
        
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        
        # Timeouts estendidos para API WhatsApp (conectar pode demorar)
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # CORS para responses da API
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
        
        # Timeouts para WebSocket
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Logs de acesso e erro específicos
    access_log /var/log/nginx/whatsapp-access.log;
    error_log /var/log/nginx/whatsapp-error.log warn;
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
echo "🚀 Iniciando Nginx..."
systemctl start nginx
systemctl enable nginx

# Aguardar inicialização
sleep 5

# Verificar status
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx iniciado com sucesso!"
else
    echo "❌ Falha ao iniciar Nginx"
    systemctl status nginx
    exit 1
fi

# Teste de conectividade
echo "🧪 Testando conectividade..."

echo "📍 Teste 1: Health check local"
curl -s http://localhost:$BACKEND_PORT/health | head -5 || echo "❌ Falha no teste local"

echo "📍 Teste 2: Health check via Nginx HTTP"
curl -s http://$DOMAIN/health | head -5 || echo "❌ Falha no teste HTTP"

echo "📍 Teste 3: Health check via Nginx HTTPS (ignorando SSL)"
curl -k -s https://$DOMAIN/health | head -5 || echo "❌ Falha no teste HTTPS"

echo "📍 Teste 4: API Swagger via HTTPS"
curl -k -s https://$DOMAIN/api-docs | head -10 || echo "❌ Falha no teste Swagger"

echo ""
echo "🎉 CORREÇÃO 502 CONCLUÍDA COM TIMEOUTS AUMENTADOS!"
echo "================================================="
echo ""
echo "✅ Nginx reconfigurado com timeouts estendidos:"
echo "  • Health Check: 10s"
echo "  • API WhatsApp: 120s (conectar/desconectar)"
echo "  • WebSocket: 300s"
echo "✅ Proxy para backend otimizado"
echo "✅ CORS configurado"
echo ""
echo "🌐 URLs para testar:"
echo "  • HTTPS Health: https://$DOMAIN/health"
echo "  • HTTPS API: https://$DOMAIN/api-docs"
echo "  • HTTPS Frontend: https://$DOMAIN/"
echo ""
echo "📝 Logs para monitorar:"
echo "  • Nginx geral: tail -f /var/log/nginx/error.log"
echo "  • WhatsApp específico: tail -f /var/log/nginx/whatsapp-error.log"
echo "  • Backend: tail -f logs/whatsapp-multi-client.log"
echo ""
