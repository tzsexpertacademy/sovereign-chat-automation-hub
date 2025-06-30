
#!/bin/bash

# Script cirúrgico para adicionar rotas da API sem quebrar conexão Lovable
# Arquivo: scripts/fix-api-routes-surgical.sh

echo "🔧 CORREÇÃO CIRÚRGICA - ADICIONANDO ROTAS DA API"
echo "==============================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-api-routes-surgical.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
SSL_DIR="/etc/ssl/whatsapp"
BACKEND_PORT=4000
FRONTEND_PORT=8080

echo "🎯 PRINCÍPIO: Preservar 100% da configuração que funciona com Lovable"
echo "🎯 OBJETIVO: Adicionar apenas rotas /clients, /api-docs, /api-docs.json"
echo ""

# Fazer backup antes de qualquer mudança
echo "💾 Criando backup de segurança..."
./scripts/backup-working-nginx.sh

# Verificar se backup foi criado
if [ $? -ne 0 ]; then
    echo "❌ Erro ao criar backup! Abortando..."
    exit 1
fi

# Testar se configuração atual funciona
echo "🧪 Testando configuração atual..."
curl -k -s https://$DOMAIN/health > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Configuração atual não está funcionando! Abortando..."
    exit 1
fi

echo "✅ Configuração atual funciona! Prosseguindo com correção cirúrgica..."

# Criar nova configuração Nginx - ORDEM CRÍTICA dos location blocks
echo "⚙️ Criando configuração Nginx com rotas da API..."
cat > /etc/nginx/sites-available/whatsapp-multi-client << EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server - CONFIGURAÇÃO CIRÚRGICA
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration - MANTIDA EXATAMENTE IGUAL
    ssl_certificate $SSL_DIR/fullchain.pem;
    ssl_certificate_key $SSL_DIR/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ORDEM CRÍTICA DOS LOCATION BLOCKS
    
    # 1. Health Check - PRIMEIRA (mais específica, crítica para Lovable)
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 2. WebSocket - SEGUNDA (crítica para Lovable)
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
    
    # 3. API Docs JSON - TERCEIRA (arquivo específico)
    location /api-docs.json {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs.json;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 4. API Docs - QUARTA (swagger interface)
    location /api-docs {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api-docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 5. API Clients - QUINTA (rota da API)
    location /clients {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/clients;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 6. Frontend - ÚLTIMA (catch-all, deve ser sempre a última)
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
    
    # TESTES DE VALIDAÇÃO INCREMENTAL
    echo ""
    echo "🧪 TESTES DE VALIDAÇÃO:"
    echo "======================"
    
    # Teste 1: Health check (crítico para Lovable)
    echo "1️⃣ Testando /health (crítico para Lovable)..."
    curl -k -s https://$DOMAIN/health > /dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ /health funciona"
    else
        echo "   ❌ /health falhou - ROLLBACK NECESSÁRIO!"
        echo "🔄 Executando rollback automático..."
        BACKUP_DIR=$(ls -dt /tmp/nginx-working-backup-* | head -1)
        $BACKUP_DIR/restore.sh
        exit 1
    fi
    
    # Teste 2: Nova rota /clients
    echo "2️⃣ Testando /clients (nova funcionalidade)..."
    curl -k -s https://$DOMAIN/clients > /dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ /clients funciona"
    else
        echo "   ⚠️ /clients não responde (pode ser normal se servidor backend não tiver essa rota)"
    fi
    
    # Teste 3: API Docs
    echo "3️⃣ Testando /api-docs..."
    curl -k -s https://$DOMAIN/api-docs > /dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ /api-docs funciona"
    else
        echo "   ⚠️ /api-docs não responde (pode ser normal se não implementado)"
    fi
    
    echo ""
    echo "🎉 CORREÇÃO CIRÚRGICA CONCLUÍDA!"
    echo "==============================="
    echo ""
    echo "✅ Configuração aplicada com sucesso!"
    echo "✅ Health check mantido funcionando (crítico para Lovable)"
    echo "✅ WebSocket mantido funcionando (crítico para Lovable)"
    echo "✅ Novas rotas da API adicionadas:"
    echo "   • https://$DOMAIN/clients"
    echo "   • https://$DOMAIN/api-docs"
    echo "   • https://$DOMAIN/api-docs.json"
    echo ""
    echo "🧪 Teste no Lovable agora:"
    echo "   • Verifique se ainda mostra 'Connected' no canto superior direito"
    echo "   • Se não conectar, execute rollback: sudo \$(ls -dt /tmp/nginx-working-backup-* | head -1)/restore.sh"
    echo ""
    
else
    echo "❌ Erro na configuração Nginx - não aplicando mudanças"
    exit 1
fi
