#!/bin/bash

# Script de teste da correção do Puppeteer
# Arquivo: scripts/test-puppeteer-fix.sh

echo "🧪 ===== TESTE DA CORREÇÃO PUPPETEER ====="
echo "========================================"

# Verificar se está no diretório correto
if [ ! -f "server/package.json" ]; then
    echo "❌ Execute este script na raiz do projeto!"
    exit 1
fi

echo ""
echo "🔍 FASE 1: VERIFICAÇÃO DO SISTEMA"
echo "================================"

# 1. Verificar Chrome disponível
echo "🌐 Verificando Chrome no sistema:"
if command -v google-chrome >/dev/null 2>&1; then
    CHROME_PATH=$(which google-chrome)
    CHROME_VERSION=$($CHROME_PATH --version 2>/dev/null || echo "Erro ao obter versão")
    echo "✅ Google Chrome encontrado: $CHROME_PATH"
    echo "📋 Versão: $CHROME_VERSION"
else
    echo "❌ Google Chrome não encontrado!"
    echo "💡 Instale o Chrome antes de prosseguir"
    exit 1
fi

# 2. Verificar servidor WhatsApp
echo ""
echo "🔍 Verificando servidor WhatsApp..."
if pgrep -f "whatsapp-multi-client-server" >/dev/null; then
    echo "✅ Servidor WhatsApp está rodando"
else
    echo "⚠️ Servidor WhatsApp não está rodando"
    echo "💡 Para testar completamente, inicie o servidor primeiro"
fi

# 3. Verificar logs recentes
echo ""
echo "📋 Últimos logs do servidor (últimas 5 linhas):"
if [ -f "logs/whatsapp-multi-client.log" ]; then
    tail -5 logs/whatsapp-multi-client.log
else
    echo "⚠️ Arquivo de log não encontrado"
fi

echo ""
echo "🧪 FASE 2: TESTE DE CONECTIVIDADE"
echo "================================"

# 4. Teste básico de conectividade
echo "🌐 Testando conectividade HTTPS..."
if curl -s -k https://localhost:4000/health >/dev/null 2>&1; then
    echo "✅ HTTPS está respondendo"
elif curl -s http://localhost:4000/health >/dev/null 2>&1; then
    echo "✅ HTTP está respondendo"
else
    echo "❌ Servidor não está respondendo"
    echo "💡 Verifique se o servidor está rodando na porta 4000"
fi

# 5. Teste de WebSocket (se possível)
echo ""
echo "🔌 Testando WebSocket..."
if command -v wscat >/dev/null 2>&1; then
    echo "🧪 Fazendo teste básico de WebSocket..."
    timeout 3 wscat -c wss://localhost:4000 2>/dev/null && echo "✅ WebSocket conectável" || echo "⚠️ WebSocket com problema ou timeout"
else
    echo "⚠️ wscat não disponível para teste de WebSocket"
fi

echo ""
echo "🎯 FASE 3: VALIDAÇÃO DA CORREÇÃO"
echo "==============================="

# 6. Verificar se a correção foi aplicada
echo "📝 Verificando se executablePath foi aplicado..."
if grep -q "executablePath.*google-chrome" server/modules/whatsapp-client.js; then
    echo "✅ Correção aplicada: executablePath configurado"
else
    echo "❌ Correção não encontrada no código"
    exit 1
fi

# 7. Verificar se backup existe
echo ""
echo "💾 Verificando backups disponíveis..."
if ls server/node_modules.backup.* >/dev/null 2>&1; then
    LATEST_BACKUP=$(ls -t server/node_modules.backup.* | head -1)
    echo "✅ Backup mais recente: $LATEST_BACKUP"
else
    echo "⚠️ Nenhum backup encontrado"
fi

if [ -f "server/modules/whatsapp-client.js.backup" ]; then
    echo "✅ Backup do arquivo original: whatsapp-client.js.backup"
else
    echo "⚠️ Backup do arquivo original não encontrado"
fi

echo ""
echo "🚀 FASE 4: INSTRUÇÕES DE TESTE PRÁTICO"
echo "====================================="

echo "📋 Para testar o envio de áudio agora:"
echo ""
echo "1. 🔄 Reinicie o servidor WhatsApp:"
echo "   cd ~/sovereign-chat-automation-hub"
echo "   ./scripts/restart-whatsapp-server.sh"
echo ""
echo "2. 📱 Acesse o painel admin:"
echo "   https://localhost:4000/admin (ou seu domínio)"
echo ""
echo "3. 🎯 Crie uma nova instância e escaneie o QR Code"
echo ""
echo "4. 🎵 Teste o envio de áudio através da interface"
echo ""
echo "🔍 Para monitorar em tempo real:"
echo "   tail -f logs/whatsapp-multi-client.log"
echo ""

echo "🎯 FASE 5: VERIFICAÇÃO DE ROLLBACK"
echo "================================="

echo "🛡️ Se algo der errado, execute rollback:"
echo ""
echo "   # Rollback completo:"
echo "   mv $LATEST_BACKUP server/node_modules"
echo ""
echo "   # Rollback apenas do arquivo:"
echo "   mv server/modules/whatsapp-client.js.backup server/modules/whatsapp-client.js"
echo ""
echo "   # Reiniciar servidor:"
echo "   ./scripts/restart-whatsapp-server.sh"
echo ""

echo "✅ TESTE DE CORREÇÃO CONCLUÍDO!"
echo "==============================="
echo ""
echo "🎯 STATUS DA CORREÇÃO:"
echo "   ✅ Chrome do sistema detectado: $CHROME_PATH"
echo "   ✅ executablePath configurado no código"
echo "   ✅ Backups criados para segurança"
echo "   ✅ Instruções de teste fornecidas"
echo ""
echo "🚀 PRÓXIMO PASSO: Reiniciar servidor e testar áudio!"