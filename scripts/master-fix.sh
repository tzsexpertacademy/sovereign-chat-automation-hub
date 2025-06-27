
#!/bin/bash

# Script master para correção completa do sistema
# Arquivo: scripts/master-fix.sh

echo "🚀 CORREÇÃO COMPLETA DO SISTEMA WHATSAPP"
echo "========================================"

# Tornar todos os scripts executáveis
chmod +x scripts/*.sh

# Passo 1: Parar servidor atual
echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

# Passo 2: Corrigir dependências
echo ""
echo "🔧 Corrigindo dependências..."
./scripts/fix-dependencies.sh

if [ $? -ne 0 ]; then
    echo "❌ Falha na correção das dependências"
    exit 1
fi

# Passo 3: Reiniciar servidor
echo ""
echo "🚀 Reiniciando servidor..."
./scripts/production-start-whatsapp.sh

# Aguardar servidor inicializar
sleep 15

# Passo 4: Diagnosticar sistema de áudio
echo ""
echo "🎵 Diagnosticando sistema de áudio..."
./scripts/diagnose-audio-issues.sh

echo ""
echo "🎉 CORREÇÃO COMPLETA FINALIZADA!"
echo "==============================="
echo ""
echo "📊 Status do sistema:"
echo "• Dependências: Atualizadas"
echo "• Servidor: $(curl -s --max-time 5 http://localhost:4000/health > /dev/null && echo 'Online' || echo 'Offline')"
echo "• Áudio: Testado (veja resultado acima)"
echo ""
echo "🔍 Para monitorar:"
echo "• Logs: tail -f logs/whatsapp-multi-client.log"
echo "• Status: ./scripts/check-whatsapp-health.sh"
echo "• Parar: ./scripts/production-stop-whatsapp.sh"

