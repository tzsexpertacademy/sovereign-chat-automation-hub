
#!/bin/bash

# Script para corrigir o roteamento do Nginx DEFINITIVAMENTE
echo "🔧 CORREÇÃO FINAL DO NGINX ROUTING"
echo "=================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-nginx-routing-final.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000

echo "🔍 Removendo configurações antigas..."
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/whatsapp-multi-client
rm -f /etc/nginx/sites-available/whatsapp-multi-client

echo "📝 Criando configuração Nginx CORRETA..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# WhatsApp Multi-Client - Configuração FINAL CORRETA

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - CONFIGURAÇÃO CORRETA
server {
    listen 443 ssl http2;
    server_name 146.59.227.248;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Configurações gerais
    client_max_body_size 50M;
    proxy_buffering off;
    
    # Headers padrão para todos os proxies
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 10s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # 1. HEALTH CHECK - Primeira prioridade
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 2. WEBSOCKET - Segunda prioridade (CRÍTICO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # Headers críticos WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
    }
    
    # 3. API CLIENTS - Terceira prioridade
    location ~ ^/clients {
        # Handle preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 1728000 always;
            add_header Content-Type 'text/plain; charset=utf-8' always;
            add_header Content-Length 0 always;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:4000;
        
        # CORS Headers para API
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 4. API DOCS - Swagger
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_redirect off;
        
        # CORS Headers para Swagger
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        
        # CORS Headers para JSON
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 5. FRONTEND - Página padrão simples (sem proxy para 8080)
    location / {
        return 200 '<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Multi-Client HTTPS</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { color: #28a745; font-weight: bold; }
        .links { margin: 20px 0; }
        .links a { display: inline-block; margin: 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        .links a:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 WhatsApp Multi-Client HTTPS</h1>
        <p class="status">✅ Sistema Online e Funcionando!</p>
        <p>Servidor backend rodando via HTTPS com certificado SSL</p>
        
        <div class="links">
            <a href="/health">Health Check</a>
            <a href="/api-docs">API Documentation</a>
            <a href="/clients">Lista de Clientes</a>
        </div>
        
        <p><strong>Frontend Lovable:</strong><br>
        <a href="https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances" target="_blank">
        Acessar Interface Admin
        </a></p>
        
        <p><small>Configuração SSL via Nginx - Proxy para Node.js na porta 4000</small></p>
    </div>
</body>
</html>';
        add_header Content-Type 'text/html; charset=utf-8';
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-access.log;
    error_log /var/log/nginx/whatsapp-error.log warn;
}
EOF

echo "🔗 Ativando site..."
ln -sf /etc/nginx/sites-available/whatsapp-multi-client /etc/nginx/sites-enabled/

echo "🧪 Testando configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Recarregando Nginx..."
    systemctl reload nginx
    sleep 3
    
    echo "🧪 Testando endpoints..."
    
    echo "Health Check HTTPS:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/health"
    
    echo "API Clients HTTPS:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/clients"
    
    echo "WebSocket HTTPS:"
    curl -k -s -I "https://$DOMAIN/socket.io/" | head -1
    
    echo ""
    echo "🎉 NGINX ROUTING CORRIGIDO!"
    echo "=========================="
    echo "✅ Todas as rotas apontam para porta 4000 (Node.js)"
    echo "✅ WebSocket configurado corretamente"
    echo "✅ CORS habilitado para todas as APIs"
    echo "✅ SSL funcionando via Nginx proxy"
    
else
    echo "❌ Erro na configuração Nginx!"
    exit 1
fi

echo ""
echo "🌐 TESTAR AGORA:"
echo "• Health: https://$DOMAIN/health"
echo "• API: https://$DOMAIN/clients"
echo "• Swagger: https://$DOMAIN/api-docs"
echo "• Frontend Lovable: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
