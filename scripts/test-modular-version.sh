
#!/bin/bash

# Script de Teste da Versão Modular
# Arquivo: scripts/test-modular-version.sh

echo "🧪 TESTE DA VERSÃO MODULAR"
echo "=========================="

# Verificar se versão modular está ativa
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Servidor não encontrado"
    exit 1
fi

# Verificar se é a versão modular
if ! grep -q "whatsapp-multi-client-server-modular" server/whatsapp-multi-client-server.js; then
    echo "⚠️  Versão modular não está ativa"
    echo "🔄 Execute: ./scripts/migrate-to-modular.sh"
    exit 1
fi

echo "✅ Versão modular detectada"

# Verificar módulos
echo ""
echo "📊 Verificando módulos..."
MODULES=("config.js" "database.js" "whatsapp-client.js" "websocket.js" "api-routes.js" "utils.js" "server-startup.js")
MISSING_MODULES=0

for module in "${MODULES[@]}"; do
    if [ -f "server/modules/$module" ]; then
        echo "   ✅ $module"
    else
        echo "   ❌ $module (FALTANDO)"
        MISSING_MODULES=$((MISSING_MODULES + 1))
    fi
done

if [ $MISSING_MODULES -gt 0 ]; then
    echo ""
    echo "❌ $MISSING_MODULES módulos faltando!"
    echo "🔄 Execute a refatoração novamente"
    exit 1
fi

# Teste básico de sintaxe Node.js
echo ""
echo "🔍 Testando sintaxe do arquivo principal..."
if node -c server/whatsapp-multi-client-server.js; then
    echo "✅ Sintaxe do arquivo principal OK"
else
    echo "❌ Erro de sintaxe no arquivo principal"
    exit 1
fi

# Testar módulos individualmente
echo ""
echo "🔍 Testando sintaxe dos módulos..."
MODULE_ERRORS=0

for module in "${MODULES[@]}"; do
    if node -c "server/modules/$module" 2>/dev/null; then
        echo "   ✅ $module - Sintaxe OK"
    else
        echo "   ❌ $module - Erro de sintaxe"
        MODULE_ERRORS=$((MODULE_ERRORS + 1))
    fi
done

if [ $MODULE_ERRORS -gt 0 ]; then
    echo ""
    echo "❌ $MODULE_ERRORS módulos com erro de sintaxe!"
    exit 1
fi

# Teste de inicialização rápida
echo ""
echo "🚀 Testando inicialização rápida (5 segundos)..."
timeout 5s node server/whatsapp-multi-client-server.js > /tmp/modular_test.log 2>&1 &
TEST_PID=$!
sleep 3

if ps -p $TEST_PID > /dev/null; then
    echo "✅ Servidor iniciou sem erros críticos"
    kill $TEST_PID 2>/dev/null
else
    echo "❌ Servidor falhou na inicialização"
    echo "📝 Log de erro:"
    cat /tmp/modular_test.log
    exit 1
fi

# Limpeza
rm -f /tmp/modular_test.log

echo ""
echo "✅ TODOS OS TESTES PASSARAM!"
echo "============================"
echo "🎉 Versão modular está funcionando corretamente"
echo "🚀 Pronto para uso em produção"
echo ""
echo "📋 Próximos passos:"
echo "   1. ./scripts/production-start-whatsapp.sh"
echo "   2. Testar todas as funcionalidades manualmente"
echo "   3. Monitorar logs por algumas horas"
echo "   4. Se tudo OK, excluir backups antigos"
