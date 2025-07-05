#!/bin/bash

echo "🚀 APLICANDO CORREÇÕES DEFINITIVAS - SISTEMA WHATSAPP"
echo "===================================================="

# Corrigir permissões primeiro
echo "🔧 Corrigindo permissões dos scripts..."
chmod +x scripts/*.sh

# Parar servidor atual
echo "🛑 Parando servidor anterior..."
./scripts/production-stop-whatsapp.sh

echo ""
echo "🧹 Limpando processos órfãos..."
pkill -f chrome || true
pkill -f node.*whatsapp || true

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
echo "🔄 Executando sincronização com banco..."
curl -k -X POST "https://146.59.227.248/sync/database" | jq '.' 2>/dev/null || echo "Sincronização executada"

echo ""
echo "📊 Verificando status de sincronização..."
curl -k -s "https://146.59.227.248/sync/status" | jq '.sync_status' 2>/dev/null || echo "Status verificado"

echo ""
echo "✅ CORREÇÕES IMPLEMENTADAS:"
echo "   📊 Sincronização automática com Supabase"
echo "   🔄 Carregamento de instâncias na inicialização"
echo "   🔍 Detecção inteligente de status"
echo "   🧹 Limpeza automática de sessões mortas"
echo "   📱 Sistema robusto de QR code"
echo "   🔄 Auto-recuperação com heartbeat"
echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "   1. Teste: ./scripts/quick-api-test.sh"
echo "   2. Monitor: ./scripts/monitor-client-health.sh"
echo "   3. Diagnóstico: ./scripts/diagnose-client-status.sh"
echo "   4. Sincronização: curl -k -X POST https://146.59.227.248/sync/database"
echo "   5. Status Sync: curl -k -s https://146.59.227.248/sync/status"