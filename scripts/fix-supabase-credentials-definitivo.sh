#!/bin/bash

# Tornar o script executável
chmod +x "$0"

# Script DEFINITIVO para correção das credenciais Supabase
# Arquivo: scripts/fix-supabase-credentials-definitivo.sh

echo "🔧 CORREÇÃO DEFINITIVA - CREDENCIAIS SUPABASE"
echo "=============================================="

echo ""
echo "🛑 PARANDO SERVIDOR ATUAL"
echo "========================"

# Parar servidor atual com força total
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    echo "🔍 Processo encontrado: $PID"
    kill -TERM "$PID" 2>/dev/null
    sleep 3
    if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️ Forçando parada..."
        kill -KILL "$PID" 2>/dev/null
    fi
    echo "✅ Servidor parado"
else
    echo "✅ Nenhum processo na porta 4000"
fi

# Limpar porta completamente
fuser -k 4000/tcp 2>/dev/null || true
pkill -f "whatsapp-multi-client" 2>/dev/null || true
sleep 3

echo ""
echo "🔍 VERIFICANDO CREDENCIAIS ATUAIS"
echo "================================="

echo "📋 Backend (.env):"
grep SUPABASE_URL server/.env
echo "📋 Frontend (client.ts):"
grep SUPABASE_URL src/integrations/supabase/client.ts

echo ""
echo "🚀 REINICIANDO COM CREDENCIAIS CORRETAS"
echo "======================================"

cd server || exit 1
mkdir -p ../logs

echo "📋 Variáveis de ambiente:"
echo "   SUPABASE_URL: https://ymygyagbvbsdfkduxmgu.supabase.co"
echo "   SERVICE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Definir variáveis de ambiente explicitamente
export DEBUG=true
export LOG_LEVEL=debug
export SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

# Iniciar servidor com debug completo
echo "🚀 Iniciando servidor com debug..."
nohup node whatsapp-multi-client-server.js > ../logs/fix-definitivo.log 2>&1 &
SERVER_PID=$!

echo "🆔 Novo PID: $SERVER_PID"
echo "$SERVER_PID" > ../logs/whatsapp-server.pid

# Aguardar inicialização
echo "⏳ Aguardando inicialização (20s)..."
sleep 20

# Mostrar logs de inicialização
echo ""
echo "📝 LOGS DE INICIALIZAÇÃO:"
echo "========================"
tail -20 ../logs/fix-definitivo.log

echo ""
echo "🧪 TESTANDO CONEXÃO SUPABASE"
echo "============================"

# Testar health
echo "🔍 Health check..."
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Health OK"
    
    # Testar clients (usa Supabase)
    echo "🔍 Testando clients..."
    CLIENTS_RESPONSE=$(curl -s http://localhost:4000/clients 2>/dev/null)
    if echo "$CLIENTS_RESPONSE" | grep -q "success\|clients\|\["; then
        echo "✅ Clients funcionando"
        echo "📊 Resposta: $CLIENTS_RESPONSE"
    else
        echo "❌ Clients com erro:"
        echo "$CLIENTS_RESPONSE"
    fi
    
    # Testar instances (usa Supabase)
    echo "🔍 Testando instances..."
    INSTANCES_RESPONSE=$(curl -s http://localhost:4000/instances 2>/dev/null)
    if echo "$INSTANCES_RESPONSE" | grep -q "success\|instances\|\["; then
        echo "✅ Instances funcionando"
        echo "📊 Instâncias encontradas: $(echo "$INSTANCES_RESPONSE" | jq '.instances | length' 2>/dev/null || echo 'OK')"
    else
        echo "❌ Instances com erro:"
        echo "$INSTANCES_RESPONSE"
    fi
    
else
    echo "❌ Health falhou"
fi

cd ..

echo ""
echo "📝 LOGS FINAIS (últimas 15 linhas):"
echo "==================================="
tail -15 logs/fix-definitivo.log

echo ""
echo "🏁 CORREÇÃO DEFINITIVA CONCLUÍDA"
echo "================================"
echo "📅 $(date)"
echo "🆔 PID: $SERVER_PID"
echo "📝 Logs: tail -f logs/fix-definitivo.log"
echo ""

# Verificar se há erros de API key
if grep -q "Invalid API key\|unauthorized\|403" logs/fix-definitivo.log 2>/dev/null; then
    echo "❌ AINDA HÁ ERROS DE CREDENCIAIS"
    echo "🔍 Últimos erros:"
    grep -A2 -B2 "Invalid API key\|unauthorized\|403" logs/fix-definitivo.log | tail -10
else
    echo "🎉 SUCESSO! SEM ERROS DE CREDENCIAIS"
    echo "✅ Sistema funcionando corretamente"
    echo "🧪 Teste agora: Acesse /admin/instances e conecte uma instância"
fi