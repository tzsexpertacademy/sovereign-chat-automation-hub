
#!/bin/bash

# Script para corrigir problemas de conexão de instância
# Arquivo: scripts/fix-instance-connection.sh

echo "🔧 CORREÇÃO DE CONEXÃO DE INSTÂNCIAS"
echo "==================================="

DOMAIN="146.59.227.248"
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3"

echo "🔍 Diagnosticando problema de conexão..."

# Testar se backend está respondendo
echo "1️⃣ Testando backend na porta 4000..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health)

if [ "$BACKEND_HEALTH" != "200" ]; then
    echo "❌ Backend não está funcionando! Status: $BACKEND_HEALTH"
    echo "💡 Execute: sudo systemctl restart whatsapp-multi-client"
    exit 1
fi

echo "✅ Backend funcionando (porta 4000)"

# Testar conexão via HTTPS
echo ""
echo "2️⃣ Testando conexão via HTTPS..."

RESPONSE=$(curl -k -s -X POST https://$DOMAIN/clients/$INSTANCE_ID/connect \
  -H "Content-Type: application/json" \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
  -w "\nSTATUS_CODE:%{http_code}")

echo "Resposta completa:"
echo "$RESPONSE"

STATUS_CODE=$(echo "$RESPONSE" | grep "STATUS_CODE:" | cut -d: -f2)

if [ "$STATUS_CODE" = "200" ]; then
    echo "✅ Conexão HTTPS funcionando!"
elif [ "$STATUS_CODE" = "500" ]; then
    echo "❌ Erro 500 - Problema no servidor backend"
    echo "🔍 Verificando logs do WhatsApp..."
    
    # Verificar se o processo WhatsApp está rodando
    if pgrep -f "whatsapp-multi-client-server" > /dev/null; then
        echo "✅ Processo WhatsApp rodando"
        echo "📋 Últimas linhas do log:"
        tail -10 /var/log/whatsapp-multi-client.log 2>/dev/null || echo "Log não encontrado"
    else
        echo "❌ Processo WhatsApp não está rodando!"
        echo "🔧 Reiniciando servidor WhatsApp..."
        
        # Tentar iniciar via PM2
        if command -v pm2 > /dev/null; then
            pm2 restart whatsapp-multi-client 2>/dev/null || pm2 start whatsapp-multi-client 2>/dev/null
        else
            echo "PM2 não encontrado. Inicie manualmente:"
            echo "cd server && node whatsapp-multi-client-server.js"
        fi
    fi
else
    echo "❌ Status inesperado: $STATUS_CODE"
fi

echo ""
echo "3️⃣ Testando conectividade WebSocket..."

# Testar se WebSocket está funcionando
curl -k -s -I https://$DOMAIN/socket.io/ | head -3

echo ""
echo "🎯 SOLUÇÕES RECOMENDADAS:"
echo "======================="
echo "1. Se erro 500: Reinicie o servidor WhatsApp"
echo "2. Se CORS: Verifique origem no servidor"
echo "3. Se WebSocket falha: Verifique configuração Nginx"
echo ""
echo "📋 Comandos úteis:"
echo "• Ver logs: tail -f /var/log/whatsapp-multi-client.log"
echo "• Reiniciar: pm2 restart whatsapp-multi-client"
echo "• Status: pm2 status"
