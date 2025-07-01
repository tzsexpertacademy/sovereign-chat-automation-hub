
#!/bin/bash

# Script para teste detalhado HTTPS
# Arquivo: scripts/test-https-detailed.sh

echo "🔍 TESTE DETALHADO HTTPS"
echo "======================="

DOMAIN="146.59.227.248"

echo "1. TESTANDO SERVIDOR BACKEND DIRETO:"
echo "===================================="
curl -s -w "HTTP Code: %{http_code} | Time: %{time_total}s\n" http://127.0.0.1:4000/health | head -3

echo ""
echo "2. TESTANDO VIA HTTPS:"
echo "====================="
curl -k -s -w "HTTP Code: %{http_code} | Time: %{time_total}s\n" https://$DOMAIN/health | head -3

echo ""
echo "3. TESTANDO CONECTIVIDADE:"
echo "========================="
timeout 3 nc -zv 127.0.0.1 4000 2>&1 | grep -E "(succeeded|failed)"
timeout 3 nc -zv $DOMAIN 443 2>&1 | grep -E "(succeeded|failed)"

echo ""
echo "4. STATUS DOS SERVIÇOS:"
echo "======================"
echo "Nginx: $(systemctl is-active nginx)"
echo "PM2 Processes:"
pm2 list | grep whatsapp || echo "Nenhum processo PM2"

echo ""
echo "5. PORTAS EM USO:"
echo "================"
echo "Porta 4000:"
ss -tlnp | grep :4000 || echo "Porta 4000 não está sendo usada"
echo "Porta 443:"
ss -tlnp | grep :443 || echo "Porta 443 não está sendo usada"

echo ""
echo "6. LOGS NGINX (últimas 3 linhas):"
echo "================================="
tail -3 /var/log/nginx/error.log 2>/dev/null || echo "Sem logs de erro"

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "Se Health Check retornar 502:"
echo "1. sudo ./scripts/fix-https-502-error.sh"
echo "2. Reiniciar servidor: ./scripts/production-stop-whatsapp.sh && ./scripts/production-start-whatsapp.sh"
echo "3. Verificar logs: tail -f /var/log/nginx/whatsapp-error.log"
