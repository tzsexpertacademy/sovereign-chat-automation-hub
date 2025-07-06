
#!/bin/bash

# Script para executar a atualização
# Arquivo: scripts/run-update.sh

echo "🚀 Executando Atualização para Versões Mais Recentes"
echo "===================================================="

cd /home/ubuntu/sovereign-chat-automation-hub
sudo chmod +x scripts/update-to-latest-versions.sh
sudo ./scripts/update-to-latest-versions.sh
