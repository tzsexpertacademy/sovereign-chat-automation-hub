
#!/bin/bash

# Script de diagnóstico completo do WebSocket
# Arquivo: scripts/diagnose-websocket-issue.sh

echo "🔍 DIAGNÓSTICO COMPLETO DO WEBSOCKET"
echo "===================================="

DOMAIN="146.59.227.248"
BACKEND_PORT="4000"

echo "📋 1. VERIFICANDO SERVIDOR NODE.JS"
echo "=================================="

# Verificar PM2
echo "🔍 Status PM2:"
if command -v pm2 > /dev/null 2>&1; then
    pm2 status
    echo ""
    echo "🔍 Logs recentes do servidor:"
    pm2 logs whatsapp-multi-client --lines 10 2>/dev/null || echo "⚠️ Nenhum log encontrado"
else
    echo "❌ PM2 não encontrado"
fi

echo ""
echo "📋 2. VERIFICANDO PORTAS"
echo "======================="

# Verificar se porta 4000 está escutando
echo "🔍 Porta 4000 (Backend):"
PORT_4000=$(sudo netstat -tlnp | grep ":4000 ")
if [ -n "$PORT_4000" ]; then
    echo "✅ Porta 4000 em uso:"
    echo "$PORT_4000"
else
    echo "❌ Porta 4000 não está escutando"
fi

echo ""
echo "🔍 Porta 8080 (Frontend):"
PORT_8080=$(sudo netstat -tlnp | grep ":8080 ")
if [ -n "$PORT_8080" ]; then
    echo "✅ Porta 8080 em uso:"
    echo "$PORT_8080"
else
    echo "⚠️ Porta 8080 não está escutando"
fi

echo ""
echo "📋 3. TESTANDO SERVIDOR DIRETAMENTE"
echo "=================================="

# Testar servidor Node.js diretamente
echo "🔍 Testando http://localhost:4000/health:"
HEALTH_LOCAL=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null)
echo "Status: $HEALTH_LOCAL"

echo ""
echo "🔍 Testando http://localhost:4000/socket.io/:"
SOCKET_LOCAL=$(curl -s -I http://localhost:4000/socket.io/ 2>/dev/null | head -1)
echo "Resposta: $SOCKET_LOCAL"

echo ""
echo "📋 4. TESTANDO VIA NGINX"
echo "======================="

# Testar via Nginx
echo "🔍 Testando https://$DOMAIN/health:"
HEALTH_NGINX=$(curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null)
echo "Status: $HEALTH_NGINX"

echo ""
echo "🔍 Testando https://$DOMAIN/socket.io/:"
SOCKET_NGINX=$(curl -k -s -I "https://$DOMAIN/socket.io/" 2>/dev/null | head -1)
echo "Resposta: $SOCKET_NGINX"

echo ""
echo "📋 5. VERIFICANDO CONFIGURAÇÃO NGINX"
echo "===================================="

# Verificar configuração Nginx
echo "🔍 Configuração Nginx atual:"
if [ -f "/etc/nginx/sites-available/whatsapp-multi-client" ]; then
    echo "✅ Arquivo de configuração existe"
    echo "🔍 Verificando location /socket.io/:"
    grep -A 10 "location /socket.io/" /etc/nginx/sites-available/whatsapp-multi-client 2>/dev/null || echo "❌ Location /socket.io/ não encontrado"
else
    echo "❌ Arquivo de configuração não encontrado"
fi

echo ""
echo "📋 6. TESTANDO CONECTIVIDADE"
echo "=========================="

# Testar conectividade interna
echo "🔍 Testando conectividade interna:"
INTERNAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health 2>/dev/null)
echo "127.0.0.1:4000/health - Status: $INTERNAL_TEST"

echo ""
echo "📋 7. DIAGNÓSTICO FINAL"
echo "======================"

# Diagnóstico final
if [ "$HEALTH_LOCAL" = "200" ]; then
    echo "✅ Servidor Node.js funcionando"
    
    if [ "$HEALTH_NGINX" = "200" ]; then
        echo "✅ Nginx proxy funcionando para HTTP"
        
        if [ "$SOCKET_LOCAL" != "$SOCKET_NGINX" ]; then
            echo "❌ PROBLEMA: WebSocket não está sendo proxificado corretamente"
            echo "🔧 SOLUÇÃO: Corrigir configuração Nginx para WebSocket"
        else
            echo "✅ Configuração parece correta"
        fi
    else
        echo "❌ PROBLEMA: Nginx não está proxificando corretamente"
        echo "🔧 SOLUÇÃO: Verificar configuração Nginx"
    fi
else
    echo "❌ PROBLEMA CRÍTICO: Servidor Node.js não está respondendo"
    echo "🔧 SOLUÇÃO: Reiniciar servidor Node.js"
    
    if command -v pm2 > /dev/null 2>&1; then
        echo "🔄 Tentando reiniciar PM2..."
        pm2 restart whatsapp-multi-client 2>/dev/null || echo "❌ Falha ao reiniciar PM2"
        sleep 5
        
        # Testar novamente após restart
        HEALTH_AFTER_RESTART=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null)
        echo "Status após restart: $HEALTH_AFTER_RESTART"
    fi
fi

echo ""
echo "🎯 RESUMO DO DIAGNÓSTICO"
echo "======================="
echo "Servidor Node.js (localhost:4000/health): $HEALTH_LOCAL"
echo "Nginx Proxy (https://$DOMAIN/health): $HEALTH_NGINX"
echo "WebSocket Local: $(echo "$SOCKET_LOCAL" | awk '{print $2}' | head -1)"
echo "WebSocket Nginx: $(curl -k -s -I "https://$DOMAIN/socket.io/" 2>/dev/null | head -1 | awk '{print $2}')"

echo ""
echo "🔧 PRÓXIMOS PASSOS RECOMENDADOS:"
if [ "$HEALTH_LOCAL" != "200" ]; then
    echo "1. CRÍTICO: Corrigir servidor Node.js"
    echo "   - Verificar logs: pm2 logs whatsapp-multi-client"
    echo "   - Reiniciar: pm2 restart whatsapp-multi-client"
elif [ "$HEALTH_NGINX" != "200" ]; then
    echo "1. CRÍTICO: Corrigir proxy Nginx"
    echo "   - Verificar configuração: /etc/nginx/sites-available/whatsapp-multi-client"
    echo "   - Testar: nginx -t"
else
    echo "1. Corrigir configuração WebSocket no Nginx"
    echo "   - Adicionar headers corretos para WebSocket"
    echo "   - Testar upgrade de conexão"
fi
