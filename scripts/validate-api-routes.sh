
#!/bin/bash

# Script para validar se rotas da API funcionam sem quebrar Lovable
# Arquivo: scripts/validate-api-routes.sh

echo "🧪 VALIDAÇÃO DAS ROTAS DA API"
echo "============================"

DOMAIN="146.59.227.248"

echo "🔍 Testando rotas HTTPS..."
echo ""

# Teste 1: Health (crítico para Lovable)
echo "1️⃣ Health Check (crítico para Lovable):"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ https://$DOMAIN/health - Status: $HTTP_CODE"
else
    echo "   ❌ https://$DOMAIN/health - Status: $HTTP_CODE"
fi

# Teste 2: Clients API
echo "2️⃣ API Clients:"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/clients)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ https://$DOMAIN/clients - Status: $HTTP_CODE"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️ https://$DOMAIN/clients - Status: $HTTP_CODE (rota não implementada no backend)"
else
    echo "   ❌ https://$DOMAIN/clients - Status: $HTTP_CODE"
fi

# Teste 3: API Docs
echo "3️⃣ API Documentation:"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api-docs)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ https://$DOMAIN/api-docs - Status: $HTTP_CODE"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️ https://$DOMAIN/api-docs - Status: $HTTP_CODE (swagger não implementado no backend)"
else
    echo "   ❌ https://$DOMAIN/api-docs - Status: $HTTP_CODE"
fi

# Teste 4: API Docs JSON
echo "4️⃣ API Docs JSON:"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api-docs.json)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ https://$DOMAIN/api-docs.json - Status: $HTTP_CODE"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️ https://$DOMAIN/api-docs.json - Status: $HTTP_CODE (swagger JSON não implementado)"
else
    echo "   ❌ https://$DOMAIN/api-docs.json - Status: $HTTP_CODE"
fi

# Teste 5: Frontend (deve ser sempre último)
echo "5️⃣ Frontend (catch-all):"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN/)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ https://$DOMAIN/ - Status: $HTTP_CODE"
else
    echo "   ❌ https://$DOMAIN/ - Status: $HTTP_CODE"
fi

echo ""
echo "📊 Status dos Serviços:"
echo "Nginx: $(systemctl is-active nginx)"
echo "Porta 443: $(ss -tlnp | grep :443 | wc -l) conexões"
echo "Porta 4000: $(ss -tlnp | grep :4000 | wc -l) conexões"

echo ""
echo "🎯 IMPORTANTE:"
echo "• O crítico é que /health retorne status 200 (para Lovable funcionar)"
echo "• As rotas da API podem retornar 404 se não implementadas no servidor backend"
echo "• Teste no Lovable se ainda mostra 'Connected' no canto superior direito"
