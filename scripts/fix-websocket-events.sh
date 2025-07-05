#!/bin/bash

echo "🔧 CORREÇÃO CRÍTICA DOS EVENTOS WEBSOCKET"
echo "========================================="

echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

echo "🧹 Limpeza completa de processos órfãos..."
pkill -f chrome || true
pkill -f chromium || true
sleep 3

echo "🚀 Iniciando servidor com eventos WebSocket corrigidos..."
./scripts/production-start-whatsapp.sh

echo "⏳ Aguardando estabilização (15 segundos)..."
sleep 15

echo "🧪 Testando correções..."
curl -k -s "https://146.59.227.248/health" | jq '.'

echo ""
echo "✅ CORREÇÕES WEBSOCKET APLICADAS!"
echo "================================="
echo "🔧 Eventos authenticated: Envio duplo (sala + global)"
echo "🔧 Eventos ready/connected: Envio duplo (sala + global)"
echo "🔧 Melhor detecção de clientes na sala"
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. Execute: chmod +x scripts/test-complete-qr-flow.sh"
echo "2. Execute: ./scripts/test-complete-qr-flow.sh"
echo "3. Escaneie o QR Code quando aparecer"
echo "4. Observe o fluxo: qr_ready → authenticated → connected"
echo ""
echo "🐛 Para debug detalhado: ./scripts/monitor-puppeteer-detailed.sh [instance_id]"