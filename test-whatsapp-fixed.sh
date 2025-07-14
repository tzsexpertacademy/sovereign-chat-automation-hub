#!/bin/bash

echo "🔧 TESTE WHATSAPP CORRIGIDO"
echo "============================"

# Parar servidor
echo "1. Parando servidor..."
./scripts/production-stop-whatsapp.sh

# Aguardar
echo "2. Aguardando 5 segundos..."
sleep 5

# Iniciar servidor
echo "3. Iniciando servidor..."
./scripts/production-start-whatsapp.sh

# Aguardar inicialização
echo "4. Aguardando inicialização..."
sleep 10

# Testar health
echo "5. Testando health check..."
curl -s http://146.59.227.248:4000/health

echo ""
echo "6. Testando endpoint send com ID real..."

# Usar o ID real da instância
INSTANCE_ID="35f36a03-39b2-412c-bba6-01fdd45c2dd3_1752506640518"

curl -X POST http://146.59.227.248:4000/api/clients/$INSTANCE_ID/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "554796451886@c.us", 
    "message": "Teste servidor corrigido"
  }'

echo ""
echo "✅ Teste concluído!"