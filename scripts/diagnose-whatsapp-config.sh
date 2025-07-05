#!/bin/bash

echo "🔍 DIAGNÓSTICO CONFIGURAÇÃO WHATSAPP-WEB.JS"
echo "==========================================="

cd /home/ubuntu/sovereign-chat-automation-hub/server

echo ""
echo "1️⃣ VERIFICAÇÃO DE AUTENTICAÇÃO"
echo "=============================="

echo "📋 Verificando método de autenticação no código..."
if grep -q "LocalAuth" whatsapp-multi-client-server.js; then
    echo "✅ LocalAuth está sendo usado (método moderno)"
else
    echo "❌ LocalAuth não encontrado - pode estar usando método legacy"
fi

if grep -q "options.session" whatsapp-multi-client-server.js; then
    echo "⚠️ ATENÇÃO: options.session encontrado (método DEPRECATED)"
else
    echo "✅ Sem uso de options.session (bom)"
fi

echo ""
echo "2️⃣ VERIFICAÇÃO DE SESSÕES E CACHE"
echo "================================="

echo "📁 Verificando diretórios de sessão..."

# Verificar .wwebjs_auth
if [ -d ".wwebjs_auth" ]; then
    SESSION_COUNT=$(find .wwebjs_auth -name "session-*" -type d 2>/dev/null | wc -l)
    echo "✅ Diretório .wwebjs_auth existe com $SESSION_COUNT sessões"
    
    if [ "$SESSION_COUNT" -gt 0 ]; then
        echo "   Sessões encontradas:"
        find .wwebjs_auth -name "session-*" -type d 2>/dev/null | head -5
        
        # Verificar tamanho das sessões
        TOTAL_SIZE=$(du -sh .wwebjs_auth 2>/dev/null | cut -f1)
        echo "   Tamanho total: $TOTAL_SIZE"
    fi
else
    echo "⚠️ Diretório .wwebjs_auth não existe (será criado na primeira conexão)"
fi

# Verificar .wwebjs_cache
if [ -d ".wwebjs_cache" ]; then
    CACHE_SIZE=$(du -sh .wwebjs_cache 2>/dev/null | cut -f1)
    echo "✅ Diretório .wwebjs_cache existe (Tamanho: $CACHE_SIZE)"
else
    echo "⚠️ Diretório .wwebjs_cache não existe"
fi

echo ""
echo "3️⃣ TESTE DE IMPORTAÇÃO DA BIBLIOTECA"
echo "==================================="

echo "📦 Testando importação do whatsapp-web.js..."
node -e "
try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    console.log('✅ whatsapp-web.js importado com sucesso');
    console.log('✅ Client disponível');
    console.log('✅ LocalAuth disponível');
    
    // Verificar versão
    const packageInfo = require('./node_modules/whatsapp-web.js/package.json');
    console.log('📋 Versão:', packageInfo.version);
    
} catch (error) {
    console.log('❌ ERRO na importação:', error.message);
    process.exit(1);
}
" 2>/dev/null || echo "❌ Erro crítico na importação"

echo ""
echo "4️⃣ TESTE DE CRIAÇÃO DE CLIENTE"
echo "=============================="

echo "🧪 Testando criação básica de cliente WhatsApp..."
node -e "
try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    
    console.log('🚀 Criando cliente de teste...');
    
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: 'test-diagnostic'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            timeout: 10000
        }
    });
    
    console.log('✅ Cliente WhatsApp criado com sucesso');
    console.log('✅ LocalAuth configurado');
    console.log('✅ Puppeteer configurado');
    
    // Não vamos inicializar para não travar
    console.log('✅ TESTE DE CRIAÇÃO BEM-SUCEDIDO');
    
} catch (error) {
    console.log('❌ ERRO na criação do cliente:', error.message);
    console.log('🔍 Stack trace:', error.stack);
    process.exit(1);
}
" 2>/dev/null || echo "❌ Erro crítico na criação do cliente"

echo ""
echo "5️⃣ VERIFICAÇÃO DE CONFIGURAÇÃO PUPPETEER"
echo "========================================"

echo "🔍 Analisando configuração atual do Puppeteer..."
grep -A 20 "puppeteer:" whatsapp-multi-client-server.js | head -20

echo ""
echo "6️⃣ VERIFICAÇÃO DE TIMEOUTS"
echo "=========================="

echo "⏰ Timeouts configurados:"
grep -E "(timeout|Timeout)" whatsapp-multi-client-server.js | head -5

echo ""
echo "7️⃣ LIMPEZA RECOMENDADA"
echo "======================"

echo "🧹 Para limpar sessões antigas (se necessário):"
echo "   rm -rf .wwebjs_auth/session-*"
echo "   rm -rf .wwebjs_cache/*"

echo ""
echo "🧹 Para limpar processos Chrome órfãos:"
echo "   pkill -f chrome"
echo "   pkill -f chromium"

echo ""
echo "8️⃣ DIAGNÓSTICO DE LOGS RECENTES"
echo "==============================="

if [ -f "../logs/whatsapp-multi-client.log" ]; then
    echo "📋 Últimas linhas do log (erros):"
    tail -20 ../logs/whatsapp-multi-client.log | grep -E "(erro|error|ERROR|fail|FAIL)" || echo "   Nenhum erro recente encontrado"
else
    echo "⚠️ Arquivo de log não encontrado"
fi

echo ""
echo "9️⃣ RECOMENDAÇÕES FINAIS"
echo "======================="

# Verificar versão antiga
WWEBJS_VERSION=$(node -e "console.log(require('./node_modules/whatsapp-web.js/package.json').version)" 2>/dev/null || echo "unknown")
echo "📋 Versão atual do whatsapp-web.js: $WWEBJS_VERSION"

if [ "$WWEBJS_VERSION" != "unknown" ]; then
    MAJOR_VERSION=$(echo $WWEBJS_VERSION | cut -d. -f1)
    if [ "$MAJOR_VERSION" -lt 1 ]; then
        echo "⚠️ ATENÇÃO: Versão muito antiga do whatsapp-web.js"
        echo "💡 RECOMENDAÇÃO: Atualize para versão 1.21.0 ou superior"
    else
        echo "✅ Versão adequada do whatsapp-web.js"
    fi
fi

echo ""
echo "✅ Diagnóstico configuração WhatsApp concluído!"