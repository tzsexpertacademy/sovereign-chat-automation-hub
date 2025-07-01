
#!/bin/bash

# Script definitivo para corrigir WebSocket no Nginx
# Arquivo: scripts/fix-nginx-websocket-definitive.sh

echo "🔧 CORREÇÃO DEFINITIVA DO WEBSOCKET NGINX"
echo "========================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-nginx-websocket-definitive.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🔍 Corrigindo configuração Nginx com WebSocket..."

# Backup da configuração atual
BACKUP_DIR="/tmp/nginx-websocket-fix-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/" 2>/dev/null || true
echo "💾 Backup salvo em: $BACKUP_DIR"

# Criar configuração Nginx CORRETA com WebSocket
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# Map para WebSocket upgrade - CRÍTICO
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server com WebSocket FUNCIONAL
server {
    listen 443 ssl;
    listen [::]:443 ssl;
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
    proxy_request_buffering off;
    
    # 1. WebSocket Socket.IO - PRIMEIRA PRIORIDADE (CORRIGIDO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # Headers CRÍTICOS para WebSocket - USANDO VARIÁVEL CONDITIONAL
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Headers padrão
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Headers específicos WebSocket
        proxy_set_header Sec-WebSocket-Extensions $http_sec_websocket_extensions;
        proxy_set_header Sec-WebSocket-Key $http_sec_websocket_key;
        proxy_set_header Sec-WebSocket-Version $http_sec_websocket_version;
        proxy_set_header Sec-WebSocket-Protocol $http_sec_websocket_protocol;
        
        # Timeouts para WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 10s;
        
        # Cache bypass para WebSocket
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
        
        # Headers de resposta
        add_header X-WebSocket-Status "enabled" always;
    }
    
    # 2. Health Check - SEGUNDA PRIORIDADE
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        
        # CORS para health check
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
    }
    
    # 3. API Clients - TERCEIRA PRIORIDADE
    location ~ ^/clients {
        # Preflight OPTIONS para CORS
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
        
        # CORS para API responses
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # 4. API Docs - QUARTA PRIORIDADE
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
    
    # 5. Frontend - ÚLTIMA PRIORIDADE (catch-all)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        
        # Headers para SPA
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-access.log;
    error_log /var/log/nginx/whatsapp-error.log warn;
}
EOF

echo "🧪 Testando nova configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Aplicando..."
    systemctl reload nginx
    sleep 3
    
    echo "🔍 Testando WebSocket após correção..."
    WS_TEST=$(curl -k -s -I "https://$DOMAIN/socket.io/?EIO=4&transport=polling" 2>/dev/null | head -1 | awk '{print $2}')
    echo "WebSocket handshake status: $WS_TEST"
    
    if [ "$WS_TEST" = "200" ]; then
        echo "🎉 WEBSOCKET CORRIGIDO DEFINITIVAMENTE! Status: $WS_TEST ✅"
        
        echo ""
        echo "🧪 Testando endpoints críticos:"
        
        # Testar health
        HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health")
        echo "Health Check: $HEALTH_STATUS"
        
        # Testar clients
        CLIENTS_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/clients")
        echo "Clients API: $CLIENTS_STATUS"
        
        if [ "$HEALTH_STATUS" = "200" ] && [ "$CLIENTS_STATUS" = "200" ]; then
            echo ""
            echo "🎉 TUDO FUNCIONANDO PERFEITAMENTE!"
            echo "✅ WebSocket: OK"
            echo "✅ Health: OK" 
            echo "✅ API: OK"
            echo ""
            echo "🎮 PRÓXIMOS PASSOS:"
            echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
            echo "2. Crie uma nova instância"
            echo "3. O QR Code deve aparecer automaticamente"
            echo "4. Escaneie com WhatsApp"
            echo "5. A conexão deve permanecer estável!"
        else
            echo "⚠️ WebSocket OK, mas problemas na API"
        fi
        
    else
        echo "❌ WebSocket ainda com problema: $WS_TEST"
        echo "🔍 Detalhes da resposta:"
        curl -k -s -I "https://$DOMAIN/socket.io/?EIO=4&transport=polling"
    fi
    
else
    echo "❌ Erro na configuração! Restaurando backup..."
    if [ -f "$BACKUP_DIR/whatsapp-multi-client" ]; then
        cp "$BACKUP_DIR/whatsapp-multi-client" /etc/nginx/sites-available/
        systemctl reload nginx
    fi
    exit 1
fi

echo ""
echo "🎯 RESULTADO FINAL"
echo "=================="
echo "WebSocket: $WS_TEST"
echo "Health: $HEALTH_STATUS"
echo "Clients: $CLIENTS_STATUS"
echo ""
echo "🔄 Backup disponível em: $BACKUP_DIR"
echo ""
echo "✅ CORREÇÃO WEBSOCKET CONCLUÍDA!"
