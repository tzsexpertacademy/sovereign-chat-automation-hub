#!/bin/bash

echo "🧪 TESTE COM ANON KEY FUNCIONAL"
echo "================================"

# Parar servidor atual
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    echo "🛑 Parando servidor atual..."
    kill -TERM "$PID" 2>/dev/null
    sleep 3
fi

cd server || exit 1

echo "🚀 Iniciando servidor com ANON KEY..."
node whatsapp-multi-client-server.js &
SERVER_PID=$!

echo "⏳ Aguardando inicialização (10s)..."
sleep 10

echo ""
echo "🧪 Testando endpoints..."
echo "======================="

echo "🔍 Health check..."
curl -s http://localhost:4000/health | jq '.' 2>/dev/null || curl -s http://localhost:4000/health

echo ""
echo "🔍 Clients endpoint..."
curl -s http://localhost:4000/clients | jq '.' 2>/dev/null || curl -s http://localhost:4000/clients

echo ""
echo "🔍 Instances endpoint..."
curl -s http://localhost:4000/instances | jq '.' 2>/dev/null || curl -s http://localhost:4000/instances

# Limpar
echo ""
echo "🧹 Limpando..."
kill $SERVER_PID 2>/dev/null

cd ..

echo ""
echo "✅ TESTE CONCLUÍDO - ANON KEY"