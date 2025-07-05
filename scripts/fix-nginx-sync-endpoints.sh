#!/bin/bash

echo "🔧 CONFIGURANDO NGINX PARA ENDPOINTS DE SINCRONIZAÇÃO"
echo "==================================================="

# Backup da configuração atual
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# Criar nova configuração com endpoints de sincronização
cat << 'EOF' | sudo tee /etc/nginx/sites-available/default > /dev/null
server {
    listen 80;
    listen [::]:80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 146.59.227.248;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Frontend (port 8080)
    location / {
        proxy_pass http://127.0.0.1:8080;
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

    # WhatsApp API (port 4000) - Rotas principais
    location ~ ^/(health|clients|api-docs) {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # CORS Headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # 🔄 NOVOS ENDPOINTS DE SINCRONIZAÇÃO
    location ~ ^/sync {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # CORS Headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Socket.IO para WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "✅ Configuração nginx atualizada"

# Testar configuração
echo "🧪 Testando configuração nginx..."
if sudo nginx -t; then
    echo "✅ Configuração nginx válida"
    
    echo "🔄 Recarregando nginx..."
    sudo systemctl reload nginx
    
    echo "✅ Nginx recarregado com sucesso"
    
    echo ""
    echo "🌐 ENDPOINTS HABILITADOS:"
    echo "  • Frontend: https://146.59.227.248/"
    echo "  • API Health: https://146.59.227.248/health"
    echo "  • API Clients: https://146.59.227.248/clients"
    echo "  • 🆕 Sync Status: https://146.59.227.248/sync/status"
    echo "  • 🆕 Sync Database: https://146.59.227.248/sync/database"
    echo "  • API Swagger: https://146.59.227.248/api-docs"
else
    echo "❌ Erro na configuração nginx"
    echo "🔄 Restaurando backup..."
    sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default 2>/dev/null || true
    exit 1
fi

echo ""
echo "🧪 TESTE RÁPIDO:"
echo "curl -k -s https://146.59.227.248/sync/status | jq '.sync_status.is_synchronized'"