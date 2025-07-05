#!/bin/bash

echo "🔄 REINICIANDO SERVIDOR E TESTANDO CORREÇÕES"
echo "==========================================="

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
echo "🧪 Testando com instance ID correto..."
./scripts/quick-api-test.sh

echo ""
echo "🔗 TESTE MANUAL DE CONEXÃO:"
echo "curl -k -X POST \"https://146.59.227.248/clients/35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751734727003/connect\""
echo ""
echo "📊 VERIFICAR STATUS:"
echo "curl -k -s \"https://146.59.227.248/clients/35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751734727003/status\" | jq '.'"
echo ""
echo "✅ Correções implementadas!"