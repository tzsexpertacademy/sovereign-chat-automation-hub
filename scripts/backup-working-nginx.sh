
#!/bin/bash

# Script para backup da configuração Nginx que funciona com Lovable
# Arquivo: scripts/backup-working-nginx.sh

echo "💾 CRIANDO BACKUP DA CONFIGURAÇÃO QUE FUNCIONA"
echo "============================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/backup-working-nginx.sh"
    exit 1
fi

# Criar diretório de backup
BACKUP_DIR="/tmp/nginx-working-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "📁 Diretório de backup: $BACKUP_DIR"

# Backup da configuração Nginx
echo "📋 Fazendo backup da configuração Nginx..."
cp /etc/nginx/sites-available/whatsapp-multi-client $BACKUP_DIR/nginx-config.conf
cp /etc/nginx/nginx.conf $BACKUP_DIR/nginx-main.conf

# Backup dos certificados SSL
echo "🔐 Fazendo backup dos certificados SSL..."
if [ -d "/etc/ssl/whatsapp" ]; then
    cp -r /etc/ssl/whatsapp $BACKUP_DIR/ssl-certs/
fi

# Salvar status dos serviços
echo "📊 Salvando status dos serviços..."
systemctl status nginx > $BACKUP_DIR/nginx-status.txt
ss -tlnp | grep :443 > $BACKUP_DIR/port-443-status.txt
ss -tlnp | grep :4000 > $BACKUP_DIR/port-4000-status.txt

# Criar script de restauração
cat > $BACKUP_DIR/restore.sh << 'EOF'
#!/bin/bash
echo "🔄 RESTAURANDO CONFIGURAÇÃO QUE FUNCIONAVA"
echo "========================================="

BACKUP_DIR=$(dirname "$0")

# Restaurar configuração Nginx
cp "$BACKUP_DIR/nginx-config.conf" /etc/nginx/sites-available/whatsapp-multi-client
cp "$BACKUP_DIR/nginx-main.conf" /etc/nginx/nginx.conf

# Restaurar certificados SSL
if [ -d "$BACKUP_DIR/ssl-certs" ]; then
    rm -rf /etc/ssl/whatsapp
    cp -r "$BACKUP_DIR/ssl-certs" /etc/ssl/whatsapp
fi

# Testar e reiniciar Nginx
nginx -t && systemctl restart nginx

echo "✅ Configuração restaurada!"
echo "🧪 Teste: https://146.59.227.248/health"
EOF

chmod +x $BACKUP_DIR/restore.sh

echo "✅ Backup criado com sucesso!"
echo "📁 Localização: $BACKUP_DIR"
echo "🔄 Para restaurar: sudo $BACKUP_DIR/restore.sh"
echo ""
echo "📋 Arquivos salvos:"
echo "  • nginx-config.conf (configuração do site)"
echo "  • nginx-main.conf (configuração principal)"
echo "  • ssl-certs/ (certificados SSL)"
echo "  • restore.sh (script de restauração)"
echo ""
