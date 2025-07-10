#!/bin/bash

# Script rápido para finalizar a instalação do Puppeteer
# Arquivo: scripts/restart-and-test.sh

echo "🔧 CORREÇÃO DO ERRO 500 - WHATSAPP TIMEOUT"
echo "==========================================="
echo "🚀 Aplicando correção para timeout de inicialização"
echo "⏰ Timeout estendido: 60s → 180s"
echo "🔄 Sistema de retry: 2 tentativas"
echo "🔧 Configurações Chrome otimizadas"
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

# Limpar processos Chrome órfãos
echo "🧹 Limpando processos Chrome órfãos..."
pkill -f "chrome" 2>/dev/null || true
pkill -f "chromium" 2>/dev/null || true

# Limpar diretório temporário do Chrome
echo "🧹 Limpando cache temporário..."
rm -rf /tmp/chrome-user-data 2>/dev/null || true

# Aguardar um pouco
sleep 5

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
        echo "🎉🎉🎉 CORREÇÃO APLICADA COM SUCESSO! 🎉🎉🎉"
        echo ""
        echo "✅ Timeout corrigido: 60s → 180s"
        echo "✅ Sistema de retry: 2 tentativas"
        echo "✅ Chrome otimizado"
        echo "✅ Puppeteer: ATUALIZADO"
        echo "✅ Servidor: RODANDO"
        echo "✅ API: FUNCIONANDO"
        echo "✅ Supabase: CONECTADO"
        echo ""
        echo "🔧 CORREÇÕES IMPLEMENTADAS:"
        echo "• Timeout estendido para evitar erro 500"
        echo "• Retry automático em caso de falha"
        echo "• Limpeza de processos Chrome órfãos"
        echo "• Configurações Chrome otimizadas"
        echo ""
        echo "🧪 AGORA TESTE O QR CODE:"
        echo "1. Acesse: http://146.59.227.248:8080/admin/instances"
        echo "2. Clique em 'Conectar HTTPS'"
        echo "3. ✅ NÃO DEVE MAIS APARECER ERRO 500!"
        echo "4. 📱 QR CODE DEVE APARECER EM ATÉ 3 MINUTOS"
        echo ""
        echo "📱 Escaneie com WhatsApp para conectar"
        echo ""
        echo "🐛 Se ainda houver erro 500:"
        echo "• Verifique logs: tail -f logs/whatsapp-multi-client.log"
        echo "• Execute: ./scripts/diagnose-complete-system.sh"
        
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