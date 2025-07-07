
#!/bin/bash

# Script de Rollback da Versão Modular
# Arquivo: scripts/rollback-from-modular.sh

echo "🔄 ROLLBACK DA VERSÃO MODULAR"
echo "============================="

# Verificar se backup existe
if [ ! -f "server/whatsapp-multi-client-server-original.js" ]; then
    echo "❌ Backup original não encontrado!"
    echo "🔍 Procurando backups alternativos..."
    
    # Procurar outros backups
    BACKUP_FILES=$(ls server/backup_whatsapp-multi-client-server_*.js 2>/dev/null | head -1)
    if [ -n "$BACKUP_FILES" ]; then
        echo "📁 Encontrado backup: $BACKUP_FILES"
        echo "🔄 Deseja usar este backup? (y/n)"
        read -r response
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            cp "$BACKUP_FILES" server/whatsapp-multi-client-server-original.js
        else
            echo "❌ Rollback cancelado."
            exit 1
        fi
    else
        echo "❌ Nenhum backup encontrado. Rollback impossível."
        exit 1
    fi
fi

# Parar servidor atual
echo "🛑 Parando servidor modular..."
./scripts/production-stop-whatsapp.sh 2>/dev/null || true

# Fazer backup da versão modular antes do rollback
echo "💾 Fazendo backup da versão modular..."
ROLLBACK_DATE=$(date +%Y%m%d_%H%M%S)
cp server/whatsapp-multi-client-server.js server/modular_backup_${ROLLBACK_DATE}.js

# Restaurar arquivo original
echo "🔄 Restaurando arquivo original..."
cp server/whatsapp-multi-client-server-original.js server/whatsapp-multi-client-server.js

echo ""
echo "✅ ROLLBACK CONCLUÍDO!"
echo "====================="
echo "📁 Arquivo original restaurado"
echo "📁 Versão modular salva como: server/modular_backup_${ROLLBACK_DATE}.js"
echo ""
echo "🚀 Para iniciar o servidor original:"
echo "   ./scripts/production-start-whatsapp.sh"
echo ""
echo "🔄 Para voltar à versão modular:"
echo "   ./scripts/migrate-to-modular.sh"
