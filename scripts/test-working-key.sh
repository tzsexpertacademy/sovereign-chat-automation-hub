#!/bin/bash

# TESTE DEFINITIVO - Comparar chaves que funcionam vs que falham
echo "🔍 ANÁLISE DEFINITIVA DAS CHAVES SUPABASE"
echo "========================================"

echo ""
echo "🧪 TESTE 1: CHAVES QUE FUNCIONARAM NO CURL"
echo "==========================================="

# Estas chaves funcionaram no teste anterior
WORKING_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"
WORKING_SERVICE="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

echo "✅ Chave ANON que funcionou:"
echo "   ${WORKING_ANON:0:20}..."

echo "✅ Chave SERVICE que funcionou:"  
echo "   ${WORKING_SERVICE:0:20}..."

echo ""
echo "🔍 TESTE 2: CHAVE ATUAL DO SERVIDOR"
echo "=================================="

CURRENT_KEY=$(grep SUPABASE_SERVICE_KEY server/.env | cut -d'=' -f2)
echo "🔍 Chave atual no .env:"
echo "   ${CURRENT_KEY:0:20}..."

echo ""
echo "🧪 TESTE 3: COMPARAÇÃO"
echo "====================="

if [ "$CURRENT_KEY" = "$WORKING_SERVICE" ]; then
    echo "✅ Chaves são IGUAIS"
else
    echo "❌ CHAVES SÃO DIFERENTES!"
    echo "🔧 Corrigindo..."
    
    # Atualizar .env com a chave que funciona
    sed -i "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$WORKING_SERVICE|g" server/.env
    echo "✅ .env atualizado"
fi

echo ""
echo "🧪 TESTE 4: VERIFICAÇÃO FINAL CURL"
echo "================================="

echo "🔍 Testando chave que vai ser usada no servidor..."
TEST_RESULT=$(curl -s -X GET "https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/whatsapp_instances?limit=1" \
  -H "apikey: $WORKING_SERVICE" \
  -H "Authorization: Bearer $WORKING_SERVICE" \
  -H "Content-Type: application/json")

if echo "$TEST_RESULT" | grep -q "error"; then
    echo "❌ Ainda há erro: $TEST_RESULT"
else
    echo "✅ Chave SERVICE funciona no curl!"
fi

echo ""
echo "🚀 TESTE 5: NODE.JS COM CHAVE FUNCIONANTE"
echo "========================================"

cd server || exit 1

# Parar servidor atual
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    kill -9 "$PID" 2>/dev/null
    sleep 2
fi

# Forçar a chave que funciona
export SUPABASE_SERVICE_KEY="$WORKING_SERVICE"
export SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"

echo "📋 Usando chave funcionante:"
echo "   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:0:20}..."

# Criar teste simples
cat > test-working-key.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 TESTE COM CHAVE QUE FUNCIONOU NO CURL');
console.log('=========================================');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('URL:', SUPABASE_URL);
console.log('KEY:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Teste direto
(async () => {
  try {
    const { data, error } = await supabase.from('whatsapp_instances').select('id').limit(1);
    if (error) {
      console.error('❌ ERRO AINDA PERSISTE:', error);
    } else {
      console.log('🎉 SUCESSO! Chave funcionando no Node.js!');
      console.log('📊 Dados:', data);
    }
  } catch (testError) {
    console.error('💥 Erro crítico:', testError);
  }
  process.exit(0);
})();
EOF

echo "🧪 Executando teste com chave funcionante..."
node test-working-key.js

# Limpar
rm test-working-key.js

echo ""
echo "🚀 INICIANDO SERVIDOR COM CHAVE FUNCIONANTE"
echo "=========================================="

# Iniciar servidor com a chave que sabemos que funciona
nohup node whatsapp-multi-client-server.js > ../logs/working-key.log 2>&1 &
NEW_PID=$!

echo "🆔 PID: $NEW_PID"
echo "$NEW_PID" > ../logs/whatsapp-server.pid

echo "⏳ Aguardando (10s)..."
sleep 10

echo ""
echo "📝 LOGS:"
echo "======="
tail -10 ../logs/working-key.log

echo ""
echo "🧪 TESTE FINAL DO SERVIDOR"
echo "========================="

if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor UP"
    
    RESPONSE=$(curl -s http://localhost:4000/clients 2>/dev/null)
    if echo "$RESPONSE" | grep -q "Invalid API key"; then
        echo "💀 AINDA com erro - precisa investigar mais"
        echo "📊 Resposta: $RESPONSE"
    elif echo "$RESPONSE" | grep -q "success"; then
        echo "🎉🎉🎉 FUNCIONOU!!!! 🎉🎉🎉"
        echo "📊 Resposta: $RESPONSE"
    else
        echo "⚠️ Resposta: $RESPONSE"
    fi
else
    echo "❌ Servidor não responde"
fi

cd ..

echo ""
echo "🏁 TESTE COM CHAVE FUNCIONANTE CONCLUÍDO"
echo "========================================"