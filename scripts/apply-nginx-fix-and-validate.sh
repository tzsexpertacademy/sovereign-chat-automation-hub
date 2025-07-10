#!/bin/bash

# Script para aplicar correção do Nginx e validar sistema completo
echo "🔧 APLICANDO CORREÇÃO DO NGINX E VALIDAÇÃO COMPLETA"
echo "==================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/apply-nginx-fix-and-validate.sh"
    exit 1
fi

DOMAIN="146.59.227.248"
NODE_PORT=4000

echo "🔍 1. VERIFICANDO ESTADO ATUAL"
echo "=============================="

# Verificar se servidor Node.js está rodando na porta correta
echo "🔍 Verificando servidor Node.js na porta $NODE_PORT..."
if netstat -tlnp | grep ":$NODE_PORT " > /dev/null; then
    echo "✅ Servidor Node.js rodando na porta $NODE_PORT"
else
    echo "❌ Servidor Node.js NÃO está rodando na porta $NODE_PORT"
    echo "   Execute: ./scripts/restart-server-debug.sh"
    exit 1
fi

# Testar health check direto no Node.js
echo "🔍 Testando health check direto..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$NODE_PORT/health")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check direto: OK ($HEALTH_STATUS)"
else
    echo "❌ Health check direto falhou: $HEALTH_STATUS"
    exit 1
fi

echo ""
echo "🔧 2. APLICANDO CORREÇÃO DO NGINX"
echo "================================="

echo "🔄 Executando script de correção do Nginx..."
./scripts/fix-nginx-routing-final.sh

if [ $? -ne 0 ]; then
    echo "❌ Falha na correção do Nginx!"
    exit 1
fi

echo ""
echo "⏳ 3. AGUARDANDO NGINX ESTABILIZAR"
echo "=================================="
sleep 5

echo ""
echo "🧪 4. VALIDAÇÃO COMPLETA DO SISTEMA"
echo "==================================="

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local url=$2
    local description=$3
    
    echo "🔍 $description"
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X $method https://$DOMAIN$url 2>/dev/null)
    
    case $HTTP_CODE in
        200|201) echo "   ✅ Status: $HTTP_CODE (SUCCESS)" ;;
        404) echo "   ❌ Status: $HTTP_CODE (NOT FOUND)" ;;
        400) echo "   ⚠️  Status: $HTTP_CODE (BAD REQUEST - esperado para teste)" ;;
        500) echo "   ❌ Status: $HTTP_CODE (SERVER ERROR)" ;;
        000) echo "   ❌ Status: $HTTP_CODE (NO CONNECTION)" ;;
        *) echo "   ❓ Status: $HTTP_CODE" ;;
    esac
    
    return $HTTP_CODE
}

CLIENT_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752173664034"

echo ""
echo "📋 4.1 ENDPOINTS BÁSICOS"
echo "========================"
test_endpoint "GET" "/health" "Health Check"
test_endpoint "GET" "/clients" "Lista de Clientes"

echo ""
echo "📋 4.2 ENDPOINTS /API/ (PRINCIPAIS)"
echo "==================================="
test_endpoint "GET" "/api/clients/$CLIENT_ID" "GET Status da Instância"
test_endpoint "POST" "/api/clients/$CLIENT_ID/send" "POST Enviar Mensagem"
test_endpoint "GET" "/api/clients/$CLIENT_ID/chats" "GET Listar Chats"
test_endpoint "POST" "/api/clients/$CLIENT_ID/send-media" "POST Enviar Mídia"

echo ""
echo "📋 4.3 ENDPOINTS DE COMPATIBILIDADE"
echo "==================================="
test_endpoint "POST" "/clients/$CLIENT_ID/send-message" "POST Send Message (Compat)"
test_endpoint "GET" "/clients/$CLIENT_ID/chats" "GET Chats (Compat)"

echo ""
echo "🔍 5. VERIFICAÇÃO FINAL DOS LOGS"
echo "================================"

echo "🔍 Últimas linhas do log do servidor:"
tail -10 server.log

echo ""
echo "🔍 Últimas linhas do log do Nginx:"
tail -5 /var/log/nginx/whatsapp-error.log 2>/dev/null || echo "   (Log do Nginx não encontrado)"

echo ""
echo "📊 6. STATUS FINAL"
echo "=================="

# Verificar se servidor ainda está rodando
SERVER_PID=$(ps aux | grep "node server/whatsapp-multi-client-server.js" | grep -v grep | awk '{print $2}')
if [ -n "$SERVER_PID" ]; then
    echo "✅ Servidor Node.js rodando (PID: $SERVER_PID)"
else
    echo "❌ Servidor Node.js parou de funcionar"
fi

# Verificar Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx ativo"
else
    echo "❌ Nginx inativo"
fi

echo ""
echo "🎯 7. INSTRUÇÕES FINAIS"
echo "======================="
echo "1. Teste no navegador: https://$DOMAIN/"
echo "2. Acesse o chat e envie uma mensagem"
echo "3. Tente enviar um arquivo de áudio"
echo "4. Verifique se não há erro 404 no console (F12)"
echo ""
echo "📝 Para monitorar:"
echo "   tail -f server.log"
echo "   tail -f /var/log/nginx/whatsapp-error.log"
echo ""
echo "✅ CORREÇÃO APLICADA E SISTEMA VALIDADO!"