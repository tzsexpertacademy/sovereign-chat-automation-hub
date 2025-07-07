
#!/bin/bash

# Script para reiniciar e testar sistema corrigido
# Arquivo: scripts/restart-and-test.sh

echo "🔄 REINICIANDO SISTEMA WHATSAPP CORRIGIDO"
echo "========================================"

# Parar servidor atual
echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

# Aguardar limpeza completa
echo "⏳ Aguardando limpeza completa..."
sleep 5

# Verificar se porta está livre
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 ainda em uso, forçando liberação..."
    fuser -k 4000/tcp || true
    sleep 3
fi

# Iniciar servidor corrigido
echo "🚀 Iniciando servidor corrigido..."
./scripts/production-start-whatsapp.sh

# Aguardar inicialização
echo "⏳ Aguardando inicialização (15s)..."
sleep 15

# Testar endpoints críticos
echo ""
echo "🧪 TESTANDO ENDPOINTS CRÍTICOS"
echo "=============================="

# Teste 1: Health Check
echo -n "1. Health Check... "
if curl -s -f "https://146.59.227.248/health" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FALHOU"
fi

# Teste 2: Listar Clientes
echo -n "2. Listar Clientes... "
if curl -s -f "https://146.59.227.248/clients" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FALHOU"
fi

# Teste 3: WebSocket
echo -n "3. WebSocket... "
if curl -s -I "https://146.59.227.248/socket.io/" | grep -q "200\|101"; then
    echo "✅ OK"
else
    echo "❌ FALHOU"
fi

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "=================="
echo "1. ✅ Sistema reiniciado com correções"
echo "2. 🌐 Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo "3. ➕ Crie uma nova instância"
echo "4. 🔗 Teste a conectividade"
echo "5. 📱 Verifique se QR Code aparece"
echo ""
echo "🔧 Para debug adicional:"
echo "• Logs: tail -f logs/whatsapp-multi-client.log"
echo "• Status: curl https://146.59.227.248/api/stats"
echo ""
echo "✅ Reinicialização e testes concluídos!"

# Tornar script executável
chmod +x scripts/restart-and-test.sh
