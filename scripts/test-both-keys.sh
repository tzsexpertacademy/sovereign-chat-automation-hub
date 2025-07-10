#!/bin/bash

# TESTE DEFINITIVO: Qual chave realmente funciona?
echo "🔍 TESTE DEFINITIVO: QUAL CHAVE FUNCIONA?"
echo "========================================"

echo ""
echo "🧪 TESTANDO AMBAS AS CHAVES SEPARADAMENTE"
echo "========================================"

# As duas chaves do sistema
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

echo "🔑 Chaves a serem testadas:"
echo "   ANON:    ${ANON_KEY:0:20}..."
echo "   SERVICE: ${SERVICE_KEY:0:20}..."

echo ""
echo "🧪 TESTE 1: CHAVE ANON"
echo "====================="

ANON_RESULT=$(curl -s -X GET "https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/whatsapp_instances?limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json")

echo "📊 Resultado com ANON key:"
echo "$ANON_RESULT"

if echo "$ANON_RESULT" | grep -q "Invalid API key"; then
    echo "❌ CHAVE ANON: INVÁLIDA"
elif echo "$ANON_RESULT" | grep -q "\["; then
    echo "✅ CHAVE ANON: FUNCIONANDO!"
    WORKING_KEY="$ANON_KEY"
    KEY_TYPE="anon"
else
    echo "⚠️ CHAVE ANON: Resposta inesperada"
fi

echo ""
echo "🧪 TESTE 2: CHAVE SERVICE_ROLE"
echo "============================="

SERVICE_RESULT=$(curl -s -X GET "https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/whatsapp_instances?limit=1" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json")

echo "📊 Resultado com SERVICE key:"
echo "$SERVICE_RESULT"

if echo "$SERVICE_RESULT" | grep -q "Invalid API key"; then
    echo "❌ CHAVE SERVICE: INVÁLIDA"
elif echo "$SERVICE_RESULT" | grep -q "\["; then
    echo "✅ CHAVE SERVICE: FUNCIONANDO!"
    WORKING_KEY="$SERVICE_KEY"
    KEY_TYPE="service_role"
else
    echo "⚠️ CHAVE SERVICE: Resposta inesperada"
fi

echo ""
echo "🎯 ANÁLISE FINAL"
echo "==============="

if [ -n "$WORKING_KEY" ]; then
    echo "🎉 CHAVE FUNCIONANTE ENCONTRADA: $KEY_TYPE"
    echo "🔑 Chave: ${WORKING_KEY:0:20}..."
    
    echo ""
    echo "🚀 TESTANDO NODE.JS COM A CHAVE FUNCIONANTE"
    echo "=========================================="
    
    cd server || exit 1
    
    # Parar servidor atual
    PID=$(lsof -t -i:4000) 2>/dev/null
    if [ -n "$PID" ]; then
        kill -9 "$PID" 2>/dev/null
        sleep 2
    fi
    
    # Configurar variáveis com a chave funcionante
    if [ "$KEY_TYPE" = "anon" ]; then
        echo "⚠️ ATENÇÃO: Usando chave ANON no backend"
        echo "   Isso pode limitar algumas operações"
        export SUPABASE_SERVICE_KEY="$WORKING_KEY"
    else
        echo "✅ Usando chave SERVICE_ROLE correta"
        export SUPABASE_SERVICE_KEY="$WORKING_KEY"
    fi
    
    export SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
    
    # Atualizar .env com a chave funcionante
    sed -i "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$WORKING_KEY|g" .env
    
    # Teste rápido do Node.js
    cat > quick-test.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('🧪 TESTE COM CHAVE FUNCIONANTE NO NODE.JS');
console.log('=========================================');
console.log('URL:', SUPABASE_URL);
console.log('KEY:', SUPABASE_KEY.substring(0, 20) + '...');

(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase.from('whatsapp_instances').select('id').limit(1);
    
    if (error) {
      console.log('❌ AINDA FALHA:', error.message);
    } else {
      console.log('🎉 SUCESSO NO NODE.JS!');
      console.log('📊 Dados:', data);
    }
  } catch (err) {
    console.log('💥 Erro:', err.message);
  }
  process.exit(0);
})();
EOF
    
    echo "🧪 Testando Node.js com chave funcionante..."
    node quick-test.js
    
    echo ""
    echo "🚀 INICIANDO SERVIDOR COM CHAVE FUNCIONANTE"
    echo "=========================================="
    
    # Iniciar servidor
    nohup node whatsapp-multi-client-server.js > ../logs/working-final.log 2>&1 &
    NEW_PID=$!
    
    echo "🆔 PID: $NEW_PID"
    echo "$NEW_PID" > ../logs/whatsapp-server.pid
    
    echo "⏳ Aguardando (8s)..."
    sleep 8
    
    echo ""
    echo "🧪 TESTE FINAL DO SERVIDOR"
    echo "========================="
    
    if curl -s http://localhost:4000/health > /dev/null; then
        echo "✅ Servidor UP"
        
        RESPONSE=$(curl -s http://localhost:4000/clients 2>/dev/null)
        if echo "$RESPONSE" | grep -q "Invalid API key"; then
            echo "💀 Ainda com erro"
            echo "📊 Resposta: $RESPONSE"
        elif echo "$RESPONSE" | grep -q "success"; then
            echo "🎉🎉🎉 FUNCIONOU CARALHO! 🎉🎉🎉"
            echo "📊 Resposta: $RESPONSE"
        else
            echo "⚠️ Resposta: $RESPONSE"
        fi
    else
        echo "❌ Servidor não responde"
    fi
    
    # Limpar
    rm quick-test.js
    cd ..
    
else
    echo "💀 NENHUMA CHAVE FUNCIONA!"
    echo "🔍 Problema: As chaves podem estar expiradas ou incorretas"
    echo "💡 Solução: Verificar as chaves no painel do Supabase"
    echo ""
    echo "🔗 Acesse: https://supabase.com/dashboard/project/ymygyagbvbsdfkduxmgu/settings/api"
    echo "   E copie as chaves atuais"
fi

echo ""
echo "🏁 TESTE DEFINITIVO CONCLUÍDO"
echo "============================"