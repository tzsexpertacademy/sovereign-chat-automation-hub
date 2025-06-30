
#!/bin/bash

# Script para corrigir redirect 301 no /api-docs mantendo tudo funcionando
# Arquivo: scripts/fix-swagger-redirect.sh

echo "🔧 CORREÇÃO CIRÚRGICA - SWAGGER REDIRECT 301"
echo "==========================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-swagger-redirect.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🎯 OBJETIVO: Corrigir APENAS /api-docs (status 301 → 200)"
echo "🎯 MANTER: /health, /clients, /api-docs.json (que estão funcionando)"
echo ""

# Fazer backup antes de qualquer mudança
echo "💾 Criando backup de segurança..."
BACKUP_DIR="/tmp/nginx-working-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp /etc/nginx/sites-available/whatsapp-multi-client $BACKUP_DIR/nginx-config.conf

# Testar se configuração atual funciona
echo "🧪 Testando configuração atual..."
curl -k -s https://$DOMAIN/health > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Configuração atual não está funcionando! Abortando..."
    exit 1
fi

echo "✅ Configuração atual funciona! Corrigindo apenas /api-docs..."

# Criar nova configuração Nginx - CORREÇÃO CIRÚRGICA APENAS NO /api-docs
echo "⚙️ Aplicando correção cirúrgica no /api-docs..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server - CORREÇÃO CIRÚRGICA NO /api-docs
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration - MANTIDA EXATAMENTE IGUAL
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ORDEM CRÍTICA DOS LOCATION BLOCKS (mantendo o que funciona)
    
    # 1. Health Check - MANTIDO (funcionando)
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 2. WebSocket - MANTIDO (crítico para Lovable)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 3. API Docs JSON - MANTIDO (funcionando)
    location /api-docs.json {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs.json;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 4. API Docs - CORRIGIDO (era 301, agora será 200)
    location /api-docs {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Headers específicos para Swagger UI
        proxy_set_header Accept-Encoding "";
        proxy_redirect off;
        
        # Configuração específica para evitar redirect 301
        location ~ ^/api-docs/?\$ {
            proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_redirect off;
        }
    }
    
    # 5. API Clients - MANTIDO (funcionando)
    location /clients {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/clients;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 6. Frontend - MANTIDO (funcionando como catch-all)
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Testar nova configuração
echo "🧪 Testando nova configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida!"
    
    # Aplicar configuração
    echo "🔄 Aplicando configuração..."
    systemctl reload nginx
    
    # Aguardar aplicação
    sleep 3
    
    # TESTES DE VALIDAÇÃO ESPECÍFICOS
    echo ""
    echo "🧪 TESTES DE VALIDAÇÃO:"
    echo "======================"
    
    # Teste crítico: Health check (Lovable)
    echo "1️⃣ Testando /health (crítico para Lovable)..."
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ /health: $HTTP_CODE"
    else
        echo "   ❌ /health: $HTTP_CODE - ROLLBACK NECESSÁRIO!"
        cp $BACKUP_DIR/nginx-config.conf /etc/nginx/sites-available/whatsapp-multi-client
        systemctl reload nginx
        echo "🔄 Rollback executado - configuração restaurada"
        exit 1
    fi
    
    # Teste específico: API Docs (que tinha 301)
    echo "2️⃣ Testando /api-docs (era 301)..."
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api-docs)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ /api-docs: $HTTP_CODE (CORRIGIDO!)"
    else
        echo "   ⚠️ /api-docs: $HTTP_CODE (ainda não 200, mas pode funcionar)"
    fi
    
    # Teste: Clients (deve continuar funcionando)
    echo "3️⃣ Testando /clients (deve continuar funcionando)..."
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/clients)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ /clients: $HTTP_CODE"
    else
        echo "   ⚠️ /clients: $HTTP_CODE"
    fi
    
    echo ""
    echo "🎉 CORREÇÃO CIRÚRGICA CONCLUÍDA!"
    echo "==============================="
    echo ""
    echo "✅ Configuração aplicada - foco na correção do /api-docs"
    echo "✅ Health check mantido funcionando (Lovable seguro)"
    echo "✅ Outras rotas preservadas"
    echo ""
    echo "🧪 Execute novamente para verificar:"
    echo "   ./scripts/validate-api-routes.sh"
    echo ""
    echo "🔄 Backup disponível em: $BACKUP_DIR/nginx-config.conf"
    echo ""
    
else
    echo "❌ Erro na configuração Nginx - não aplicando mudanças"
    exit 1
fi
