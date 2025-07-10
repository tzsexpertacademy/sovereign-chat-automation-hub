#!/bin/bash

# Script para FORÇAR o carregamento correto das variáveis
# Arquivo: scripts/force-env-fix.sh

echo "🔧 FORÇANDO CORREÇÃO DO CARREGAMENTO .env"
echo "========================================="

echo ""
echo "🛑 PARANDO SERVIDOR ATUAL"
echo "========================"

# Parar servidor
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    echo "🔍 Matando processo: $PID"
    kill -9 "$PID" 2>/dev/null
    sleep 2
fi

echo ""
echo "🔧 MÉTODO 1: VERIFICAR E CORRIGIR .env"
echo "====================================="

cd server || exit 1

echo "📋 Conteúdo atual do .env:"
cat .env

echo ""
echo "🔍 Verificando se dotenv está instalado..."
if npm list dotenv > /dev/null 2>&1; then
    echo "✅ dotenv está instalado"
else
    echo "❌ dotenv NÃO está instalado - instalando..."
    npm install dotenv
fi

echo ""
echo "🔧 MÉTODO 2: EXPORT DIRETO NO SISTEMA"
echo "====================================="

# Exportar variáveis diretamente no sistema
export PORT=4000
export SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"
export DEBUG=true
export LOG_LEVEL=debug

echo "✅ Variáveis exportadas para o sistema"
echo "📋 Verificando:"
echo "   PORT: $PORT"
echo "   SUPABASE_URL: $SUPABASE_URL"
echo "   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:0:20}..."

echo ""
echo "🔧 MÉTODO 3: ATUALIZAR HARDCODED FALLBACK"
echo "========================================="

# Atualizar o config.js para usar a chave correta como fallback
echo "🔄 Atualizando fallback no config.js..."

# Backup do config original
cp modules/config.js modules/config.js.backup

# Substituir a chave hardcoded no config.js
sed -i 's/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ\.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY/g' modules/config.js

echo "✅ Fallback atualizado"

echo ""
echo "🚀 TESTANDO COM EXPORT DIRETO"
echo "============================="

# Criar arquivo de teste simples
cat > test-final.js << 'EOF'
// Teste definitivo com export direto
console.log('🧪 TESTE COM EXPORT DIRETO');
console.log('===========================');

console.log('Variáveis do processo:');
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.substring(0, 20) + '...' : 'UNDEFINED');

// Testar config
try {
    const config = require('./modules/config.js');
    console.log('✅ Config carregado');
    
    // Testar database
    const db = require('./modules/database.js');
    console.log('✅ Database inicializado');
    
    setTimeout(() => {
        console.log('🏁 Teste concluído');
        process.exit(0);
    }, 3000);
    
} catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
}
EOF

echo "🧪 Executando teste final..."
node test-final.js

echo ""
echo "🧹 Limpando..."
rm test-final.js

echo ""
echo "🚀 INICIANDO SERVIDOR COM EXPORT FORÇADO"
echo "========================================"

# Iniciar servidor com as variáveis já exportadas
nohup node whatsapp-multi-client-server.js > ../logs/force-fix.log 2>&1 &
NEW_PID=$!

echo "🆔 Novo PID: $NEW_PID"
echo "$NEW_PID" > ../logs/whatsapp-server.pid

# Aguardar
echo "⏳ Aguardando inicialização (10s)..."
sleep 10

echo ""
echo "📝 LOGS DE INICIALIZAÇÃO:"
echo "========================"
tail -15 ../logs/force-fix.log

echo ""
echo "🧪 TESTE FINAL"
echo "============="

if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor respondendo"
    
    RESPONSE=$(curl -s http://localhost:4000/clients 2>/dev/null)
    if echo "$RESPONSE" | grep -q "Invalid API key"; then
        echo "❌ AINDA com erro de API key"
        echo "📊 Resposta: $RESPONSE"
    elif echo "$RESPONSE" | grep -q "success"; then
        echo "🎉 SUCESSO! API key funcionando!"
        echo "📊 Resposta: $RESPONSE"
    else
        echo "⚠️ Resposta inesperada: $RESPONSE"
    fi
else
    echo "❌ Servidor não responde"
fi

cd ..

echo ""
echo "🏁 FORÇA CORREÇÃO CONCLUÍDA"
echo "=========================="
echo "📅 $(date)"
echo "🆔 PID: $NEW_PID"
echo "📝 Logs: tail -f logs/force-fix.log"