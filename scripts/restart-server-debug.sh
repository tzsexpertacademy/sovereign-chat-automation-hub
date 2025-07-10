#!/bin/bash

# restart-server-debug.sh - Reiniciar servidor com logs detalhados

echo "🔄 REINICIANDO SERVIDOR COM DEBUG"
echo "================================="

cd /home/ubuntu/sovereign-chat-automation-hub

echo "1️⃣ PARANDO SERVIDOR ATUAL"
echo "========================="

echo "🔍 Buscando processos Node.js..."
PIDS=$(ps aux | grep node | grep -v grep | awk '{print $2}')

if [ -n "$PIDS" ]; then
    echo "🔪 Matando processos: $PIDS"
    for pid in $PIDS; do
        kill -9 $pid 2>/dev/null
        echo "   ✅ Processo $pid terminado"
    done
else
    echo "   ℹ️ Nenhum processo Node.js encontrado"
fi

echo ""
echo "🔍 Verificando porta 3001..."
PORT_PID=$(netstat -tlnp 2>/dev/null | grep :3001 | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PORT_PID" ]; then
    echo "🔪 Liberando porta 3001 (PID: $PORT_PID)"
    kill -9 $PORT_PID 2>/dev/null
fi

sleep 2

echo ""
echo "2️⃣ INICIANDO SERVIDOR EM MODO DEBUG"
echo "==================================="

echo "🚀 Iniciando servidor modular..."
echo "📊 Logs serão salvos em server.log"

# Iniciar servidor com logs detalhados
NODE_ENV=development DEBUG=* node server/whatsapp-multi-client-server.js > server.log 2>&1 &
SERVER_PID=$!

echo "   ✅ Servidor iniciado (PID: $SERVER_PID)"
echo "   📝 Logs: tail -f server.log"

sleep 5

echo ""
echo "3️⃣ VERIFICANDO INICIALIZAÇÃO"
echo "============================"

echo "🔍 Verificando se o servidor iniciou..."
if ps -p $SERVER_PID > /dev/null; then
    echo "   ✅ Servidor rodando (PID: $SERVER_PID)"
else
    echo "   ❌ Servidor não iniciou. Verificando logs..."
    tail -10 server.log
    exit 1
fi

sleep 3

echo ""
echo "🔍 Testando health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/health" 2>/dev/null)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "   ✅ Health check OK (Status: $HEALTH_STATUS)"
else
    echo "   ❌ Health check falhou (Status: $HEALTH_STATUS)"
    echo "   📋 Últimas linhas do log:"
    tail -10 server.log
fi

echo ""
echo "4️⃣ TESTANDO ENDPOINTS /API/"
echo "=========================="

CLIENT_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752173664034"

sleep 2

echo "🔍 Testando /api/clients/$CLIENT_ID..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/clients/$CLIENT_ID" 2>/dev/null)
echo "   Status: $API_STATUS"

echo ""
echo "🔍 Testando /api/clients/$CLIENT_ID/send..."
SEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"to":"5511999999999@c.us","message":"teste"}' \
  "http://localhost:3001/api/clients/$CLIENT_ID/send" 2>/dev/null)
echo "   Status: $SEND_STATUS"

echo ""
echo "5️⃣ RESULTADO DO RESTART"
echo "======================="

if [ "$HEALTH_STATUS" = "200" ] && ([ "$API_STATUS" != "404" ] || [ "$SEND_STATUS" != "404" ]); then
    echo "✅ SERVIDOR REINICIADO COM SUCESSO!"
    echo "🎯 Endpoints /api/ estão funcionando"
    echo ""
    echo "📋 PRÓXIMOS PASSOS:"
    echo "1. Teste no navegador: envie uma mensagem"
    echo "2. Verifique se não há mais erro 404"
    echo "3. Monitore logs: tail -f server.log"
else
    echo "❌ AINDA HÁ PROBLEMAS COM OS ENDPOINTS"
    echo "📋 Logs recentes:"
    tail -20 server.log
fi

echo ""
echo "🔧 Para monitorar em tempo real:"
echo "   tail -f server.log"
echo ""
echo "🌐 Para testar via Nginx:"
echo "   curl https://146.59.227.248/api/clients/$CLIENT_ID"