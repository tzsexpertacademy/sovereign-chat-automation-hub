
#!/bin/bash

# Script para configurar conexão HTTP direta (sem proxy)
# Arquivo: scripts/fix-direct-connection.sh

echo "🔧 CONFIGURANDO CONEXÃO HTTP DIRETA"
echo "===================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-direct-connection.sh"
    exit 1
fi

echo "🛑 Parando Nginx para evitar conflitos..."
systemctl stop nginx
systemctl disable nginx

echo "🔧 Configurando iptables para acesso direto..."
# Permitir acesso direto à porta 4000
iptables -A INPUT -p tcp --dport 4000 -j ACCEPT
iptables -A OUTPUT -p tcp --sport 4000 -j ACCEPT

# Salvar regras do iptables
if command -v iptables-save > /dev/null; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || echo "⚠️ Não foi possível salvar regras iptables"
fi

echo "🔥 Limpando configurações antigas do Nginx..."
rm -f /etc/nginx/sites-enabled/whatsapp-multi-client
rm -f /etc/nginx/sites-available/whatsapp-multi-client

echo "🧪 Testando conexão direta..."
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Backend respondendo na porta 4000"
else
    echo "❌ Backend não está respondendo"
    exit 1
fi

# Testar acesso externo
echo "🌐 Testando acesso externo..."
if curl -s http://146.59.227.248:4000/health > /dev/null; then
    echo "✅ Acesso externo funcionando!"
else
    echo "⚠️ Acesso externo pode ter problemas de firewall"
fi

echo ""
echo "🎉 CONFIGURAÇÃO HTTP DIRETA CONCLUÍDA!"
echo "====================================="
echo ""
echo "✅ Nginx desabilitado"
echo "✅ Porta 4000 liberada"
echo "✅ Conexão direta configurada"
echo ""
echo "🌐 URLs para testar:"
echo "  • Health: http://146.59.227.248:4000/health"
echo "  • API: http://146.59.227.248:4000/clients"
echo "  • Swagger: http://146.59.227.248:4000/api-docs"
echo ""
echo "📝 No Lovable, clique em 'Verificar Conexão'"
echo ""
