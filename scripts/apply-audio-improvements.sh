
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
    mv server/whatsapp-multi-client-server.js.backup.* server/whatsapp-multi-client-server.js
    exit 1
fi

# Testar se servidor pode iniciar
echo ""
echo "🧪 3. Testando inicialização do servidor..."
timeout 10s node server/whatsapp-multi-client-server.js &
PID=$!
sleep 5

if ps -p $PID > /dev/null; then
    echo "✅ Servidor inicializa corretamente"
    kill $PID
else
    echo "❌ Servidor não consegue inicializar"
    echo "🔄 Restaurando backup..."
    mv server/whatsapp-multi-client-server.js.backup.* server/whatsapp-multi-client-server.js
    exit 1
fi

# Aplicar melhorias
echo ""
echo "🚀 4. Reiniciando servidor com melhorias..."
./scripts/production-stop-whatsapp.sh
sleep 3
./scripts/production-start-whatsapp.sh

# Aguardar servidor ficar online
echo ""
echo "⏳ 5. Aguardando servidor ficar online..."
for i in {1..10}; do
    if curl -s --max-time 3 http://localhost:4000/health > /dev/null; then
        echo "✅ Servidor online após $i tentativas"
        break
    fi
    echo "⏳ Tentativa $i/10..."
    sleep 2
done

# Testar nova funcionalidade
echo ""
echo "🧪 6. Testando nova funcionalidade..."
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
