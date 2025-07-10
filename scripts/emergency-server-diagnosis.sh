#!/bin/bash

# emergency-server-diagnosis.sh - Diagnóstico de emergência do servidor

echo "🚨 DIAGNÓSTICO DE EMERGÊNCIA DO SERVIDOR"
echo "========================================"

cd /home/ubuntu/sovereign-chat-automation-hub

echo "1️⃣ VERIFICANDO PROCESSO DO SERVIDOR"
echo "===================================="

echo "🔍 Processos Node.js ativos:"
ps aux | grep node | grep -v grep

echo ""
echo "🔍 Portas abertas:"
netstat -tlnp | grep 3001 || ss -tlnp | grep 3001

echo ""
echo "🔍 Verificando se a porta 3001 está realmente aberta:"
lsof -i :3001 || echo "   ❌ Porta 3001 não está sendo usada"

echo ""
echo "2️⃣ VERIFICANDO LOGS DO SERVIDOR"
echo "==============================="

echo "🔍 Últimas 30 linhas do server.log:"
if [ -f "server.log" ]; then
    tail -30 server.log
else
    echo "   ❌ Arquivo server.log não encontrado"
fi

echo ""
echo "3️⃣ TESTANDO CONECTIVIDADE LOCAL"
echo "==============================="

echo "🔍 Testando localhost:3001 com timeout de 5s:"
timeout 5 telnet localhost 3001 </dev/null 2>&1 || echo "   ❌ Não consegue conectar na porta 3001"

echo ""
echo "🔍 Testando se algo está rodando em 3001:"
curl -s -m 5 http://localhost:3001 2>&1 | head -5 || echo "   ❌ Nada respondendo na porta 3001"

echo ""
echo "4️⃣ VERIFICANDO ARQUIVOS DO SERVIDOR"
echo "==================================="

echo "🔍 Arquivo principal existe?"
ls -la server/whatsapp-multi-client-server.js

echo ""
echo "🔍 Módulos existem?"
ls -la server/modules/

echo ""
echo "🔍 package.json do servidor:"
if [ -f "server/package.json" ]; then
    echo "   ✅ package.json existe"
else
    echo "   ❌ package.json não encontrado"
fi

echo ""
echo "5️⃣ TESTANDO INICIALIZAÇÃO MANUAL"
echo "================================"

echo "🚀 Tentando iniciar servidor manualmente com timeout..."
cd server
timeout 10 node whatsapp-multi-client-server.js &
MANUAL_PID=$!

sleep 5

echo "🔍 Verificando se iniciou..."
if ps -p $MANUAL_PID > /dev/null; then
    echo "   ✅ Servidor manual iniciou (PID: $MANUAL_PID)"
    
    echo "🔍 Testando health check manual..."
    curl -s -m 3 http://localhost:3001/health || echo "   ❌ Health check falhou"
    
    echo "🔪 Matando processo manual..."
    kill $MANUAL_PID 2>/dev/null
else
    echo "   ❌ Servidor manual não iniciou ou travou"
fi

cd ..

echo ""
echo "6️⃣ VERIFICANDO DEPENDÊNCIAS"
echo "==========================="

echo "🔍 Node.js versão:"
node --version

echo ""
echo "🔍 NPM versão:"
npm --version

echo ""
echo "🔍 Verificando se node_modules existe no servidor:"
if [ -d "server/node_modules" ]; then
    echo "   ✅ node_modules existe"
    echo "   📦 Principais dependências:"
    ls server/node_modules/ | grep -E "(express|socket|cors)" | head -5
else
    echo "   ❌ node_modules não encontrado - DEPENDÊNCIAS NÃO INSTALADAS!"
fi

echo ""
echo "7️⃣ DIAGNÓSTICO FINAL"
echo "==================="

if [ ! -d "server/node_modules" ]; then
    echo "🚨 PROBLEMA CRÍTICO: Dependências não instaladas!"
    echo "💡 SOLUÇÃO: cd server && npm install"
elif ! ps aux | grep node | grep -v grep > /dev/null; then
    echo "🚨 PROBLEMA: Nenhum processo Node.js rodando"
    echo "💡 SOLUÇÃO: Iniciar servidor manualmente"
elif ! netstat -tlnp | grep 3001 > /dev/null; then
    echo "🚨 PROBLEMA: Servidor não está escutando na porta 3001"
    echo "💡 SOLUÇÃO: Verificar logs de erro na inicialização"
else
    echo "🤔 PROBLEMA DESCONHECIDO: Servidor parece estar rodando mas não responde"
    echo "💡 SOLUÇÃO: Verificar logs detalhados e firewall"
fi

echo ""
echo "✅ DIAGNÓSTICO DE EMERGÊNCIA COMPLETO"