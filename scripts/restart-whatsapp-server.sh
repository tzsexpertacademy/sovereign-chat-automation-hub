
#!/bin/bash

# Script para reiniciar servidor WhatsApp Multi-Cliente
# Arquivo: scripts/restart-whatsapp-server.sh

echo "🔄 Reiniciando Servidor WhatsApp Multi-Cliente..."

# Parar servidor
./stop-whatsapp-server.sh

# Aguardar um momento
sleep 2

# Iniciar servidor
./start-whatsapp-server.sh

echo "✅ Reinicialização concluída!"
