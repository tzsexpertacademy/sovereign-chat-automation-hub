#!/bin/bash

# verify-server-startup.sh - Verificar se o servidor modular está funcionando

echo "🔍 VERIFICAÇÃO DO SERVIDOR MODULAR"
echo "=================================="

cd /home/ubuntu/sovereign-chat-automation-hub

echo "1️⃣ VERIFICANDO ARQUIVOS DO SERVIDOR"
echo "===================================="

echo "🔍 Arquivo principal:"
ls -la server/whatsapp-multi-client-server.js

echo ""
echo "🔍 Arquivo modular:"
ls -la server/whatsapp-multi-client-server-modular.js

echo ""
echo "🔍 Módulos:"
ls -la server/modules/

echo ""
echo "2️⃣ VERIFICANDO PROCESSO ATIVO"
echo "=============================="

echo "🔍 Processos Node.js:"
ps aux | grep node | grep -v grep

echo ""
echo "🔍 Porta 3001:"
netstat -tlnp | grep 3001 || ss -tlnp | grep 3001

echo ""
echo "3️⃣ VERIFICANDO LOGS DO SERVIDOR"
echo "==============================="

echo "🔍 Últimas 20 linhas do log:"
if [ -f "server.log" ]; then
    tail -20 server.log
else
    echo "   ❌ Arquivo server.log não encontrado"
fi

echo ""
echo "4️⃣ TESTANDO CONEXÃO LOCAL"
echo "========================="

echo "🔍 Health check local:"
curl -s -m 5 "http://localhost:3001/health" 2>/dev/null || echo "   ❌ Falha ao conectar localmente"

echo ""
echo "5️⃣ VERIFICANDO NGINX"
echo "==================="

echo "🔍 Status do Nginx:"
systemctl status nginx --no-pager -l

echo ""
echo "🔍 Configuração do Nginx:"
cat /etc/nginx/sites-enabled/default | grep -A 10 -B 5 "location"

echo ""
echo "✅ VERIFICAÇÃO COMPLETA"
echo "======================"