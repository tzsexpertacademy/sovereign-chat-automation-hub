
#!/bin/bash

# Script para corrigir erro 502 em HTTPS
# Arquivo: scripts/fix-https-502-error.sh

echo "🔧 CORREÇÃO ERRO 502 HTTPS"
echo "========================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-https-502-error.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🔍 Passo 1: Verificando status dos serviços..."
echo "Nginx: $(systemctl is-active nginx)"
echo "Porta 4000: $(lsof -i :4000 | grep LISTEN | wc -l) conexões"

echo ""
echo "🔍 Passo 2: Testando conexão direta do servidor..."
curl -s -o /dev/null -w "Servidor direto (HTTP): %{http_code}\n" http://127.0.0.1:4000/health
curl -k -s -o /dev/null -w "Via HTTPS Nginx: %{http_code}\n" https://$DOMAIN/health

echo ""
echo "🔍 Passo 3: Verificando logs de erro do Nginx..."
echo "Últimos erros Nginx:"
tail -5 /var/log/nginx/error.log 2>/dev/null || echo "Sem logs de erro"

echo ""
echo "🔧 Passo 4: Criando configuração Nginx OTIMIZADA para HTTPS..."

# Criar configuração Nginx otimizada
cat > /etc/nginx/sites-available/whatsapp-multi-client << 'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name 146.59.227.248;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server - OTIMIZADO
server {
    listen 443 ssl;
    server_name 146.59.227.248;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/whatsapp/fullchain.pem;
    ssl_certificate_key /etc/ssl/whatsapp/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Proxy settings otimizados
    proxy_connect_timeout 10s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
    
    # Logs específicos
    access_log /var/log/nginx/whatsapp-access.log;
    error_log /var/log/nginx/whatsapp-error.log debug;
    
    # HEALTH CHECK - Prioridade máxima
    location = /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # WEBSOCKET - Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # Headers WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # API CLIENTS - Rotas principais
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
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
    }
    
    # FRONTEND - Catch-all
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "🧪 Passo 5: Testando nova configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida! Recarregando Nginx..."
    systemctl reload nginx
    sleep 3
    
    echo ""
    echo "🔍 Passo 6: Testando endpoints após correção..."
    
    echo "Health Check HTTPS:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/health"
    
    echo "API Clients HTTPS:"
    curl -k -s -o /dev/null -w "Status: %{http_code}\n" "https://$DOMAIN/clients"
    
    echo ""
    echo "🎉 CORREÇÃO 502 HTTPS CONCLUÍDA!"
    echo "==============================="
    
    # Verificar se ainda há erro 502
    HEALTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health")
    
    if [ "$HEALTH_STATUS" = "200" ]; then
        echo "✅ Servidor HTTPS funcionando perfeitamente!"
        echo "✅ Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    elif [ "$HEALTH_STATUS" = "502" ]; then
        echo "⚠️ Ainda há erro 502. Executando diagnóstico avançado..."
        
        echo ""
        echo "🔍 DIAGNÓSTICO AVANÇADO:"
        echo "======================="
        
        # Verificar se o servidor backend está realmente ouvindo
        echo "Servidor backend na porta 4000:"
        ss -tlnp | grep :4000 || echo "❌ Servidor não está ouvindo na porta 4000"
        
        # Verificar conectividade interna
        echo ""
        echo "Teste conectividade interna:"
        timeout 5 telnet 127.0.0.1 4000 </dev/null 2>/dev/null && echo "✅ Conectividade OK" || echo "❌ Não consegue conectar no backend"
        
        # Verificar firewall
        echo ""
        echo "Status firewall:"
        ufw status 2>/dev/null || echo "UFW não configurado"
        
        echo ""
        echo "🔧 SOLUÇÕES ADICIONAIS:"
        echo "1. Reinicie o servidor WhatsApp: ./scripts/production-stop-whatsapp.sh && ./scripts/production-start-whatsapp.sh"
        echo "2. Verifique se não há firewall bloqueando: ufw allow 4000"
        echo "3. Verifique logs: tail -f /var/log/nginx/whatsapp-error.log"
        
    else
        echo "⚠️ Status inesperado: $HEALTH_STATUS"
    fi
    
else
    echo "❌ Erro na configuração Nginx!"
    exit 1
fi

echo ""
echo "📋 RESUMO:"
echo "• Nginx: $(systemctl is-active nginx)"
echo "• Backend: $(lsof -i :4000 | grep LISTEN | wc -l) conexões"
echo "• HTTPS Health: Status $HEALTH_STATUS"
echo ""
echo "🌐 URLs para testar:"
echo "• Frontend: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo "• Health Check: https://$DOMAIN/health"
