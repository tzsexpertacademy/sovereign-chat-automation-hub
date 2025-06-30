
#!/bin/bash

# Script para corrigir problema do WebSocket e QR Code
# Arquivo: scripts/fix-websocket-qr-code.sh

echo "🔧 CORREÇÃO DO WEBSOCKET E QR CODE"
echo "=================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-websocket-qr-code.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
BACKEND_PORT=4000

echo "🔍 Diagnosticando problema do WebSocket..."

# Testar WebSocket atual
echo "1️⃣ Testando WebSocket atual..."
WS_STATUS=$(curl -k -s -I https://$DOMAIN/socket.io/ | head -1 | awk '{print $2}')
echo "WebSocket status: $WS_STATUS"

if [ "$WS_STATUS" = "400" ]; then
    echo "❌ WebSocket retornando 400 - problema na configuração Nginx"
    
    # Fazer backup da configuração atual
    BACKUP_DIR="/tmp/nginx-websocket-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    cp /etc/nginx/sites-available/whatsapp-multi-client $BACKUP_DIR/
    
    echo "💾 Backup salvo em: $BACKUP_DIR"
    
    # Criar configuração corrigida com WebSocket funcionando
    echo "🔧 Aplicando correção do WebSocket..."
    cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - WEBSOCKET CORRIGIDO
server {
    listen 443 ssl http2;
    server_name 146.59.227.248;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ORDEM CRÍTICA DOS LOCATION BLOCKS
    
    # 1. Health Check - PRIMEIRA (crítica para Lovable)
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 2. WebSocket - SEGUNDA (crítica para QR Code) - CORRIGIDO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # 3. API Docs JSON - TERCEIRA
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:4000/api-docs.json;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 4. API Docs - QUARTA
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
    
    # 5. API Clients - QUINTA
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
        echo "✅ Configuração Nginx válida! Aplicando..."
        systemctl reload nginx
        sleep 3
        
        # Validar correção do WebSocket
        NEW_WS_STATUS=$(curl -k -s -I https://$DOMAIN/socket.io/ | head -1 | awk '{print $2}')
        echo "Novo status WebSocket: $NEW_WS_STATUS"
        
        if [ "$NEW_WS_STATUS" = "200" ] || [ "$NEW_WS_STATUS" = "101" ]; then
            echo "🎉 WEBSOCKET CORRIGIDO! Status: $NEW_WS_STATUS ✅"
        else
            echo "⚠️ WebSocket ainda com problema: $NEW_WS_STATUS"
        fi
        
    else
        echo "❌ Erro na configuração! Restaurando backup..."
        cp $BACKUP_DIR/whatsapp-multi-client /etc/nginx/sites-available/
        systemctl reload nginx
        exit 1
    fi
fi

echo ""
echo "2️⃣ Testando conexão de instância após correção..."
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3"

# Testar se instância consegue se conectar
CONNECT_RESPONSE=$(curl -k -s -X POST https://$DOMAIN/clients/$INSTANCE_ID/connect \
  -H "Content-Type: application/json" \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com")

echo "Resposta da conexão: $CONNECT_RESPONSE"

# Aguardar 3 segundos e verificar status
sleep 3

STATUS_RESPONSE=$(curl -k -s https://$DOMAIN/clients/$INSTANCE_ID/status)
echo "Status após conexão: $STATUS_RESPONSE"

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "=================="
echo "1. Acesse o Lovable: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/"
echo "2. Vá para /admin/instances"
echo "3. Clique em 'Sincronizar' ou 'Atualizar'"
echo "4. Clique em 'Nova Instância' se necessário"
echo "5. O QR Code deve aparecer automaticamente"
echo ""
echo "🔧 Se ainda não funcionar:"
echo "• Verifique se o processo PM2 está rodando: pm2 status"
echo "• Reinicie se necessário: pm2 restart whatsapp-multi-client"
echo "• Verifique logs: pm2 logs whatsapp-multi-client"
EOF

chmod +x $BACKUP_DIR/fix-websocket-qr-code.sh 2>/dev/null || true

echo "✅ Script concluído!"
echo "🔄 Backup disponível em: $BACKUP_DIR"
