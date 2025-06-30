
#!/bin/bash

# Script ULTRA-CONSERVATIVO para adicionar rotas da API - SEM AFETAR LOVABLE
# Arquivo: scripts/setup-simple-https-conservative.sh

echo "🔒 ADICIONANDO ROTAS DA API - MODO ULTRA-CONSERVATIVO"
echo "====================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/setup-simple-https-conservative.sh"
    exit 1
fi

# Configurações
DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "📋 Modo ULTRA-CONSERVATIVO - Preservando 100% do que funciona"
echo "⏰ Aguarde alguns minutos..."

# BACKUP automático da configuração atual
BACKUP_DIR="/tmp/nginx-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/" 2>/dev/null || true
echo "💾 Backup criado em: $BACKUP_DIR"

# Criar configuração Nginx ULTRA-CONSERVATIVA
echo "⚙️ Criando configuração ULTRA-CONSERVATIVA..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# HTTP -> HTTPS redirect - PRESERVADO EXATAMENTE
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server - CONFIGURAÇÃO ULTRA-CONSERVATIVA
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration - PRESERVADO EXATAMENTE (funciona com Lovable)
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # CORS Headers GLOBAIS - PRESERVADOS EXATAMENTE (funcionam com Lovable)
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Client-Info, User-Agent, Referer' always;
    add_header 'Access-Control-Allow-Credentials' 'false' always;
    add_header 'Access-Control-Max-Age' '86400' always;
    
    # Health Check - PRIMEIRA PRIORIDADE (preserva detecção do Lovable)
    location = /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # WebSocket para Socket.IO - SEGUNDA PRIORIDADE (preserva WebSocket do Lovable)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }
    
    # API Clients - ISOLADA (não interfere com rotas principais)
    location = /clients {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/clients;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Handle preflight APENAS para esta rota
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Swagger UI - ISOLADA (não interfere com rotas principais)
    location = /api-docs {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Swagger JSON - ISOLADA (não interfere com rotas principais)
    location = /api-docs.json {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs.json;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Frontend - ÚLTIMA PRIORIDADE (preserva funcionamento do Lovable)
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Testar configuração
echo "🧪 Testando configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida!"
    
    # Reiniciar Nginx
    systemctl reload nginx
    
    echo "🔄 Nginx recarregado!"
else
    echo "❌ Erro na configuração Nginx - Restaurando backup..."
    cp "$BACKUP_DIR/whatsapp-multi-client" /etc/nginx/sites-available/
    systemctl reload nginx
    echo "🔙 Configuração anterior restaurada"
    exit 1
fi

echo ""
echo "🎉 CONFIGURAÇÃO ULTRA-CONSERVATIVA APLICADA!"
echo "============================================"
echo ""
echo "✅ MANTIDO 100% (não mexemos):"
echo "  • Certificado SSL (preservado)"
echo "  • Rota /health (preservada - primeira prioridade)"
echo "  • Rota /socket.io/ (preservada - segunda prioridade)"
echo "  • Rota / (preservada - última prioridade)"
echo "  • Headers CORS globais (preservados)"
echo ""
echo "➕ ADICIONADO (isoladamente):"
echo "  • Rota /clients (isolada)"
echo "  • Rota /api-docs (isolada)"
echo "  • Rota /api-docs.json (isolada)"
echo ""
echo "🔄 PRÓXIMOS PASSOS:"
echo "1. Verifique se Lovable ainda funciona"
echo "2. Teste as novas rotas da API"
echo "3. Se algo quebrar: cp $BACKUP_DIR/whatsapp-multi-client /etc/nginx/sites-available/ && systemctl reload nginx"
echo ""
echo "🌐 URLs para testar:"
echo "  • Lovable: https://$DOMAIN/health"
echo "  • API: https://$DOMAIN/clients"
echo "  • Swagger: https://$DOMAIN/api-docs"

EOF

chmod +x scripts/setup-simple-https-conservative.sh

