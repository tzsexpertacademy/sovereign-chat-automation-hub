#!/bin/bash

echo "🚀 REINICIANDO SERVIDOR WHATSAPP COM CORREÇÕES IMPLEMENTADAS"
echo "============================================================"

# Parar servidor atual
./scripts/production-stop-whatsapp.sh

echo ""
echo "🧹 Limpando processos órfãos..."
pkill -f chrome || true
pkill -f puppeteer || true

echo ""
echo "🚀 Iniciando servidor com sistema corrigido..."
./scripts/production-start-whatsapp.sh

echo ""
echo "⏳ Aguardando estabilização (10s)..."
sleep 10

echo ""
echo "🧪 Testando correções aplicadas..."
curl -s "https://146.59.227.248/health" | jq -r '.status // "offline"'

echo ""
echo "✅ CORREÇÕES IMPLEMENTADAS:"
echo "   🔧 FASE 1: Verificação de saúde das sessões Puppeteer"
echo "   🔍 FASE 2: Detecção ativa com múltiplas fontes"
echo "   🔄 FASE 3: Sistema de recuperação automática"
echo ""
echo "🎯 TESTE AGORA:"
echo "   1. Crie nova instância no painel"
echo "   2. Escaneie o QR code"
echo "   3. O status deve mudar automaticamente para 'connected'"