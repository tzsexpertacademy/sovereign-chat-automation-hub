#!/bin/bash

# Script para verificação completa das APIs e dependências
# Arquivo: scripts/check-api-completeness.sh

echo "🔍 VERIFICAÇÃO COMPLETA DAS APIS"
echo "==============================="

DOMAIN="146.59.227.248"
BACKEND_PORT=4000

echo "📋 1. VERIFICANDO DEPENDÊNCIAS DO BACKEND"
echo "========================================="

cd /home/ubuntu/sovereign-chat-automation-hub/server

echo "🔍 Verificando package.json..."
if [ -f "package.json" ]; then
    echo "✅ package.json encontrado"
    
    # Verificar se express-fileupload está instalado
    if grep -q "express-fileupload" package.json; then
        echo "✅ express-fileupload está no package.json"
    else
        echo "❌ express-fileupload NÃO está no package.json"
        echo "📦 Instalando express-fileupload..."
        npm install express-fileupload
    fi
    
    # Verificar outras dependências críticas
    echo "🔍 Verificando dependências críticas:"
    DEPENDENCIES=("express" "socket.io" "whatsapp-web.js" "qrcode" "swagger-ui-express" "cors")
    
    for dep in "${DEPENDENCIES[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            echo "   ✅ $dep"
        else
            echo "   ❌ $dep FALTANDO"
        fi
    done
else
    echo "❌ package.json não encontrado!"
fi

echo ""
echo "📋 2. TESTANDO BACKEND DIRETO (porta $BACKEND_PORT)"
echo "================================================="

# Teste direto no backend
echo "🔍 Testando endpoints básicos..."
curl -s -o /dev/null -w "Health direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/health
curl -s -o /dev/null -w "Clients direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/clients
curl -s -o /dev/null -w "API-docs direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/api-docs
curl -s -o /dev/null -w "API-docs.json direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/api-docs.json

echo ""
echo "📋 3. TESTANDO HTTPS VIA NGINX"
echo "============================="

curl -k -s -o /dev/null -w "Health HTTPS: %{http_code}\n" https://$DOMAIN/health
curl -k -s -o /dev/null -w "Clients HTTPS: %{http_code}\n" https://$DOMAIN/clients
curl -k -s -o /dev/null -w "API-docs HTTPS: %{http_code}\n" https://$DOMAIN/api-docs
curl -k -s -o /dev/null -w "API-docs.json HTTPS: %{http_code}\n" https://$DOMAIN/api-docs.json

echo ""
echo "📋 4. TESTANDO ENDPOINTS AVANÇADOS"
echo "================================="

# Testar endpoint de status
TEST_INSTANCE="test-instance-123"
echo "🔍 Testando GET /clients/$TEST_INSTANCE/status..."
curl -k -s -o /dev/null -w "Status endpoint: %{http_code}\n" https://$DOMAIN/clients/$TEST_INSTANCE/status

# Testar endpoint de connect
echo "🔍 Testando POST /clients/$TEST_INSTANCE/connect..."
curl -k -s -o /dev/null -w "Connect endpoint: %{http_code}\n" -X POST https://$DOMAIN/clients/$TEST_INSTANCE/connect

echo ""
echo "📋 5. VERIFICANDO LOGS DE ERRO ATUAL"
echo "===================================="

echo "🔍 Últimos erros do PM2:"
pm2 logs whatsapp-multi-client --lines 10 --err 2>/dev/null | tail -10

echo ""
echo "📋 6. STATUS DOS SERVIÇOS"
echo "======================="

echo "PM2 WhatsApp: $(pm2 describe whatsapp-multi-client 2>/dev/null | grep 'status' | head -1 || echo 'não rodando')"
echo "Nginx: $(systemctl is-active nginx)"
echo "Porta 443 (HTTPS): $(ss -tlnp | grep :443 | wc -l) conexões"
echo "Porta 4000 (Backend): $(ss -tlnp | grep :4000 | wc -l) conexões"

echo ""
echo "🎯 RESUMO DOS PROBLEMAS ENCONTRADOS:"
echo "=================================="
echo "• Se dependências estão faltando, instale com: npm install"
echo "• Se endpoints retornam 404, verifique se o servidor está rodando"
echo "• Se há erros de protocolo Chrome, reinicie o servidor"
echo "• Execute: sudo ./scripts/production-stop-whatsapp.sh && sudo ./scripts/production-start-whatsapp.sh"