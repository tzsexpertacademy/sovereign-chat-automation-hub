
#!/bin/bash

# Backup da configuração que está funcionando
# Arquivo: scripts/backup-working-config.sh

echo "💾 CRIANDO BACKUP DA CONFIGURAÇÃO QUE FUNCIONA"
echo "=============================================="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/whatsapp-backup-$TIMESTAMP"

echo "📁 Criando diretório de backup: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup dos certificados SSL
if [ -d "/etc/ssl/whatsapp" ]; then
    echo "🔐 Backup dos certificados SSL..."
    sudo cp -r /etc/ssl/whatsapp "$BACKUP_DIR/"
    echo "✅ Certificados SSL salvos"
fi

# Backup da configuração Nginx
if [ -f "/etc/nginx/sites-available/whatsapp-multi-client" ]; then
    echo "⚙️ Backup da configuração Nginx..."
    sudo cp /etc/nginx/sites-available/whatsapp-multi-client "$BACKUP_DIR/"
    echo "✅ Configuração Nginx salva"
fi

# Backup dos scripts atuais
echo "📜 Backup dos scripts..."
cp scripts/setup-simple-https.sh "$BACKUP_DIR/" 2>/dev/null || true
cp scripts/update-frontend-urls.sh "$BACKUP_DIR/" 2>/dev/null || true
cp src/config/environment.ts "$BACKUP_DIR/" 2>/dev/null || true

# Criar script de restore
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash
echo "🔄 RESTAURANDO CONFIGURAÇÃO DE BACKUP"
echo "===================================="

if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./restore.sh"
    exit 1
fi

# Restaurar certificados
if [ -d "whatsapp" ]; then
    cp -r whatsapp /etc/ssl/
    echo "✅ Certificados SSL restaurados"
fi

# Restaurar Nginx
if [ -f "whatsapp-multi-client" ]; then
    cp whatsapp-multi-client /etc/nginx/sites-available/
    systemctl reload nginx
    echo "✅ Nginx restaurado"
fi

echo "✅ Backup restaurado com sucesso!"
EOF

chmod +x "$BACKUP_DIR/restore.sh"

echo ""
echo "✅ BACKUP COMPLETO CRIADO!"
echo "📁 Local: $BACKUP_DIR"
echo "🔄 Para restaurar: sudo $BACKUP_DIR/restore.sh"
echo ""
echo "📋 Itens salvos:"
ls -la "$BACKUP_DIR/"
