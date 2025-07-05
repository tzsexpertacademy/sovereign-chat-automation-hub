#!/bin/bash

echo "🔍 DIAGNÓSTICO CONEXÃO SUPABASE"
echo "==============================="

SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"

echo ""
echo "1️⃣ TESTE DE CONECTIVIDADE BÁSICA"
echo "================================"

echo "🌐 Testando conexão com Supabase..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Conectividade básica OK (HTTP $HTTP_STATUS)"
else
    echo "❌ Problema de conectividade (HTTP $HTTP_STATUS)"
fi

echo ""
echo "2️⃣ TESTE DE AUTENTICAÇÃO"
echo "========================"

echo "🔑 Testando autenticação com chave anon..."
AUTH_TEST=$(curl -s "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")

if echo "$AUTH_TEST" | grep -q "message.*Invalid"; then
    echo "❌ Chave API inválida ou expirada"
    echo "   Resposta: $AUTH_TEST"
else
    echo "✅ Autenticação bem-sucedida"
fi

echo ""
echo "3️⃣ TESTE DE ACESSO ÀS TABELAS"
echo "============================="

echo "📊 Testando acesso à tabela whatsapp_instances..."
INSTANCES_TEST=$(curl -s "$SUPABASE_URL/rest/v1/whatsapp_instances?select=id,instance_id,status&limit=3" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")

if echo "$INSTANCES_TEST" | grep -q "message.*Invalid"; then
    echo "❌ Erro no acesso à tabela whatsapp_instances"
    echo "   Resposta: $INSTANCES_TEST"
elif echo "$INSTANCES_TEST" | grep -q "relation.*does not exist"; then
    echo "❌ Tabela whatsapp_instances não existe"
    echo "   Resposta: $INSTANCES_TEST"
elif echo "$INSTANCES_TEST" | grep -q "\["; then
    INSTANCES_COUNT=$(echo "$INSTANCES_TEST" | jq length 2>/dev/null || echo "erro_json")
    if [ "$INSTANCES_COUNT" != "erro_json" ]; then
        echo "✅ Acesso à tabela bem-sucedido ($INSTANCES_COUNT registros)"
        echo "   Dados: $INSTANCES_TEST"
    else
        echo "⚠️ Resposta não é JSON válido"
        echo "   Resposta: $INSTANCES_TEST"
    fi
else
    echo "⚠️ Resposta inesperada"
    echo "   Resposta: $INSTANCES_TEST"
fi

echo ""
echo "4️⃣ TESTE DE INSERÇÃO"
echo "===================="

TEST_INSTANCE_ID="test_diagnostic_$(date +%s)"
echo "🧪 Testando inserção com instance_id: $TEST_INSTANCE_ID"

INSERT_TEST=$(curl -s -X POST "$SUPABASE_URL/rest/v1/whatsapp_instances" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"instance_id\": \"$TEST_INSTANCE_ID\",
    \"status\": \"test\",
    \"client_id\": \"206a06f2-5536-4be8-a653-cb5e997d1d0e\"
  }")

if echo "$INSERT_TEST" | grep -q "message.*Invalid"; then
    echo "❌ Erro na inserção"
    echo "   Resposta: $INSERT_TEST"
elif echo "$INSERT_TEST" | grep -q "$TEST_INSTANCE_ID"; then
    echo "✅ Inserção bem-sucedida"
    
    # Limpar registro de teste
    DELETE_TEST=$(curl -s -X DELETE "$SUPABASE_URL/rest/v1/whatsapp_instances?instance_id=eq.$TEST_INSTANCE_ID" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY")
    echo "🧹 Registro de teste removido"
else
    echo "⚠️ Resposta inesperada na inserção"
    echo "   Resposta: $INSERT_TEST"
fi

echo ""
echo "5️⃣ TESTE DE ATUALIZAÇÃO"
echo "======================="

# Buscar primeira instância para testar update
FIRST_INSTANCE=$(curl -s "$SUPABASE_URL/rest/v1/whatsapp_instances?select=id,instance_id&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY")

if echo "$FIRST_INSTANCE" | grep -q "instance_id"; then
    INSTANCE_ID=$(echo "$FIRST_INSTANCE" | jq -r '.[0].instance_id' 2>/dev/null)
    
    if [ "$INSTANCE_ID" != "null" ] && [ ! -z "$INSTANCE_ID" ]; then
        echo "🧪 Testando atualização na instância: $INSTANCE_ID"
        
        UPDATE_TEST=$(curl -s -X PATCH "$SUPABASE_URL/rest/v1/whatsapp_instances?instance_id=eq.$INSTANCE_ID" \
          -H "apikey: $SUPABASE_ANON_KEY" \
          -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
          -H "Content-Type: application/json" \
          -d "{\"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}")
        
        if [ -z "$UPDATE_TEST" ] || [ "$UPDATE_TEST" = "" ]; then
            echo "✅ Atualização bem-sucedida (resposta vazia é normal)"
        else
            echo "⚠️ Resposta na atualização: $UPDATE_TEST"
        fi
    else
        echo "⚠️ Não foi possível extrair instance_id para teste"
    fi
else
    echo "⚠️ Nenhuma instância encontrada para teste de atualização"
fi

echo ""
echo "6️⃣ VERIFICAÇÃO NO CÓDIGO DO SERVIDOR"
echo "===================================="

cd /home/ubuntu/sovereign-chat-automation-hub/server

echo "🔍 Verificando configuração do Supabase no servidor..."
if grep -q "supabaseUrl.*ymygyagbvbsdfkduxmgu" whatsapp-multi-client-server.js; then
    echo "✅ URL do Supabase configurada corretamente"
else
    echo "❌ URL do Supabase não encontrada ou incorreta"
fi

if grep -q "supabaseKey.*eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ" whatsapp-multi-client-server.js; then
    echo "✅ Chave do Supabase configurada"
else
    echo "❌ Chave do Supabase não encontrada"
fi

echo ""
echo "7️⃣ TESTE DE FUNÇÃO updateInstanceStatus"
echo "======================================"

echo "🧪 Testando função updateInstanceStatus do servidor..."
if grep -q "updateInstanceStatus" whatsapp-multi-client-server.js; then
    echo "✅ Função updateInstanceStatus encontrada no código"
    
    # Mostrar configuração atual
    echo "📋 Configuração atual:"
    grep -A 5 -B 2 "updateInstanceStatus.*async" whatsapp-multi-client-server.js | head -10
else
    echo "❌ Função updateInstanceStatus não encontrada"
fi

echo ""
echo "8️⃣ RESULTADOS E RECOMENDAÇÕES"
echo "============================="

echo "📊 Resumo dos testes:"
echo "   Conectividade: $([ "$HTTP_STATUS" = "200" ] && echo "✅ OK" || echo "❌ FALHA")"
echo "   Autenticação: $(echo "$AUTH_TEST" | grep -q "Invalid" && echo "❌ FALHA" || echo "✅ OK")"
echo "   Acesso tabelas: $(echo "$INSTANCES_TEST" | grep -q "\[" && echo "✅ OK" || echo "❌ FALHA")"

if [ "$HTTP_STATUS" != "200" ] || echo "$AUTH_TEST" | grep -q "Invalid"; then
    echo ""
    echo "❌ PROBLEMAS IDENTIFICADOS:"
    echo "💡 SOLUÇÕES:"
    echo "   1. Verificar se a chave API não expirou"
    echo "   2. Verificar RLS (Row Level Security) nas tabelas"
    echo "   3. Verificar permissões da role 'anon'"
    echo "   4. Testar com service_role_key se necessário"
else
    echo ""
    echo "✅ SUPABASE FUNCIONANDO CORRETAMENTE"
fi

echo ""
echo "✅ Diagnóstico Supabase concluído!"