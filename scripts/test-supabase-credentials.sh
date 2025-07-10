#!/bin/bash

# Script para testar credenciais Supabase e identificar o problema
echo "🧪 TESTE DEFINITIVO DAS CREDENCIAIS SUPABASE"
echo "============================================="

echo ""
echo "📋 CREDENCIAIS ATUAIS:"
echo "======================"
echo "URL Frontend: $(grep SUPABASE_URL src/integrations/supabase/client.ts)"
echo "URL Backend: $(grep SUPABASE_URL server/.env)"
echo "Service Key: $(grep SUPABASE_SERVICE_KEY server/.env | cut -d'=' -f2 | head -c 50)..."

echo ""
echo "🔍 TESTANDO CONECTIVIDADE DIRETA"
echo "================================="

# Testar conectividade HTTP básica
echo "🌐 Testando conectividade HTTP..."
if curl -s --max-time 10 https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/ > /dev/null; then
    echo "✅ Conectividade HTTP OK"
else
    echo "❌ Falha na conectividade HTTP"
fi

# Testar com a API key
echo ""
echo "🔑 Testando autenticação com Service Key..."
RESPONSE=$(curl -s --max-time 10 \
    -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY" \
    https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/clients?select=id)

if [ -n "$RESPONSE" ] && [ "$RESPONSE" != "null" ]; then
    echo "✅ Autenticação OK - Resposta: $RESPONSE"
else
    echo "❌ Falha na autenticação - Resposta: $RESPONSE"
fi

echo ""
echo "🔑 Testando com Anon Key..."
ANON_RESPONSE=$(curl -s --max-time 10 \
    -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI" \
    https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/clients?select=id)

if [ -n "$ANON_RESPONSE" ] && [ "$ANON_RESPONSE" != "null" ]; then
    echo "✅ Anon Key OK - Resposta: $ANON_RESPONSE"
else
    echo "❌ Falha com Anon Key - Resposta: $ANON_RESPONSE"
fi

echo ""
echo "🧪 TESTANDO SERVIDOR NODE.JS"
echo "============================="

# Parar servidor atual
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    echo "🛑 Parando servidor atual (PID: $PID)..."
    kill -TERM "$PID" 2>/dev/null
    sleep 3
fi

# Entrar no diretório do servidor
cd server || exit 1

echo "🚀 Iniciando servidor com debug..."
node whatsapp-multi-client-server.js &
SERVER_PID=$!

echo "⏳ Aguardando inicialização (10s)..."
sleep 10

# Testar endpoints
echo ""
echo "🧪 Testando endpoints do servidor..."
echo "==================================="

echo "🔍 Health check..."
HEALTH=$(curl -s http://localhost:4000/health 2>/dev/null)
echo "📊 Health: $HEALTH"

echo "🔍 Clients endpoint..."
CLIENTS=$(curl -s http://localhost:4000/clients 2>/dev/null)
echo "📊 Clients: $CLIENTS"

echo "🔍 Instances endpoint..."
INSTANCES=$(curl -s http://localhost:4000/instances 2>/dev/null)
echo "📊 Instances: $INSTANCES"

# Limpar
echo ""
echo "🧹 Limpando..."
kill $SERVER_PID 2>/dev/null

cd ..

echo ""
echo "🏁 TESTE CONCLUÍDO"
echo "=================="
echo "📅 $(date)"