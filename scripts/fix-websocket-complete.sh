
#!/bin/bash

# Script de correção completa do WebSocket
# Arquivo: scripts/fix-websocket-complete.sh

echo "🔧 CORREÇÃO COMPLETA DO WEBSOCKET"
echo "================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-websocket-complete.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🔍 Passo 1: Verificando servidor Node.js..."

# Verificar se servidor está rodando
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null)

if [ "$HEALTH_CHECK" != "200" ]; then
    echo "❌ Servidor Node.js não está respondendo"
    echo "🔄 Tentando reiniciar..."
    
    if command -v pm2 > /dev/null 2>&1; then
        pm2 restart whatsapp-multi-client 2>/dev/null
        sleep 5
        
        # Verificar novamente
        HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null)
        
        if [ "$HEALTH_CHECK" = "200" ]; then
            echo "✅ Servidor reiniciado com sucesso"
        else
            echo "❌ Falha ao reiniciar servidor"
            echo "🔍 Verificar logs: pm2 logs whatsapp-multi-client"
            exit 1
        fi
    else
        echo "❌ PM2 não encontrado"
        exit 1
    fi
else
    echo "✅ Servidor Node.js funcionando"
fi

echo ""
echo "🔍 Passo 2: Corrigindo configuração Nginx..."

# Fazer backup
BACKUP_DIR="/tmp/nginx-websocket-fix-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/" 2>/dev/null

echo "💾 Backup salvo em: $BACKUP_DIR"

# Criar configuração correta
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
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
    
    # Global settings
    client_max_body_size 50M;
    
    # Health check - FIRST
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
    
    # WebSocket - SECOND (CRITICAL FIX)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific headers
        proxy_set_header Sec-WebSocket-Extensions $http_sec_websocket_extensions;
        proxy_set_header Sec-WebSocket-Key $http_sec_websocket_key;
        proxy_set_header Sec-WebSocket-Version $http_sec_websocket_version;
        
        # Timeouts for WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 10s;
        
        # Disable caching for WebSocket
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
    }
    
    # API endpoints
    location /clients {
        proxy_pass http://127.0.0.1:4000/clients;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
    
    # API Docs
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
    
    # Frontend - LAST (catch-all)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
EOF

echo "🧪 Testando configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Aplicando..."
    systemctl reload nginx
    sleep 3
    
    echo ""
    echo "🔍 Passo 3: Testando correção..."
    
    # Testar WebSocket
    WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" | head -1 | awk '{print $2}')
    echo "WebSocket status: $WS_STATUS"
    
    if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "101" ]; then
        echo "🎉 WEBSOCKET CORRIGIDO! Status: $WS_STATUS"
    else
        echo "⚠️ WebSocket ainda com problema: $WS_STATUS"
        echo "🔍 Verificando resposta completa:"
        curl -k -s -I "https://$DOMAIN/socket.io/"
    fi
    
    # Testar outros endpoints
    echo ""
    echo "🔍 Testando outros endpoints:"
    
    HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health")
    echo "Health: $HEALTH_STATUS"
    
    CLIENTS_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/clients")
    echo "Clients: $CLIENTS_STATUS"
    
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
echo "WebSocket: $WS_STATUS"
echo "Health: $HEALTH_STATUS"
echo "Clients: $CLIENTS_STATUS"

if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "101" ]; then
    echo ""
    echo "✅ CORREÇÃO COMPLETA!"
    echo "🎮 Próximos passos:"
    echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    echo "2. Clique em 'Diagnóstico QR Code'"
    echo "3. Clique em 'Gerar QR'"
    echo "4. O QR Code deve aparecer automaticamente"
else
    echo ""
    echo "❌ PROBLEMA PERSISTE"
    echo "🔧 Ações adicionais necessárias:"
    echo "1. Verificar logs do servidor: pm2 logs whatsapp-multi-client"
    echo "2. Verificar se Socket.IO está configurado no servidor"
    echo "3. Verificar se as portas estão corretas"
fi

echo ""
echo "🔄 Backup disponível em: $BACKUP_DIR"
