#!/bin/bash

# Script para diagnosticar conflitos de porta do WhatsApp Multi-Cliente
# Execute: ./scripts/diagnose-port-conflicts.sh

echo "🔍 DIAGNÓSTICO DE CONFLITOS DE PORTA 4000"
echo "========================================"

# Verificar se porta 4000 está em uso
echo "📡 1. Verificando uso da porta 4000..."
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 ESTÁ EM USO:"
    echo ""
    lsof -Pi :4000 -sTCP:LISTEN 2>/dev/null
    echo ""
    
    # Mostrar todos os processos usando a porta
    echo "📋 Processos específicos na porta 4000:"
    PIDS=$(lsof -Pi :4000 -sTCP:LISTEN -t 2>/dev/null)
    for pid in $PIDS; do
        echo "  PID: $pid"
        ps -p $pid -o pid,ppid,command --no-headers 2>/dev/null || echo "    Processo não encontrado"
        echo "    Usuário: $(ps -p $pid -o user --no-headers 2>/dev/null)"
        echo "    Tempo de vida: $(ps -p $pid -o etime --no-headers 2>/dev/null)"
        echo ""
    done
else
    echo "✅ Porta 4000 está LIVRE"
fi

# Verificar PM2
echo "🔧 2. Verificando PM2..."
if command -v pm2 >/dev/null 2>&1; then
    echo "✅ PM2 encontrado: $(which pm2)"
    echo "📋 Processos PM2 ativos:"
    pm2 jlist 2>/dev/null | jq -r '.[] | "Nome: \(.name), Status: \(.pm2_env.status), PID: \(.pid)"' 2>/dev/null || pm2 list
else
    echo "❌ PM2 NÃO ENCONTRADO no PATH"
    echo "🔍 Procurando PM2 em locais comuns..."
    
    # Verificar locais comuns do PM2
    PM2_LOCATIONS=(
        "/usr/bin/pm2"
        "/usr/local/bin/pm2"
        "/home/ubuntu/.nvm/versions/node/*/bin/pm2"
        "/root/.nvm/versions/node/*/bin/pm2"
    )
    
    for location in "${PM2_LOCATIONS[@]}"; do
        if ls $location >/dev/null 2>&1; then
            echo "  Encontrado: $location"
        fi
    done
fi

# Verificar processos WhatsApp
echo "🔍 3. Verificando processos WhatsApp..."
WHATSAPP_PROCESSES=$(ps aux | grep -E "(whatsapp|node.*server)" | grep -v grep)
if [ -n "$WHATSAPP_PROCESSES" ]; then
    echo "📋 Processos WhatsApp encontrados:"
    echo "$WHATSAPP_PROCESSES"
else
    echo "✅ Nenhum processo WhatsApp encontrado"
fi

# Verificar Node.js
echo "🔍 4. Verificando Node.js..."
echo "Usuário atual: $(whoami)"
echo "Node.js: $(which node 2>/dev/null || echo 'NÃO ENCONTRADO')"
echo "Versão Node.js: $(node --version 2>/dev/null || echo 'N/A')"
echo "npm: $(which npm 2>/dev/null || echo 'NÃO ENCONTRADO')"

# Verificar arquivo PID
echo "🔍 5. Verificando arquivo PID..."
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    echo "📄 Arquivo PID encontrado: $PID"
    
    if ps -p $PID >/dev/null 2>&1; then
        echo "✅ Processo PID $PID está ATIVO"
        ps -p $PID -o pid,ppid,command --no-headers
    else
        echo "❌ Processo PID $PID NÃO está rodando"
        echo "🧹 Removendo arquivo PID obsoleto..."
        rm -f logs/whatsapp-server.pid
    fi
else
    echo "❌ Arquivo PID não encontrado"
fi

# Verificar logs recentes
echo "🔍 6. Verificando logs recentes..."
if [ -f "logs/whatsapp-multi-client.log" ]; then
    echo "📝 Últimas 5 linhas do log principal:"
    tail -5 logs/whatsapp-multi-client.log 2>/dev/null || echo "Erro ao ler log"
fi

if [ -f "logs/whatsapp-error.log" ]; then
    echo "📝 Últimas 3 linhas do log de erro:"
    tail -3 logs/whatsapp-error.log 2>/dev/null || echo "Erro ao ler log de erro"
fi

echo ""
echo "🎯 RESUMO DO DIAGNÓSTICO:"
echo "========================"

# Resumir problemas encontrados
PROBLEMS=0

if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PROCESS_COUNT=$(lsof -Pi :4000 -sTCP:LISTEN -t 2>/dev/null | wc -l)
    if [ "$PROCESS_COUNT" -gt 1 ]; then
        echo "❌ PROBLEMA: $PROCESS_COUNT processos usando porta 4000 (conflito!)"
        PROBLEMS=$((PROBLEMS + 1))
    else
        echo "⚠️ ATENÇÃO: 1 processo usando porta 4000 (pode estar OK)"
    fi
else
    echo "✅ Porta 4000 livre"
fi

if ! command -v pm2 >/dev/null 2>&1; then
    echo "⚠️ ATENÇÃO: PM2 não encontrado no PATH"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [ "$PROBLEMS" -eq 0 ]; then
    echo "✅ Nenhum problema crítico detectado"
else
    echo "⚠️ $PROBLEMS problema(s) detectado(s) - requer correção"
fi

echo ""
echo "📅 Diagnóstico concluído em: $(date)"