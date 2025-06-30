
#!/bin/bash

# Script para testar conexão HTTPS - VALIDAÇÃO CIRÚRGICA
# Arquivo: scripts/test-https-connection.sh

echo "🧪 TESTE HTTPS - VALIDAÇÃO CIRÚRGICA"
echo "==================================="

DOMAIN="146.59.227.248"

echo "🔍 1. Testando Health Check (deve funcionar - PRESERVADO)..."
echo "-----------------------------------------------------------"
curl -k -s https://$DOMAIN/health | jq -r '.status // "ERROR"' || echo "❌ Health check falhou"

echo ""
echo "🔍 2. Testando Frontend Root (deve funcionar - PRESERVADO)..."
echo "------------------------------------------------------------"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Frontend respondendo (HTTP $HTTP_CODE)"
else
    echo "❌ Frontend com problema (HTTP $HTTP_CODE)"
fi

echo ""
echo "🔍 3. Testando API Clients (NOVA - deve funcionar agora)..."
echo "----------------------------------------------------------"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/clients)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API Clients funcionando (HTTP $HTTP_CODE)"
    curl -k -s https://$DOMAIN/clients | jq -r '.success // "ERROR"' || echo "Resposta não JSON"
else
    echo "❌ API Clients com problema (HTTP $HTTP_CODE)"
fi

echo ""
echo "🔍 4. Testando Swagger Docs (NOVA - deve funcionar agora)..."
echo "-----------------------------------------------------------"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api-docs)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Swagger Docs funcionando (HTTP $HTTP_CODE)"
else
    echo "❌ Swagger Docs com problema (HTTP $HTTP_CODE)"
fi

echo ""
echo "🔍 5. Testando CORS preflight (deve funcionar - PRESERVADO)..."
echo "-------------------------------------------------------------"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" -X OPTIONS https://$DOMAIN/clients \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type")
  
if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✅ CORS preflight funcionando (HTTP $HTTP_CODE)"
else
    echo "❌ CORS preflight com problema (HTTP $HTTP_CODE)"
fi

echo ""
echo "🔍 6. Status dos serviços..."
echo "----------------------------"
echo "Nginx: $(systemctl is-active nginx 2>/dev/null || echo 'ERROR')"
echo "Porta 443: $(ss -tlnp | grep :443 >/dev/null && echo 'OUVINDO' || echo 'NÃO OUVINDO')"
echo "Porta 4000: $(ss -tlnp | grep :4000 >/dev/null && echo 'OUVINDO' || echo 'NÃO OUVINDO')"

echo ""
echo "📋 RESUMO DO TESTE:"
echo "==================="
echo "✅ Funcionalidades preservadas:"
echo "  • Health check (/health)"
echo "  • Frontend raiz (/)"
echo "  • WebSocket (/socket.io/)"
echo "  • CORS para Lovable"
echo ""
echo "➕ Novas funcionalidades:"
echo "  • API Clients (/clients)"
echo "  • Swagger UI (/api-docs)"
echo ""
echo "🌐 Se todos os testes passaram, acesse:"
echo "  https://$DOMAIN/ (aceite o certificado primeiro)"
echo "  https://$DOMAIN/clients (API)"
echo "  https://$DOMAIN/api-docs (Swagger)"
