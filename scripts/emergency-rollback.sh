
#!/bin/bash

# Script de rollback de emergência
# Arquivo: scripts/emergency-rollback.sh

echo "🚨 ROLLBACK DE EMERGÊNCIA"
echo "========================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/emergency-rollback.sh"
    exit 1
fi

# Encontrar backup mais recente
BACKUP_DIR=$(ls -dt /tmp/nginx-working-backup-* 2>/dev/null | head -1)

if [ -z "$BACKUP_DIR" ]; then
    echo "❌ Nenhum backup encontrado!"
    echo "💡 Execute: sudo ./scripts/backup-working-nginx.sh primeiro"
    exit 1
fi

echo "🔄 Restaurando do backup: $BACKUP_DIR"

# Executar restauração
$BACKUP_DIR/restore.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ROLLBACK CONCLUÍDO!"
    echo "====================="
    echo "🧪 Teste: https://146.59.227.248/health"
    echo "🎯 Lovable deve voltar a mostrar 'Connected'"
else
    echo "❌ Erro no rollback!"
    exit 1
fi
