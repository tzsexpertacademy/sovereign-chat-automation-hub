#!/bin/bash

# Script para reiniciar servidor com debug final
# Arquivo: scripts/restart-debug-final.sh

echo "🔄 REINICIANDO SERVIDOR COM DEBUG FINAL"
echo "======================================"

echo ""
echo "🛑 1. PARANDO SERVIDOR ATUAL"
echo "=========================="
pkill -f "whatsapp-multi-client" || echo "Nenhum processo encontrado"
sleep 2

echo ""
echo "🔧 2. VERIFICANDO CONFIGURAÇÕES"
echo "==============================="
echo "📋 Arquivo .env atual:"
cat server/.env | grep -E "(SUPABASE_URL|SUPABASE_SERVICE_KEY)" | head -2

echo ""
echo "📋 Config.js atual:"
grep -A 2 -B 2 "SUPABASE_URL.*=" server/modules/config.js

echo ""
echo "🚀 3. INICIANDO SERVIDOR COM DEBUG DETALHADO"
echo "=========================================="
cd server
echo "📂 Diretório atual: $(pwd)"
echo "🔥 Iniciando servidor..."

# Executar servidor com debug verbose
DEBUG=* NODE_ENV=production node whatsapp-multi-client-server.js 2>&1 | tee ../logs/debug-final.log &

SERVER_PID=$!
echo "🆔 PID do servidor: $SERVER_PID"

echo ""
echo "⏳ 4. AGUARDANDO INICIALIZAÇÃO (10s)..."
sleep 10

echo ""
echo "🧪 5. TESTANDO CONEXÕES"
echo "======================="

# Testar health
echo "🔍 Testando health direto..."
HEALTH_DIRECT=$(curl -s -w "%{http_code}" http://localhost:4000/health -o /tmp/health_direct.json)
echo "Health direto: $HEALTH_DIRECT"
if [ "$HEALTH_DIRECT" = "200" ]; then
    echo "✅ Health funcionando"
else
    echo "❌ Health falhou"
fi

# Testar clients
echo ""
echo "🔍 Testando endpoint clients direto..."
CLIENTS_DIRECT=$(curl -s -w "%{http_code}" http://localhost:4000/clients -o /tmp/clients_direct.json)
echo "Clients direto: $CLIENTS_DIRECT"
if [ "$CLIENTS_DIRECT" = "200" ]; then
    echo "✅ Clients funcionando"
else
    echo "❌ Clients falhou - Verificando logs..."
    tail -n 20 ../logs/debug-final.log | grep -E "(Error|error|ERROR|❌)"
fi

# Testar conexão de instância
echo ""
echo "🔍 Testando conexão de instância..."
CONNECT_TEST=$(curl -s -w "%{http_code}" -X POST http://localhost:4000/clients/35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752172373109/connect -o /tmp/connect_test.json)
echo "Connect test: $CONNECT_TEST"
if [ "$CONNECT_TEST" = "200" ]; then
    echo "✅ Conexão funcionando"
    cat /tmp/connect_test.json | jq .
else
    echo "❌ Conexão falhou - Detalhes:"
    cat /tmp/connect_test.json
    echo ""
    echo "📋 Últimos logs de erro:"
    tail -n 30 ../logs/debug-final.log | grep -E "(Error|error|ERROR|❌|500)" | tail -10
fi

echo ""
echo "🏁 RESULTADO FINAL"
echo "=================="
echo "📊 Health: $HEALTH_DIRECT"
echo "📊 Clients: $CLIENTS_DIRECT" 
echo "📊 Connect: $CONNECT_TEST"
echo "🆔 PID: $SERVER_PID"
echo ""
echo "📁 Logs detalhados em: logs/debug-final.log"
echo "🔍 Para ver logs: tail -f logs/debug-final.log"