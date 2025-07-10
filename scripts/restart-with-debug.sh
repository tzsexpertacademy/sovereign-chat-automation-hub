#!/bin/bash
chmod +x "$0"

# Script para restart com debug detalhado
# Arquivo: scripts/restart-with-debug.sh

echo "🔧 RESTART COM DEBUG MÁXIMO"
echo "============================"

# Parar servidor atual
echo "🛑 Parando servidor..."
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    kill -TERM "$PID" 2>/dev/null
    sleep 3
    if kill -0 "$PID" 2>/dev/null; then
        kill -KILL "$PID" 2>/dev/null
    fi
fi

# Limpar porta
fuser -k 4000/tcp 2>/dev/null || true
sleep 2

echo "✅ Servidor parado"

# Entrar no diretório do servidor
cd server || exit 1

# Verificar variáveis de ambiente
echo ""
echo "🔍 VERIFICANDO VARIÁVEIS DE AMBIENTE:"
echo "=================================="
if [ -f ".env" ]; then
    echo "✅ Arquivo .env encontrado"
    echo "📋 Conteúdo do .env:"
    cat .env
else
    echo "❌ Arquivo .env não encontrado!"
fi

echo ""
echo "🔍 VERIFICANDO CREDENCIAIS NO CONFIG.JS:"
echo "======================================="
grep -n "SUPABASE_SERVICE_KEY" modules/config.js | head -5

echo ""
echo "🚀 INICIANDO SERVIDOR COM DEBUG..."
echo "================================="

# Criar diretório de logs
mkdir -p ../logs

# Iniciar servidor com debug máximo
export DEBUG=true
export LOG_LEVEL=debug

nohup node whatsapp-multi-client-server.js > ../logs/debug-whatsapp.log 2>&1 &
SERVER_PID=$!

echo "🆔 Novo PID: $SERVER_PID"
echo "$SERVER_PID" > ../logs/whatsapp-server.pid

# Aguardar inicialização
echo "⏳ Aguardando inicialização (15s)..."
sleep 15

# Mostrar logs de debug
echo ""
echo "📝 LOGS DE DEBUG (últimas 20 linhas):"
echo "===================================="
tail -20 ../logs/debug-whatsapp.log

# Testar servidor
echo ""
echo "🧪 TESTANDO SERVIDOR..."
echo "====================="
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor respondendo"
    
    # Testar endpoint específico
    echo "🔍 Testando conexão com instância..."
    curl -X POST -H "Content-Type: application/json" \
         http://localhost:4000/clients/test_debug/connect \
         2>/dev/null | head -3
    
    echo ""
    echo "📝 Logs após teste (últimas 10 linhas):"
    tail -10 ../logs/debug-whatsapp.log
else
    echo "❌ Servidor não respondendo"
    echo "📝 Logs de erro:"
    tail -15 ../logs/debug-whatsapp.log
fi

cd ..
echo ""
echo "🏁 Debug concluído - PID: $SERVER_PID"
echo "📝 Monitorar: tail -f logs/debug-whatsapp.log"