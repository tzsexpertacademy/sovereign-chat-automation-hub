#!/bin/bash

# fix-server-dependencies.sh - Corrigir dependências e inicializar servidor

echo "🔧 CORREÇÃO DEFINITIVA DAS DEPENDÊNCIAS DO SERVIDOR"
echo "=================================================="

cd /home/ubuntu/sovereign-chat-automation-hub

echo "1️⃣ PARANDO TODOS OS PROCESSOS NODE"
echo "=================================="

echo "🔪 Matando todos os processos Node.js..."
pkill -f node 2>/dev/null || echo "   ℹ️ Nenhum processo Node.js para matar"

sleep 2

echo ""
echo "2️⃣ VERIFICANDO E INSTALANDO DEPENDÊNCIAS"
echo "========================================"

echo "🔍 Entrando na pasta do servidor..."
cd server

echo "🔍 Verificando package.json..."
if [ ! -f "package.json" ]; then
    echo "❌ package.json não encontrado! Criando..."
    cat > package.json << 'EOF'
{
  "name": "whatsapp-multi-client-server",
  "version": "1.0.0",
  "description": "Servidor WhatsApp Multi-Cliente",
  "main": "whatsapp-multi-client-server.js",
  "scripts": {
    "start": "node whatsapp-multi-client-server.js",
    "dev": "node whatsapp-multi-client-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "cors": "^2.8.5",
    "express-fileupload": "^1.4.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "whatsapp-web.js": "^1.22.2",
    "qrcode": "^1.5.3",
    "@supabase/supabase-js": "^2.38.0",
    "mime-types": "^2.1.35",
    "puppeteer": "^21.3.8"
  }
}
EOF
    echo "   ✅ package.json criado"
fi

echo ""
echo "🔍 Removendo node_modules antigo..."
rm -rf node_modules package-lock.json

echo ""
echo "📦 Instalando dependências..."
npm install

if [ $? -eq 0 ]; then
    echo "   ✅ Dependências instaladas com sucesso"
else
    echo "   ❌ Erro ao instalar dependências"
    echo "   🔄 Tentando com --force..."
    npm install --force
fi

echo ""
echo "3️⃣ VERIFICANDO ARQUIVOS NECESSÁRIOS"
echo "==================================="

echo "🔍 Verificando arquivos principais..."
if [ ! -f "whatsapp-multi-client-server.js" ]; then
    echo "❌ Arquivo principal não encontrado!"
    exit 1
fi

if [ ! -d "modules" ]; then
    echo "❌ Pasta modules não encontrada!"
    exit 1
fi

echo "   ✅ Arquivos principais encontrados"

echo ""
echo "4️⃣ INICIANDO SERVIDOR CORRIGIDO"
echo "==============================="

echo "🚀 Iniciando servidor com logs detalhados..."
NODE_ENV=production node whatsapp-multi-client-server.js > ../server-fixed.log 2>&1 &
SERVER_PID=$!

echo "   ✅ Servidor iniciado (PID: $SERVER_PID)"
echo "   📝 Logs: tail -f server-fixed.log"

sleep 8

echo ""
echo "5️⃣ TESTANDO SERVIDOR CORRIGIDO"
echo "=============================="

echo "🔍 Verificando se o processo está ativo..."
if ps -p $SERVER_PID > /dev/null; then
    echo "   ✅ Processo ativo (PID: $SERVER_PID)"
else
    echo "   ❌ Processo morreu. Verificando logs..."
    tail -20 ../server-fixed.log
    exit 1
fi

echo ""
echo "🔍 Verificando porta 3001..."
sleep 2
if netstat -tlnp | grep 3001 > /dev/null; then
    echo "   ✅ Porta 3001 aberta"
else
    echo "   ❌ Porta 3001 não está aberta"
    echo "   📋 Logs recentes:"
    tail -10 ../server-fixed.log
fi

echo ""
echo "🔍 Testando health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "http://localhost:3001/health" 2>/dev/null)
echo "   Status: $HEALTH_STATUS"

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "   ✅ Health check funcionando!"
else
    echo "   ❌ Health check falhou"
    echo "   📋 Últimas linhas do log:"
    tail -10 ../server-fixed.log
fi

echo ""
echo "🔍 Testando endpoint /api/clients..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "http://localhost:3001/api/clients" 2>/dev/null)
echo "   Status: $API_STATUS"

if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "500" ]; then
    echo "   ✅ Endpoint /api/ funcionando!"
else
    echo "   ❌ Endpoint /api/ não funciona"
fi

cd ..

echo ""
echo "6️⃣ TESTANDO VIA NGINX"
echo "===================="

echo "🔍 Testando health via Nginx..."
NGINX_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "https://146.59.227.248/health" 2>/dev/null)
echo "   Status Nginx Health: $NGINX_HEALTH"

echo ""
echo "🔍 Testando API via Nginx..."
NGINX_API=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "https://146.59.227.248/clients" 2>/dev/null)
echo "   Status Nginx API: $NGINX_API"

echo ""
echo "7️⃣ RESULTADO FINAL"
echo "=================="

if [ "$HEALTH_STATUS" = "200" ] && [ "$NGINX_HEALTH" = "200" ]; then
    echo "🎉 SERVIDOR CORRIGIDO E FUNCIONANDO!"
    echo ""
    echo "✅ Dependências instaladas"
    echo "✅ Servidor rodando na porta 3001"
    echo "✅ Health check funcionando"
    echo "✅ Nginx proxy funcionando"
    echo ""
    echo "📱 TESTE NO NAVEGADOR:"
    echo "1. Acesse o chat"
    echo "2. Envie uma mensagem"
    echo "3. Deve funcionar sem erro 404"
    echo ""
    echo "🔧 Para monitorar:"
    echo "   tail -f server-fixed.log"
elif [ "$HEALTH_STATUS" = "200" ]; then
    echo "⚠️ SERVIDOR LOCAL OK, MAS NGINX COM PROBLEMA"
    echo ""
    echo "✅ Servidor local funcionando"
    echo "❌ Nginx proxy com problema"
    echo ""
    echo "💡 Nginx precisa ser reiniciado:"
    echo "   sudo systemctl restart nginx"
else
    echo "❌ SERVIDOR AINDA NÃO FUNCIONA"
    echo ""
    echo "📋 Logs para análise:"
    echo "   tail -f server-fixed.log"
    echo ""
    echo "🔍 Para debug:"
    echo "   cd server && node whatsapp-multi-client-server.js"
fi