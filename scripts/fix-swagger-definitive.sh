
#!/bin/bash

# Script para corrigir Swagger definitivamente
# Arquivo: scripts/fix-swagger-definitive.sh

echo "🔧 CORREÇÃO DEFINITIVA DO SWAGGER"
echo "================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-swagger-definitive.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🔍 Diagnosticando problema do Swagger..."

# Testar backend direto
BACKEND_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$BACKEND_PORT/api-docs)
HTTPS_VIA_NGINX=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api-docs)

echo "Backend direto: $BACKEND_DIRECT"
echo "HTTPS via Nginx: $HTTPS_VIA_NGINX"

if [ "$BACKEND_DIRECT" = "404" ]; then
    echo "❌ Problema: Backend não tem Swagger configurado!"
    echo "💡 Solução: Configure Swagger no servidor Node.js primeiro"
    exit 1
fi

if [ "$BACKEND_DIRECT" = "200" ] && [ "$HTTPS_VIA_NGINX" = "301" ]; then
    echo "✅ Problema identificado: Nginx fazendo proxy incorreto"
    echo "🔧 Aplicando correção definitiva..."
    
    # Fazer backup
    BACKUP_DIR="/tmp/nginx-swagger-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    cp /etc/nginx/sites-available/whatsapp-multi-client $BACKUP_DIR/
    
    # Criar configuração corrigida
    cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - SWAGGER DEFINITIVO
server {
    listen 443 ssl;
    server_name 146.59.227.248;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 1. Health Check - PRIMEIRA (crítica para Lovable)
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 2. WebSocket - SEGUNDA (crítica para Lovable)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 3. API Docs JSON - TERCEIRA (arquivo específico)
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 4. API Docs - QUARTA (Swagger UI) - CORREÇÃO DEFINITIVA
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        
        # Headers específicos para Swagger UI
        proxy_set_header Accept-Encoding "";
        proxy_buffering off;
    }
    
    # 5. API Clients - QUINTA (rotas da API)
    location /clients {
        proxy_pass http://127.0.0.1:4000/clients;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 6. Frontend - ÚLTIMA (catch-all)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Testar configuração
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Configuração válida! Aplicando..."
        systemctl reload nginx
        sleep 2
        
        # Validar correção
        NEW_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api-docs)
        echo "Novo status /api-docs: $NEW_STATUS"
        
        if [ "$NEW_STATUS" = "200" ]; then
            echo "🎉 SWAGGER CORRIGIDO! Status 200 ✅"
        else
            echo "⚠️ Swagger ainda não 200, mas configuração aplicada"
        fi
        
        echo "🔄 Backup salvo em: $BACKUP_DIR"
    else
        echo "❌ Erro na configuração! Restaurando backup..."
        cp $BACKUP_DIR/whatsapp-multi-client /etc/nginx/sites-available/
        systemctl reload nginx
    fi
    
else
    echo "ℹ️ Backend: $BACKEND_DIRECT | HTTPS: $HTTPS_VIA_NGINX"
    echo "💡 Execute diagnóstico completo: ./scripts/diagnose-complete-system.sh"
fi
