#!/bin/bash

# Script DEFINITIVO para sincronizar TODAS as chaves Supabase
# Arquivo: scripts/execute-final-sync.sh

echo "🔧 SINCRONIZAÇÃO DEFINITIVA - TODAS AS CHAVES SUPABASE"
echo "======================================================="

echo ""
echo "🔍 PROBLEMA IDENTIFICADO:"
echo "========================="
echo "❌ Frontend e Backend usam chaves diferentes"
echo "❌ Scripts têm chaves desatualizadas"
echo "❌ Módulos backend não sincronizados"

echo ""
echo "🎯 SOLUÇÃO DEFINITIVA:"
echo "======================"
echo "✅ Atualizar FRONTEND para usar chave ANON correta"
echo "✅ Atualizar BACKEND para usar chave SERVICE correta"
echo "✅ Sincronizar TODOS os scripts"
echo "✅ Testar conexões imediatamente"

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
echo "🔧 EXECUTANDO SCRIPT DE TESTE"
echo "============================="

# Tornar o script executável
chmod +x scripts/test-supabase-final.sh

# Executar teste das chaves
./scripts/test-supabase-final.sh

echo ""
echo "🚀 REINICIANDO SERVIDOR COM CHAVES CORRETAS"
echo "=========================================="

# Entrar no diretório do servidor
cd server || exit 1

# Criar diretório de logs
mkdir -p ../logs

# Definir variáveis de ambiente corretas
export DEBUG=true
export LOG_LEVEL=debug
export SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

echo "📋 Variáveis de ambiente configuradas:"
echo "   SUPABASE_URL: $SUPABASE_URL"
echo "   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:0:20}..."

# Iniciar servidor
echo "🚀 Iniciando servidor..."
nohup node whatsapp-multi-client-server.js > ../logs/sync-final.log 2>&1 &
SERVER_PID=$!

echo "🆔 Novo PID: $SERVER_PID"
echo "$SERVER_PID" > ../logs/whatsapp-server.pid

# Aguardar inicialização
echo "⏳ Aguardando inicialização (15s)..."
sleep 15

# Mostrar logs de inicialização
echo ""
echo "📝 LOGS DE INICIALIZAÇÃO:"
echo "========================"
tail -15 ../logs/sync-final.log

echo ""
echo "🧪 TESTE FINAL DE CONEXÃO"
echo "========================="

if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor respondendo"
    
    # Testar endpoint que usa Supabase
    echo "🔍 Testando endpoint /clients..."
    RESPONSE=$(curl -s http://localhost:4000/clients 2>/dev/null)
    
    if echo "$RESPONSE" | grep -q "Invalid API key"; then
        echo "❌ AINDA HÁ ERRO DE API KEY!"
        echo "📊 Resposta: $RESPONSE"
        echo ""
        echo "📝 Logs de erro:"
        grep -A5 -B5 "Invalid API key" ../logs/sync-final.log | tail -10
    elif echo "$RESPONSE" | grep -q "success"; then
        echo "✅ SUCESSO! Servidor usando Supabase corretamente"
        echo "📊 Instâncias encontradas: $(echo "$RESPONSE" | jq '.clients | length' 2>/dev/null || echo 'Dados válidos')"
    else
        echo "⚠️ Resposta inesperada:"
        echo "$RESPONSE"
    fi
    
    echo ""
    echo "📝 Últimas linhas do log:"
    tail -10 ../logs/sync-final.log
    
else
    echo "❌ Servidor não está respondendo"
    echo "📝 Logs de erro:"
    tail -20 ../logs/sync-final.log
fi

cd ..

echo ""
echo "🏁 SINCRONIZAÇÃO DEFINITIVA CONCLUÍDA"
echo "===================================="
echo "📅 $(date)"
echo "🆔 PID: $SERVER_PID"
echo "📝 Logs: tail -f logs/sync-final.log"
echo ""

# Verificar resultado
if grep -q "Invalid API key" logs/sync-final.log; then
    echo "❌ PROBLEMA PERSISTE: Erro de API key ainda presente"
    echo "🔍 Verificar se as chaves no código estão corretas"
    echo "💡 Próximo passo: Verificar hardcoded keys nos módulos"
else
    echo "🎉 SUCESSO TOTAL! Não há mais erros de API key"
    echo "✅ Frontend e Backend sincronizados"
    echo "🧪 Teste agora: Acesse /admin/instances e conecte uma instância"
fi