
#!/bin/bash

# Script para verificar saúde do sistema WhatsApp Multi-Cliente
# Arquivo: scripts/check-whatsapp-health.sh

echo "🔍 Verificando saúde do sistema WhatsApp Multi-Cliente..."

# Verificar se o servidor está rodando
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor WhatsApp Multi-Cliente está rodando (porta 4000)"
    
    # Mostrar informações do servidor
    echo "📊 Status do servidor:"
    curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health
    
    echo ""
    echo "🌐 URLs disponíveis:"
    echo "• API Health: http://localhost:4000/health"
    echo "• Swagger API: http://localhost:4000/api-docs"
    echo "• Frontend Admin: http://localhost:5173/admin/instances"
    
else
    echo "❌ Servidor WhatsApp Multi-Cliente não está rodando"
    echo "💡 Execute: ./scripts/start-whatsapp-server.sh"
fi

# Verificar processos relacionados
echo ""
echo "🔍 Processos WhatsApp ativos:"
ps aux | grep -E "(whatsapp|chrome)" | grep -v grep | head -10

echo ""
echo "🔍 Portas em uso:"
sudo lsof -i :4000 -i :3002 -i :3005 -i :5173 | head -20
