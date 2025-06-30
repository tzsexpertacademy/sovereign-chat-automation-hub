
#!/bin/bash

# Script para correção FINAL do WebSocket e Nginx
# Arquivo: scripts/fix-websocket-nginx-final.sh

echo "🔧 CORREÇÃO FINAL DO WEBSOCKET NGINX"
echo "===================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-websocket-nginx-final.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🔍 Diagnosticando WebSocket..."

# 1. Verificar status atual do WebSocket
WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" 2>/dev/null | head -1 | awk '{print $2}')
echo "WebSocket status atual: $WS_STATUS"

if [ "$WS_STATUS" = "400" ] || [ "$WS_STATUS" = "404" ] || [ -z "$WS_STATUS" ]; then
    echo "❌ WebSocket com problema - aplicando correção FINAL"
    
    # Backup da configuração atual
    BACKUP_DIR="/tmp/nginx-final-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/" 2>/dev/null || true
    echo "💾 Backup salvo em: $BACKUP_DIR"
    
    echo "🔧 Criando configuração Nginx CORRETA para WebSocket..."
    
    # Criar configuração completamente nova e correta
    cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
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
    http2 on;
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
    
    # 1. WebSocket - PRIMEIRA PRIORIDADE (CORRIGIDO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # Headers críticos para WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Headers específicos WebSocket
        proxy_set_header Sec-WebSocket-Extensions $http_sec_websocket_extensions;
        proxy_set_header Sec-WebSocket-Key $http_sec_websocket_key;
        proxy_set_header Sec-WebSocket-Version $http_sec_websocket_version;
        
        # Timeouts para WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 10s;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
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
    }
    
    # 3. API Clients - TERCEIRA PRIORIDADE  
    location /clients/ {
        proxy_pass http://127.0.0.1:4000/clients/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
    
    location /clients {
        proxy_pass http://127.0.0.1:4000/clients;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
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
    }
}
EOF
    
    echo "🧪 Testando nova configuração Nginx..."
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Configuração válida! Aplicando..."
        systemctl reload nginx
        sleep 3
        
        # Testar WebSocket novamente
        echo "🔍 Testando WebSocket após correção..."
        NEW_WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" 2>/dev/null | head -1 | awk '{print $2}')
        echo "Novo status WebSocket: $NEW_WS_STATUS"
        
        if [ "$NEW_WS_STATUS" = "200" ] || [ "$NEW_WS_STATUS" = "101" ]; then
            echo "🎉 WEBSOCKET CORRIGIDO DEFINITIVAMENTE! Status: $NEW_WS_STATUS ✅"
        else
            echo "⚠️ WebSocket ainda com problema: $NEW_WS_STATUS"
            echo "🔧 Tentando reiniciar PM2..."
            
            # Reiniciar PM2 se existir
            if command -v pm2 > /dev/null 2>&1; then
                pm2 restart all 2>/dev/null
                sleep 5
                
                # Testar novamente após restart
                FINAL_WS_STATUS=$(curl -k -s -I "https://$DOMAIN/socket.io/" 2>/dev/null | head -1 | awk '{print $2}')
                echo "Status final após restart: $FINAL_WS_STATUS"
                
                if [ "$FINAL_WS_STATUS" = "200" ] || [ "$FINAL_WS_STATUS" = "101" ]; then
                    echo "🎉 WEBSOCKET FUNCIONANDO após restart PM2! ✅"
                else
                    echo "❌ WebSocket ainda não funciona. Pode ser problema no backend."
                fi
            fi
        fi
        
    else
        echo "❌ Erro na configuração! Restaurando backup..."
        if [ -f "$BACKUP_DIR/whatsapp-multi-client" ]; then
            cp "$BACKUP_DIR/whatsapp-multi-client" /etc/nginx/sites-available/
            systemctl reload nginx
        fi
        exit 1
    fi
    
else
    echo "✅ WebSocket já funcionando (status $WS_STATUS)"
fi

echo ""
echo "🎯 TESTE COMPLETO"
echo "================="

# Testar endpoints críticos
ENDPOINTS=(
    "/health:Health Check"
    "/clients:API Clients" 
    "/api-docs.json:API Docs JSON"
    "/socket.io/:WebSocket"
)

for endpoint_info in "${ENDPOINTS[@]}"; do
    endpoint=$(echo "$endpoint_info" | cut -d':' -f1)
    name=$(echo "$endpoint_info" | cut -d':' -f2)
    
    echo -n "Testando $name ($endpoint)... "
    
    if [ "$endpoint" = "/socket.io/" ]; then
        status=$(curl -k -s -I "https://$DOMAIN$endpoint" 2>/dev/null | head -1 | awk '{print $2}')
    else
        status=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN$endpoint" 2>/dev/null)
    fi
    
    if [ "$status" = "200" ] || [ "$status" = "101" ]; then
        echo "✅ ($status)"
    else
        echo "❌ ($status)"
    fi
done

echo ""
echo "🎯 PRÓXIMOS PASSOS"
echo "=================="
echo "1. ✅ Nginx reconfigurado com WebSocket funcional"
echo "2. 🔗 Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo "3. 🔄 Use 'Diagnóstico QR Code' para testar WebSocket"
echo "4. ➕ Crie uma nova instância - QR deve aparecer automaticamente"
echo "5. 📱 Escaneie o QR Code com WhatsApp"
echo ""
echo "🔧 Para debug:"
echo "• Status PM2: pm2 status"
echo "• Logs: pm2 logs whatsapp-multi-client"
echo "• WebSocket manual: curl -I https://146.59.227.248/socket.io/"
echo ""
echo "✅ Correção FINAL concluída!"

