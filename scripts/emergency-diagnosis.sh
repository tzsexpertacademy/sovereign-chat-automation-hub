#!/bin/bash

# Script de diagnóstico emergencial em tempo real
# Arquivo: scripts/emergency-diagnosis.sh

echo "🚨 DIAGNÓSTICO EMERGENCIAL - SERVIDOR WHATSAPP"
echo "=============================================="

echo "🔍 1. VERIFICANDO SE O SERVIDOR REINICIOU DE VERDADE"
echo "=================================================="

# Verificar se processo está rodando
PID=$(lsof -t -i:4000 2>/dev/null)
if [ -n "$PID" ]; then
    echo "✅ Servidor rodando (PID: $PID)"
    
    # Verificar há quanto tempo está rodando
    START_TIME=$(ps -o lstart= -p "$PID" 2>/dev/null)
    echo "⏰ Iniciado em: $START_TIME"
    
    # Verificar se é um processo novo (menos de 10 minutos)
    UPTIME_SECONDS=$(ps -o etimes= -p "$PID" 2>/dev/null | xargs)
    if [ "$UPTIME_SECONDS" -lt 600 ]; then
        echo "✅ Processo é NOVO (${UPTIME_SECONDS}s) - provavelmente reiniciou"
    else
        echo "⚠️ Processo é ANTIGO (${UPTIME_SECONDS}s) - pode não ter reiniciado"
    fi
else
    echo "❌ NENHUM servidor rodando na porta 4000!"
    exit 1
fi

echo ""
echo "🔍 2. TESTANDO CREDENCIAIS SUPABASE EM TEMPO REAL"
echo "=============================================="

# Testar endpoint de health
echo "🧪 Testando /health..."
HEALTH_RESPONSE=$(curl -s http://localhost:4000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Health check OK: $HEALTH_RESPONSE"
else
    echo "❌ Health check FALHOU"
fi

# Fazer uma requisição de teste que force uso do Supabase
echo ""
echo "🧪 Testando endpoint que usa Supabase..."
TEST_RESPONSE=$(curl -s -w "STATUS:%{http_code}" http://localhost:4000/clients 2>/dev/null)
HTTP_STATUS=$(echo "$TEST_RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$TEST_RESPONSE" | sed 's/STATUS:[0-9]*$//')

echo "📡 Status HTTP: $HTTP_STATUS"
echo "📄 Resposta: $RESPONSE_BODY"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Supabase funcionando!"
elif [ "$HTTP_STATUS" = "500" ]; then
    echo "❌ ERRO 500 - Supabase com problema!"
    if echo "$RESPONSE_BODY" | grep -q "Invalid API key"; then
        echo "💥 CONFIRMADO: Ainda erro de API key!"
    fi
else
    echo "⚠️ Status inesperado: $HTTP_STATUS"
fi

echo ""
echo "🔍 3. VERIFICANDO ARQUIVO .ENV ATUAL"
echo "=================================="
echo "📄 Conteúdo do .env:"
cat server/.env | grep -v "^#" | grep -v "^$"

echo ""
echo "🔍 4. TESTANDO CONEXÃO DE INSTÂNCIA EM TEMPO REAL"
echo "=============================================="

# Criar uma instância de teste
TEST_INSTANCE_ID="test-emergency-$(date +%s)"
echo "🧪 Criando instância de teste: $TEST_INSTANCE_ID"

CONNECT_RESPONSE=$(curl -s -w "STATUS:%{http_code}" \
    -X POST http://localhost:4000/clients/$TEST_INSTANCE_ID/connect \
    -H "Content-Type: application/json" 2>/dev/null)

CONNECT_STATUS=$(echo "$CONNECT_RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
CONNECT_BODY=$(echo "$CONNECT_RESPONSE" | sed 's/STATUS:[0-9]*$//')

echo "📡 Status da conexão: $CONNECT_STATUS"
echo "📄 Resposta da conexão: $CONNECT_BODY"

if [ "$CONNECT_STATUS" = "200" ]; then
    echo "🎉 CONEXÃO FUNCIONOU!"
elif [ "$CONNECT_STATUS" = "500" ]; then
    echo "💥 ERRO 500 CONFIRMADO!"
    
    # Analisar o erro
    if echo "$CONNECT_BODY" | grep -q "Invalid API key"; then
        echo "🔍 ERRO: Credenciais Supabase ainda incorretas"
    elif echo "$CONNECT_BODY" | grep -q "Puppeteer"; then
        echo "🔍 ERRO: Problema com Puppeteer"
    elif echo "$CONNECT_BODY" | grep -q "Chrome"; then
        echo "🔍 ERRO: Problema com Chrome"
    else
        echo "🔍 ERRO DESCONHECIDO:"
        echo "$CONNECT_BODY" | head -5
    fi
fi

echo ""
echo "🔍 5. LOGS DO SERVIDOR EM TEMPO REAL"
echo "================================="
echo "📝 Últimas 10 linhas do log:"
tail -10 logs/whatsapp-multi-client.log 2>/dev/null || echo "Log não encontrado"

echo ""
echo "🎯 RESUMO DO DIAGNÓSTICO"
echo "======================="
if [ "$HTTP_STATUS" = "200" ] && [ "$CONNECT_STATUS" = "200" ]; then
    echo "✅ TUDO FUNCIONANDO - erro pode ser no frontend"
elif [ "$HTTP_STATUS" = "500" ] || [ "$CONNECT_STATUS" = "500" ]; then
    echo "❌ SERVIDOR COM PROBLEMA - erro 500 confirmado"
    echo "💡 Próximo passo: Verificar logs detalhados"
else
    echo "⚠️ SITUAÇÃO AMBÍGUA - mais investigação necessária"
fi

echo ""
echo "📅 Diagnóstico realizado em: $(date)"