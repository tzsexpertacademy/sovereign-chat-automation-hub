#!/bin/bash

echo "🔧 APLICANDO CORREÇÕES DEFINITIVAS DO WHATSAPP"
echo "============================================="

echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

echo "🧹 Limpeza completa de processos..."
pkill -f chrome || true
pkill -f chromium || true
sleep 3

echo "🚀 Iniciando servidor com correções aplicadas..."
./scripts/production-start-whatsapp.sh

echo "⏳ Aguardando estabilização..."
sleep 15

echo "🧪 Testando correções..."
curl -k -s "https://146.59.227.248/health" | jq '.'

echo ""
echo "✅ CORREÇÕES APLICADAS!"
echo "======================"
echo "🔧 Puppeteer: Configuração otimizada"
echo "🔧 Auto-recovery: Reduzido para 15s (menos intrusivo)"
echo "🔧 Event listeners: Duplicações removidas"
echo "🔧 Authenticated: Melhor tratamento"
echo "🔧 Ready: Controle aprimorado"
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo "2. Crie uma nova instância"
echo "3. Escaneie o QR Code"
echo "4. Agora deve transitar corretamente: qr_ready → authenticated → connected"
echo ""
echo "📊 Para monitorar: ./scripts/monitor-puppeteer-detailed.sh [instance_id]"