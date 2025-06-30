
#!/bin/bash

# Script para testar conexão HTTPS
# Arquivo: scripts/test-https-connection.sh

echo "🧪 TESTANDO CONEXÃO HTTPS"
echo "========================"

DOMAIN="146.59.227.248"

echo "🔍 Testando Health Check..."
curl -k -v https://$DOMAIN/health 2>&1 | head -20

echo ""
echo "🔍 Testando CORS preflight..."
curl -k -X OPTIONS https://$DOMAIN/clients/test/connect \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | head -20

echo ""
echo "🔍 Testando API clientes..."
curl -k -v https://$DOMAIN/clients 2>&1 | head -10

echo ""
echo "🔍 Status dos serviços:"
echo "Nginx: $(systemctl is-active nginx)"
echo "Porta 443: $(ss -tlnp | grep :443 || echo 'Não está ouvindo')"
echo "Porta 4000: $(ss -tlnp | grep :4000 || echo 'Não está ouvindo')"

echo ""
echo "📊 Certificado SSL:"
echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo "Erro ao verificar certificado"
