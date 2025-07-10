#!/bin/bash

# Script para correção DEFINITIVA das credenciais Supabase
# Arquivo: scripts/fix-supabase-credentials-final.sh

echo "🔧 CORREÇÃO DEFINITIVA - CREDENCIAIS SUPABASE"
echo "=============================================="

echo "🔍 Problema identificado: Credenciais divergentes nos módulos"
echo "✅ Padronizando todas as chaves Supabase"

echo ""
echo "🔄 SINCRONIZANDO CREDENCIAIS"
echo "============================"

# Verificar se as credenciais estão sincronizadas
echo "📋 Verificando credenciais atuais:"
echo "Frontend (anon): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"

echo "Backend (.env): $(grep SUPABASE_SERVICE_KEY server/.env | cut -d'=' -f2)"

echo "Backend (config.js):"
grep "SUPABASE_SERVICE_KEY.*=" server/modules/config.js | head -1

echo ""
echo "🛑 PARANDO SERVIDOR ATUAL"
echo "========================"

# Parar servidor atual
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

# Limpar porta
fuser -k 4000/tcp 2>/dev/null || true
sleep 2

echo ""
echo "🚀 REINICIANDO COM CREDENCIAIS SINCRONIZADAS"
echo "============================================="

# Entrar no diretório do servidor
cd server || exit 1

# Criar diretório de logs
mkdir -p ../logs

# Definir variáveis de ambiente explicitamente
export DEBUG=true
export LOG_LEVEL=debug
export SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.x9kJjmvyoGaB1e_tBfmSV8Z8eM6t_0WdGqF4_rMwKDI"

# Iniciar servidor
nohup node whatsapp-multi-client-server.js > ../logs/final-fix.log 2>&1 &
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
tail -15 ../logs/final-fix.log

# Testar servidor
echo ""
echo "🧪 TESTANDO CONEXÃO SUPABASE"
echo "============================"

if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor respondendo"
    
    # Testar endpoint com instância real
    echo "🔍 Testando busca de instância real..."
    RESPONSE=$(curl -s http://localhost:4000/instances 2>/dev/null)
    echo "📊 Resposta: $RESPONSE"
    
    echo ""
    echo "📝 Logs finais (últimas 10 linhas):"
    tail -10 ../logs/final-fix.log
    
    # Verificar se há erros de API key
    if grep -q "Invalid API key" ../logs/final-fix.log; then
        echo ""
        echo "❌ AINDA HÁ ERRO DE API KEY"
        echo "🔍 Verificando logs detalhados..."
        grep -A2 -B2 "Invalid API key" ../logs/final-fix.log | tail -10
    else
        echo ""
        echo "🎉 SUCESSO! SEM ERROS DE API KEY"
    fi
else
    echo "❌ Servidor não está respondendo"
    echo "📝 Logs de erro:"
    tail -20 ../logs/final-fix.log
fi

cd ..

echo ""
echo "🏁 CORREÇÃO DEFINITIVA CONCLUÍDA"
echo "================================"
echo "📅 $(date)"
echo "🆔 PID: $SERVER_PID"
echo "📝 Logs: tail -f logs/final-fix.log"
echo ""
echo "✅ Se não houver mais erros 'Invalid API key', o problema está resolvido!"
echo "🧪 Teste agora: Acesse admin/instances e tente conectar uma instância"