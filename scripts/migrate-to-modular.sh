
#!/bin/bash

# Script de Migração Segura para Versão Modular
# Arquivo: scripts/migrate-to-modular.sh

echo "🔄 MIGRAÇÃO PARA VERSÃO MODULAR - WHATSAPP MULTI-CLIENT"
echo "======================================================"

# Verificar se estamos no diretório correto
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Arquivo original não encontrado. Execute da pasta raiz do projeto."
    exit 1
fi

# Parar servidor atual se estiver rodando
echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh 2>/dev/null || true

# Fazer backup do arquivo original
echo "💾 Criando backup do arquivo original..."
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
cp server/whatsapp-multi-client-server.js server/backup_whatsapp-multi-client-server_${BACKUP_DATE}.js

# Verificar se versão modular existe
if [ ! -f "server/whatsapp-multi-client-server-modular.js" ]; then
    echo "❌ Versão modular não encontrada."
    exit 1
fi

# Verificar se todos os módulos existem
MODULES=("config.js" "database.js" "whatsapp-client.js" "websocket.js" "api-routes.js" "utils.js" "server-startup.js")
for module in "${MODULES[@]}"; do
    if [ ! -f "server/modules/$module" ]; then
        echo "❌ Módulo não encontrado: server/modules/$module"
        exit 1
    fi
done

# Renomear arquivo original para backup
echo "🔄 Movendo arquivo original para backup..."
mv server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server-original.js

# Ativar versão modular
echo "✅ Ativando versão modular..."
cp server/whatsapp-multi-client-server-modular.js server/whatsapp-multi-client-server.js

echo ""
echo "✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
echo "=================================="
echo "📁 Arquivo original salvo como: server/whatsapp-multi-client-server-original.js"
echo "📁 Backup adicional: server/backup_whatsapp-multi-client-server_${BACKUP_DATE}.js"
echo "🔧 Versão modular ativa: server/whatsapp-multi-client-server.js"
echo ""
echo "🚀 Para iniciar o servidor modular:"
echo "   ./scripts/production-start-whatsapp.sh"
echo ""
echo "🔄 Para fazer rollback:"
echo "   ./scripts/rollback-from-modular.sh"
echo ""
echo "📊 Status dos módulos:"
for module in "${MODULES[@]}"; do
    if [ -f "server/modules/$module" ]; then
        echo "   ✅ $module"
    else
        echo "   ❌ $module"
    fi
done

echo ""
echo "⚠️  IMPORTANTE: Teste todas as funcionalidades antes de excluir os backups!"
