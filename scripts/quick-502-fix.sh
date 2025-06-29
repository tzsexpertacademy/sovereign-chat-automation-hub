
#!/bin/bash

# Quick fix para erro 502 - WhatsApp Multi-Client
echo "🚀 QUICK FIX - ERRO 502 BAD GATEWAY"
echo "=================================="

# Verificar se Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    echo "🔧 Iniciando Nginx..."
    sudo systemctl start nginx
fi

# Verificar se backend está respondendo
if ! curl -s http://localhost:4000/health > /dev/null; then
    echo "❌ Backend não está respondendo na porta 4000"
    echo "🔧 Execute: ./scripts/production-start-whatsapp.sh"
    exit 1
fi

echo "✅ Backend OK na porta 4000"

# Testar proxy do Nginx
echo "🧪 Testando proxy Nginx..."
if curl -s http://146.59.227.248/health > /dev/null; then
    echo "✅ Proxy HTTP funcionando"
else
    echo "❌ Proxy HTTP com problema - precisa reconfigurar Nginx"
    echo "🔧 Execute: sudo ./scripts/fix-nginx-502.sh"
    exit 1
fi

# Testar HTTPS
echo "🧪 Testando HTTPS..."
if curl -k -s https://146.59.227.248/health > /dev/null; then
    echo "✅ HTTPS funcionando!"
    echo ""
    echo "🎉 Acesse: https://146.59.227.248/health"
    echo "📝 No Lovable, clique em 'Verificar Conexão'"
else
    echo "❌ HTTPS com problema"
    echo "🔧 Execute: sudo ./scripts/fix-nginx-502.sh"
fi
