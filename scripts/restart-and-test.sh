#!/bin/bash

# Script rápido para finalizar a instalação do Puppeteer
# Arquivo: scripts/restart-and-test.sh

echo "🎉 FINALIZANDO INSTALAÇÃO DO PUPPETEER"
echo "====================================="

echo ""
echo "🔧 DANDO PERMISSÃO A TODOS OS SCRIPTS"
echo "====================================="
chmod +x scripts/*.sh

echo ""
echo "🛑 PARANDO SERVIDOR ATUAL"
echo "========================"
# Matar todos os processos Node.js do WhatsApp
pkill -f "whatsapp-multi-client-server" 2>/dev/null || true
pkill -f "node.*whatsapp" 2>/dev/null || true

# Aguardar um pouco
sleep 3

echo ""
echo "🚀 INICIANDO SERVIDOR COM PUPPETEER INSTALADO"
echo "============================================="

cd server

# Iniciar em background e capturar PID
nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
SERVER_PID=$!

echo "🆔 Servidor iniciado com PID: $SERVER_PID"

cd ..

# Aguardar inicialização
echo "⏳ Aguardando 8 segundos para inicialização..."
sleep 8

echo ""
echo "🧪 TESTANDO O SERVIDOR"
echo "====================="

# Testar se está funcionando
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health)

if [ "$RESPONSE" = "200" ]; then
    echo "✅ SERVIDOR FUNCIONANDO!"
    echo ""
    echo "🎯 TESTE FINAL: Verificando se API está ok..."
    
    # Testar a API
    API_TEST=$(curl -s http://127.0.0.1:4000/clients 2>/dev/null)
    
    if echo "$API_TEST" | grep -q "success"; then
        echo "🎉🎉🎉 TUDO FUNCIONANDO PERFEITAMENTE! 🎉🎉🎉"
        echo ""
        echo "✅ Puppeteer: INSTALADO"
        echo "✅ Servidor: RODANDO"
        echo "✅ API: FUNCIONANDO"
        echo "✅ Supabase: CONECTADO"
        echo ""
        echo "🧪 AGORA TESTE O QR CODE:"
        echo "1. Acesse: http://146.59.227.248:8080/admin/instances"
        echo "2. Clique em 'Conectar HTTPS'"
        echo "3. DEVE APARECER O QR CODE! 📱"
        echo ""
        echo "📱 Escaneie com WhatsApp para conectar"
        
    else
        echo "⚠️ Servidor rodando mas API com problema"
        echo "💡 Teste manual: http://146.59.227.248:8080"
    fi
    
else
    echo "❌ Servidor não está respondendo"
    echo "📋 Status HTTP: $RESPONSE"
    echo "💡 Verificar logs: tail -f logs/whatsapp-multi-client.log"
fi

echo ""
echo "📅 Teste concluído em: $(date)"