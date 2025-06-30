
#!/bin/bash

# Script de ROLLBACK RÁPIDO - Volta ao estado que funciona com Lovable
# Arquivo: scripts/quick-rollback.sh

echo "🔙 ROLLBACK RÁPIDO - RESTAURANDO ESTADO QUE FUNCIONA COM LOVABLE"
echo "==============================================================="

if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/quick-rollback.sh"
    exit 1
fi

# Encontrar o backup mais recente
LATEST_BACKUP=$(ls -t /tmp/nginx-backup-* 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Nenhum backup encontrado!"
    echo "💡 Execute o backup primeiro: sudo ./scripts/backup-working-config.sh"
    exit 1
fi

echo "📁 Usando backup: $LATEST_BACKUP"

# Restaurar configuração
cp "$LATEST_BACKUP/whatsapp-multi-client" /etc/nginx/sites-available/
systemctl reload nginx

echo "✅ ROLLBACK CONCLUÍDO!"
echo "🔄 Lovable deve estar funcionando novamente"
echo "🧪 Teste: https://146.59.227.248/health"

