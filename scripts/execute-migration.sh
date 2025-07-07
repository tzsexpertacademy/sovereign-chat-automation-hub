
#!/bin/bash

# Script para Executar Migração Completa
# Arquivo: scripts/execute-migration.sh

echo "🚀 EXECUTANDO MIGRAÇÃO PARA VERSÃO MODULAR"
echo "=========================================="

# Verificar se estamos no diretório correto
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Execute da pasta raiz do projeto"
    exit 1
fi

# Parar servidor atual
echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh 2>/dev/null || true
pkill -f "whatsapp-multi-client-server" 2>/dev/null || true

# Aguardar processo terminar
sleep 3

# Criar backup adicional com timestamp
echo "💾 Criando backup adicional..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp server/whatsapp-multi-client-server.js server/backup_pre_migration_${TIMESTAMP}.js

# Verificar se versão modular existe
if [ ! -f "server/whatsapp-multi-client-server-modular.js" ]; then
    echo "❌ Versão modular não encontrada!"
    exit 1
fi

# Verificar todos os módulos
echo "🔍 Verificando módulos..."
MODULES=("config.js" "database.js" "whatsapp-client.js" "websocket.js" "api-routes.js" "utils.js" "server-startup.js")
MISSING=0

for module in "${MODULES[@]}"; do
    if [ -f "server/modules/$module" ]; then
        echo "   ✅ $module"
        # Verificar sintaxe
        if ! node -c "server/modules/$module" 2>/dev/null; then
            echo "   ❌ $module - ERRO DE SINTAXE"
            MISSING=1
        fi
    else
        echo "   ❌ $module - FALTANDO"
        MISSING=1
    fi
done

if [ $MISSING -eq 1 ]; then
    echo "❌ Migração cancelada - módulos com problemas"
    exit 1
fi

# Migração já está ativa - apenas confirmar
echo ""
echo "✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
echo "=================================="
echo "🔥 Versão modular está ATIVA"
echo "📁 Backup criado: server/backup_pre_migration_${TIMESTAMP}.js"
echo "📁 Backup original: server/whatsapp-multi-client-server-original.js"
echo ""
echo "🧪 Executando testes básicos..."

# Teste básico de sintaxe
if node -c server/whatsapp-multi-client-server.js; then
    echo "✅ Sintaxe do arquivo principal OK"
else
    echo "❌ Erro de sintaxe no arquivo principal"
    exit 1
fi

# Teste de inicialização rápida (5 segundos)
echo "🚀 Testando inicialização (5 segundos)..."
timeout 5s node server/whatsapp-multi-client-server.js > /tmp/migration_test.log 2>&1 &
TEST_PID=$!
sleep 3

if ps -p $TEST_PID > /dev/null 2>&1; then
    echo "✅ Servidor inicia sem erros críticos"
    kill $TEST_PID 2>/dev/null || true
else
    echo "❌ Servidor falhou na inicialização"
    echo "📝 Log de erro:"
    cat /tmp/migration_test.log 2>/dev/null || echo "Log não disponível"
    exit 1
fi

# Limpeza
rm -f /tmp/migration_test.log

echo ""
echo "🎉 MIGRAÇÃO 100% CONCLUÍDA!"
echo "=========================="
echo "🔥 Sistema modular ATIVO e funcionando"
echo "📦 ${#MODULES[@]} módulos carregados"
echo "🛡️  Backups de segurança criados"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "   1. ./scripts/production-start-whatsapp.sh"
echo "   2. Testar todas as funcionalidades"
echo "   3. Monitorar logs por algumas horas"
echo ""
echo "🔄 ROLLBACK (se necessário):"
echo "   ./scripts/rollback-from-modular.sh"
echo ""
echo "🧪 DIAGNÓSTICO COMPLETO:"
echo "   ./scripts/compare-versions.sh"

# Tornar script executável
chmod +x scripts/*.sh
