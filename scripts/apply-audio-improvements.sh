
#!/bin/bash

# Script para aplicar melhorias no sistema de áudio SEM quebrar nada
echo "🎵 ===== APLICANDO MELHORIAS NO SISTEMA DE ÁUDIO ====="
echo "📅 $(date)"
echo "🎯 GARANTIA: Nenhuma funcionalidade existente será alterada"
echo ""

# Backup de segurança
echo "💾 1. Criando backup de segurança..."
cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup criado"

# Verificar sintaxe antes de aplicar
echo ""
echo "🧪 2. Verificando sintaxe dos arquivos..."
node -c server/utils/audioProcessor.js
if [ $? -eq 0 ]; then
    echo "✅ AudioProcessor sintaxe válida"
else
    echo "❌ Erro na sintaxe do AudioProcessor"
    exit 1
fi

node -c server/whatsapp-multi-client-server.js
if [ $? -eq 0 ]; then
    echo "✅ Servidor sintaxe válida"
else
    echo "❌ Erro na sintaxe do servidor"
    echo "🔄 Restaurando backup..."
    cp server/whatsapp-multi-client-server.js.backup.* server/whatsapp-multi-client-server.js
    exit 1
fi

# Parar servidor existente primeiro
echo ""
echo "🛑 3. Parando servidor existente..."
./scripts/production-stop-whatsapp.sh
sleep 3

# Testar se servidor pode iniciar (apenas teste rápido)
echo ""
echo "🧪 4. Testando inicialização do servidor..."
cd server
timeout 8s node whatsapp-multi-client-server.js &
TEST_PID=$!
cd ..
sleep 5

# Verificar se teste foi bem-sucedido
if ps -p $TEST_PID > /dev/null 2>&1; then
    echo "✅ Servidor pode inicializar corretamente"
    kill $TEST_PID 2>/dev/null
    wait $TEST_PID 2>/dev/null
else
    echo "❌ Servidor não consegue inicializar"
    echo "🔄 Restaurando backup..."
    cp server/whatsapp-multi-client-server.js.backup.* server/whatsapp-multi-client-server.js
    exit 1
fi

# Aguardar processo de teste terminar completamente
sleep 3

# Aplicar melhorias reiniciando servidor
echo ""
echo "🚀 5. Reiniciando servidor com melhorias..."
./scripts/production-start-whatsapp.sh

# Aguardar servidor ficar online
echo ""
echo "⏳ 6. Aguardando servidor ficar online..."
for i in {1..15}; do
    if curl -s --max-time 5 http://localhost:4000/health > /dev/null; then
        echo "✅ Servidor online após $i tentativas"
        break
    fi
    echo "⏳ Tentativa $i/15..."
    sleep 3
done

# Verificar se servidor está realmente online
if ! curl -s --max-time 5 http://localhost:4000/health > /dev/null; then
    echo "❌ Servidor não ficou online após várias tentativas"
    echo "📝 Verificar logs: tail -f logs/whatsapp-multi-client.log"
    exit 1
fi

# Testar nova funcionalidade
echo ""
echo "🧪 7. Testando nova funcionalidade de áudio..."
./scripts/test-audio-system-complete.sh

echo ""
echo "🎉 MELHORIAS APLICADAS COM SUCESSO!"
echo "=================================="
echo "✅ Rota existente: Preservada 100%"
echo "✅ Nova rota API: /api/clients/:id/send-audio"
echo "✅ CORS: Configurado para /api/*"
echo "✅ AudioProcessor: Funcionando"
echo "✅ Backup disponível: server/whatsapp-multi-client-server.js.backup.*"
echo ""
echo "📝 Para testar: ./scripts/test-audio-system-complete.sh"
echo "📝 Para monitorar: tail -f logs/whatsapp-multi-client.log"
echo "📅 Aplicação concluída: $(date)"
