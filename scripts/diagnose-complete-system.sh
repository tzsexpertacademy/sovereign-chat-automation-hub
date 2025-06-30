
#!/bin/bash

# Script de diagnóstico completo do sistema
# Arquivo: scripts/diagnose-complete-system.sh

echo "🔍 DIAGNÓSTICO COMPLETO DO SISTEMA"
echo "================================="

DOMAIN="146.59.227.248"
BACKEND_PORT=4000

echo "📋 1. TESTANDO BACKEND DIRETO (porta 4000)"
echo "=========================================="

# Teste direto no backend
echo "🔍 Testando backend direto na porta 4000..."
curl -s -o /dev/null -w "Health direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/health
curl -s -o /dev/null -w "Clients direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/clients
curl -s -o /dev/null -w "API-docs direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/api-docs
curl -s -o /dev/null -w "API-docs.json direto: %{http_code}\n" http://127.0.0.1:$BACKEND_PORT/api-docs.json

echo ""
echo "📋 2. TESTANDO HTTPS VIA NGINX"
echo "============================="

curl -k -s -o /dev/null -w "Health HTTPS: %{http_code}\n" https://$DOMAIN/health
curl -k -s -o /dev/null -w "Clients HTTPS: %{http_code}\n" https://$DOMAIN/clients
curl -k -s -o /dev/null -w "API-docs HTTPS: %{http_code}\n" https://$DOMAIN/api-docs
curl -k -s -o /dev/null -w "API-docs.json HTTPS: %{http_code}\n" https://$DOMAIN/api-docs.json

echo ""
echo "📋 3. VERIFICANDO REDIRECIONAMENTOS"
echo "==================================="

echo "🔍 Testando redirects do /api-docs..."
curl -k -I https://$DOMAIN/api-docs 2>/dev/null | grep -E "(HTTP|Location)"

echo ""
echo "📋 4. CONFIGURAÇÃO NGINX ATUAL"
echo "============================="

echo "🔍 Location blocks ativos no Nginx:"
grep -n "location" /etc/nginx/sites-available/whatsapp-multi-client | head -10

echo ""
echo "📋 5. STATUS DOS SERVIÇOS"
echo "======================="

echo "Nginx: $(systemctl is-active nginx)"
echo "Porta 443 (HTTPS): $(ss -tlnp | grep :443 | wc -l) conexões"
echo "Porta 4000 (Backend): $(ss -tlnp | grep :4000 | wc -l) conexões"

echo ""
echo "📋 6. LOGS DE ERRO NGINX"
echo "======================"

echo "🔍 Últimos erros Nginx:"
tail -5 /var/log/nginx/error.log 2>/dev/null || echo "Sem logs de erro recentes"

echo ""
echo "📋 7. TESTANDO CONEXÃO DE INSTÂNCIA"
echo "=================================="

echo "🔍 Testando conectar instância via API..."
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3"

# Teste direto no backend
echo "Backend direto:"
curl -s -X POST http://127.0.0.1:$BACKEND_PORT/clients/$INSTANCE_ID/connect \
  -H "Content-Type: application/json" \
  -w "Status: %{http_code}\n" | head -3

echo ""
echo "HTTPS via Nginx:"
curl -k -s -X POST https://$DOMAIN/clients/$INSTANCE_ID/connect \
  -H "Content-Type: application/json" \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
  -w "Status: %{http_code}\n" | head -3

echo ""
echo "🎯 RESUMO DOS PROBLEMAS ENCONTRADOS:"
echo "=================================="
echo "• Se /api-docs retorna 301 via HTTPS mas 200 direto, é problema de proxy"
echo "• Se conexão de instância falha via HTTPS mas funciona direto, é CORS"
echo "• Verifique se o servidor backend tem Swagger configurado corretamente"

