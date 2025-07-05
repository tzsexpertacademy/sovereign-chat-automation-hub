#!/bin/bash

echo "🚀 APLICANDO CORREÇÕES DEFINITIVAS - SISTEMA WHATSAPP"
echo "===================================================="

# Parar servidor atual
./scripts/production-stop-whatsapp.sh

echo ""
echo "🧹 Limpando processos órfãos..."
pkill -f chrome || true
pkill -f node.*whatsapp || true

echo ""
echo "🔧 Tornando scripts executáveis..."
chmod +x scripts/diagnose-client-status.sh
chmod +x scripts/monitor-client-health.sh
chmod +x scripts/quick-api-test.sh

echo ""
echo "🚀 Iniciando servidor com correções implementadas..."
./scripts/production-start-whatsapp.sh

echo ""
echo "⏳ Aguardando estabilização..."
sleep 8

echo ""
echo "🧪 Testando correções..."
./scripts/quick-api-test.sh

echo ""
echo "✅ CORREÇÕES IMPLEMENTADAS:"
echo "   📊 Diagnóstico profundo de clientes"
echo "   🔍 Detecção inteligente de status"
echo "   🧹 Limpeza automática de sessões mortas"
echo "   📱 Sistema robusto de QR code"
echo "   🔄 Auto-recuperação com heartbeat"
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "   1. Teste: ./scripts/quick-api-test.sh"
echo "   2. Monitor: ./scripts/monitor-client-health.sh"
echo "   3. Diagnóstico: ./scripts/diagnose-client-status.sh"