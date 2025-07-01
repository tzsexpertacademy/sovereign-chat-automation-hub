
#!/bin/bash

# Script de correção completa do Nginx para WhatsApp Multi-Client
# Arquivo: scripts/fix-nginx-complete.sh

echo "🔧 CORREÇÃO COMPLETA DO NGINX"
echo "=============================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-nginx-complete.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🔍 Passo 1: Backup da configuração atual..."
BACKUP_DIR="/tmp/nginx-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/" 2>/dev/null || true
echo "💾 Backup salvo em: $BACKUP_DIR"

echo "🔧 Passo 2: Criando configuração Nginx CORRETA..."

# Criar configuração Nginx completamente nova e funcional
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
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
    
    # Global settings
    client_max_body_size 50M;
    proxy_buffering off;
    
    # 1. HEALTH CHECK - Primeira prioridade
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 10s;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
    }
    
    # 3. API CLIENTS - Terceira prioridade (CRÍTICO)
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        
        # CORS Headers para API
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 4. API DOCS - Quarta prioridade (CRÍTICO para Swagger)
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        
        # CORS Headers para Swagger
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS Headers para JSON
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 5. FRONTEND - Última prioridade (catch-all)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-access.log;
    error_log /var/log/nginx/whatsapp-error.log warn;
}
EOF

echo "🧪 Passo 3: Testando configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Aplicando..."
    systemctl reload nginx
    sleep 3
    
    echo "🔍 Passo 4: Testando endpoints..."
    
    # Testar endpoints críticos
    echo "Health Check:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/health"
    
    echo "API Clients:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/clients"
    
    echo "API Docs:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/api-docs"
    
    echo "WebSocket:"
    curl -k -s -I "https://$DOMAIN/socket.io/" | head -1
    
    echo ""
    echo "🎉 NGINX CORRIGIDO COM SUCESSO!"
    echo "==============================="
    echo "✅ Proxy configurado para todas as rotas"
    echo "✅ CORS habilitado para API completa"
    echo "✅ WebSocket configurado corretamente"
    echo "✅ Swagger acessível em: https://$DOMAIN/api-docs"
    
else
    echo "❌ Erro na configuração! Restaurando backup..."
    if [ -f "$BACKUP_DIR/whatsapp-multi-client" ]; then
        cp "$BACKUP_DIR/whatsapp-multi-client" /etc/nginx/sites-available/
        systemctl reload nginx
    fi
    exit 1
fi

echo ""
echo "📍 PRÓXIMOS PASSOS:"
echo "1. Acesse o frontend: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo "2. Teste a criação de uma nova instância"
echo "3. O QR Code deve aparecer automaticamente"
echo "4. Escaneie com WhatsApp"
echo ""
echo "🔧 Para debug:"
echo "• Status: systemctl status nginx"
echo "• Logs: tail -f /var/log/nginx/whatsapp-error.log"
echo "• PM2: pm2 status"
