#!/bin/bash

echo "🔄 REINICIANDO SERVIDOR COM DEBUG APRIMORADO"
echo "==========================================="

echo "1️⃣ Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

echo "2️⃣ Aguardando 5 segundos..."
sleep 5

echo "3️⃣ Iniciando servidor com novos event listeners..."
./scripts/production-start-whatsapp.sh

echo "4️⃣ Aguardando inicialização (10 segundos)..."
sleep 10

echo "5️⃣ Testando conexão..."
curl -k -s "https://146.59.227.248/health" | jq '.'

echo ""
echo "✅ Servidor reiniciado com debug aprimorado!"
echo "🔍 Agora tente escanear o QR code novamente"
echo "📋 Monitor os logs com: ./scripts/monitor-puppeteer-detailed.sh 1751742471565"