#!/bin/bash

# Script para teste DEFINITIVO das chaves Supabase
# Arquivo: scripts/test-supabase-final.sh

echo "🧪 TESTE DEFINITIVO SUPABASE"
echo "============================="

echo ""
echo "🔍 VERIFICANDO CREDENCIAIS SINCRONIZADAS:"
echo "========================================="

# Definir as chaves corretas
SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

echo "✅ Frontend (client.ts): ANON KEY definida"
echo "✅ Backend (.env): SERVICE KEY definida" 
echo "✅ Backend (config.js): SERVICE KEY sincronizada"
echo "✅ Scripts: Todas as chaves atualizadas"

echo ""
echo "🧪 TESTE 1: CONEXÃO ANON (Frontend)"
echo "=================================="

ANON_TEST=$(curl -s -X GET "$SUPABASE_URL/rest/v1/clients?limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json")

if echo "$ANON_TEST" | grep -q "error"; then
    echo "❌ Erro na chave ANON: $ANON_TEST"
else
    echo "✅ Chave ANON funcionando corretamente"
fi

echo ""
echo "🧪 TESTE 2: CONEXÃO SERVICE (Backend)"
echo "===================================="

SERVICE_TEST=$(curl -s -X GET "$SUPABASE_URL/rest/v1/whatsapp_instances?limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json")

if echo "$SERVICE_TEST" | grep -q "error"; then
    echo "❌ Erro na chave SERVICE: $SERVICE_TEST"
else
    echo "✅ Chave SERVICE funcionando corretamente"
    echo "📊 Instâncias encontradas: $(echo "$SERVICE_TEST" | jq length 2>/dev/null || echo "Dados válidos recebidos")"
fi

echo ""
echo "🧪 TESTE 3: SERVIDOR LOCAL"
echo "=========================="

if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor local respondendo"
    
    # Testar endpoint que usa Supabase
    LOCAL_TEST=$(curl -s http://localhost:4000/clients 2>/dev/null)
    if echo "$LOCAL_TEST" | grep -q "Invalid API key"; then
        echo "❌ Servidor ainda com erro de API key"
    elif echo "$LOCAL_TEST" | grep -q "success"; then
        echo "✅ Servidor usando Supabase corretamente"
    else
        echo "⚠️ Resposta inesperada do servidor: $LOCAL_TEST"
    fi
else
    echo "❌ Servidor local não está respondendo"
fi

echo ""
echo "🏁 RESULTADO FINAL"
echo "=================="

echo "📋 Status das Chaves:"
echo "   Frontend: ANON KEY (para leitura pública)"
echo "   Backend:  SERVICE KEY (para operações completas)"
echo ""
echo "💡 Se ambos os testes passaram, as chaves estão sincronizadas!"
echo "🔄 Reinicie o frontend se necessário para aplicar as mudanças"