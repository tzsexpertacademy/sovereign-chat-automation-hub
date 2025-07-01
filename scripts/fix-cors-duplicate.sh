
#!/bin/bash

# Script para corrigir CORS duplicado no Nginx
# Arquivo: scripts/fix-cors-duplicate.sh

echo "🔧 CORREÇÃO CORS DUPLICADO"
echo "=========================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-cors-duplicate.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🔍 Problema identificado:"
echo "• CORS duplicado: Access-Control-Allow-Origin tem múltiplos valores"
echo "• Nginx está enviando: 'https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com, *'"
echo "• Navegador só aceita UM valor"
echo ""

echo "🔧 Criando configuração Nginx SEM duplicação CORS..."

# Criar configuração Nginx com CORS ÚNICO e correto
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - CORS ÚNICO E CORRETO
server {
    listen 443 ssl;
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
    
    # CORS: Configure apenas UMA vez por localização
    # Usar map para determinar origem permitida
    map $http_origin $cors_origin {
        default "";
        "~^https://19c6b746-780c-41f1-97e3-86e1c8f2c488\.lovableproject\.com$" "https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com";
        "~^https://146\.59\.227\.248$" "https://146.59.227.248";
    }
    
    # 1. HEALTH CHECK - Primeira prioridade
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        
        # CORS Headers - SEM DUPLICAÇÃO
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Max-Age 86400 always;
    }
    
    # 2. WEBSOCKET - Segunda prioridade
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
        
        # CORS Headers - SEM DUPLICAÇÃO
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Credentials true always;
    }
    
    # 3. API CLIENTS - Terceira prioridade
    location ~ ^/clients {
        # Handle preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $cors_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 86400 always;
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
        
        # CORS Headers - SEM DUPLICAÇÃO
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 4. API DOCS - Quarta prioridade
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        
        # CORS Headers - SEM DUPLICAÇÃO
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS Headers - SEM DUPLICAÇÃO
        add_header Access-Control-Allow-Origin $cors_origin always;
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

echo "🧪 Testando configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Aplicando..."
    systemctl reload nginx
    sleep 3
    
    echo "🔍 Testando CORS após correção..."
    
    # Testar com curl simulando browser
    echo "Teste CORS Health Check:"
    curl -k -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
         -H "Access-Control-Request-Method: GET" \
         -H "Access-Control-Request-Headers: Content-Type" \
         -X OPTIONS -I "https://$DOMAIN/health" 2>/dev/null | grep -i "access-control"
    
    echo ""
    echo "🎉 CORS DUPLICADO CORRIGIDO!"
    echo "============================"
    echo "✅ Removida duplicação de headers CORS"
    echo "✅ Usando map para origem específica"
    echo "✅ Headers únicos por localização"
    
    echo ""
    echo "🌐 Teste novamente no frontend:"
    echo "https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    
else
    echo "❌ Erro na configuração Nginx!"
    exit 1
fi

echo ""
echo "📍 Se o problema persistir:"
echo "1. Verifique se o servidor Node.js não está adicionando CORS próprio"
echo "2. Confirme que não há outros sites Nginx interferindo"
echo "3. Reinicie completamente: systemctl restart nginx"
EOF

chmod +x scripts/fix-cors-duplicate.sh

echo "Script criado! Execute agora: sudo ./scripts/fix-cors-duplicate.sh"
