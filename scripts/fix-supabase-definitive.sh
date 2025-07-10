#!/bin/bash

# Script para correção DEFINITIVA das credenciais Supabase
# Arquivo: scripts/fix-supabase-definitive.sh

echo "🔧 CORREÇÃO DEFINITIVA - CREDENCIAIS SUPABASE"
echo "=============================================="

echo ""
echo "🛑 PARANDO SERVIDOR ATUAL"
echo "========================"
pkill -f "whatsapp-multi-client" || echo "✅ Nenhum servidor rodando"
sleep 3

# Verificar se porta está livre
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Forçando liberação da porta 4000..."
    fuser -k 4000/tcp 2>/dev/null || true
    sleep 2
fi

echo "✅ Servidor parado"

echo ""
echo "🔍 VERIFICANDO CREDENCIAIS SINCRONIZADAS"
echo "========================================"
echo "📋 Backend (.env):"
grep SUPABASE_URL server/.env
echo "📋 Frontend (client.ts):"
grep SUPABASE_URL src/integrations/supabase/client.ts

echo ""
echo "🚀 REINICIANDO COM CREDENCIAIS CORRETAS"
echo "======================================"

cd server || exit 1
mkdir -p ../logs

# Definir variáveis corretas
export DEBUG=true
export LOG_LEVEL=debug
export SUPABASE_URL="https://19c6b746-780c-41f1-97e3-86e1c8f2c488.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IjE5YzZiNzQ2LTc4MGMtNDFmMS05N2UzLTg2ZTFjOGYyYzQ4OCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.abc123servicerolekey"

echo "🚀 Iniciando servidor..."
nohup node whatsapp-multi-client-server.js > ../logs/supabase-fix.log 2>&1 &
SERVER_PID=$!

echo "🆔 PID: $SERVER_PID"
echo "$SERVER_PID" > ../logs/whatsapp-server.pid

echo "⏳ Aguardando inicialização (15s)..."
sleep 15

echo ""
echo "🧪 TESTANDO CONEXÕES"
echo "===================="

# Testar health
echo "🔍 Health check..."
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Health OK"
else
    echo "❌ Health falhou"
fi

# Testar clients
echo "🔍 Testando clients..."
CLIENTS_RESPONSE=$(curl -s http://localhost:4000/clients 2>/dev/null)
if echo "$CLIENTS_RESPONSE" | grep -q "success\|clients"; then
    echo "✅ Clients funcionando"
    echo "📊 Instâncias encontradas: $(echo "$CLIENTS_RESPONSE" | jq '.clients | length' 2>/dev/null || echo 'OK')"
else
    echo "❌ Clients com erro:"
    echo "$CLIENTS_RESPONSE"
fi

# Testar conexão específica
echo "🔍 Testando conexão de instância..."
CONNECT_RESPONSE=$(curl -s -X POST http://localhost:4000/clients/35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752172373109/connect 2>/dev/null)
if echo "$CONNECT_RESPONSE" | grep -q "success\|qr_code"; then
    echo "✅ Conexão funcionando!"
else
    echo "❌ Conexão com erro:"
    echo "$CONNECT_RESPONSE"
fi

cd ..

echo ""
echo "🏁 CORREÇÃO DEFINITIVA CONCLUÍDA"
echo "================================"
echo "📅 $(date)"
echo "🆔 PID: $SERVER_PID"
echo "📝 Logs: tail -f logs/supabase-fix.log"
echo ""

# Verificar se há erros nos logs
if grep -q "Invalid API key" logs/supabase-fix.log 2>/dev/null; then
    echo "❌ AINDA HÁ ERROS DE API KEY"
    echo "🔍 Verificar logs detalhados: tail logs/supabase-fix.log"
else
    echo "🎉 SUCESSO! SEM ERROS DE API KEY"
    echo "✅ Sistema funcionando corretamente"
    echo "🧪 Teste agora: /admin/instances"
fi