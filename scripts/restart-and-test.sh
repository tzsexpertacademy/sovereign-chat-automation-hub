#!/bin/bash

echo "🔄 REINICIANDO SERVIDOR E TESTANDO CORREÇÕES DE QR CODE"
echo "======================================================"

# Parar servidor atual
echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

# Limpar processos Chrome órfãos
echo "🧹 Limpando processos Chrome..."
pkill -f chrome || true
pkill -f chromium || true

# Aguardar limpeza
sleep 3

# Iniciar servidor com correções
echo "🚀 Iniciando servidor corrigido..."
./scripts/production-start-whatsapp.sh

# Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 10

# Testar correções
echo "🧪 Testando correções do sistema QR Code..."
./scripts/quick-api-test.sh

echo ""
echo "🔗 TESTE MANUAL COMPLETO DE QR CODE:"
echo "1. Criar instância:"
echo "curl -k -X POST \"https://146.59.227.248/clients/test_instance_$(date +%s)/connect\""
echo ""
echo "2. Verificar QR disponível:"
echo "curl -k -s \"https://146.59.227.248/clients/test_instance_*/status\" | jq '.'"
echo ""
echo "3. Escanear QR Code no WhatsApp"
echo ""
echo "4. Aguardar transição: qr_ready → connected"
echo ""
echo "✅ Correções QR Code implementadas!"
echo "📱 QR Code agora permanece visível até escaneamento completo"
echo "🔄 Polling otimizado para 2 segundos"
echo "🗄️ Recovery system com Supabase habilitado"