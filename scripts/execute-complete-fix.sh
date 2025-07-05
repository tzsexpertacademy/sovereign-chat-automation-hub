#!/bin/bash

echo "🚀 SOLUÇÃO COMPLETA DO PROBLEMA WHATSAPP"
echo "========================================"
echo ""

# Tornar scripts executáveis
chmod +x scripts/*.sh

echo "🔧 FASE 1: Corrigindo Puppeteer e Sessões"
echo "----------------------------------------"
./scripts/fix-puppeteer-sessions.sh

echo ""
echo "⏳ Aguardando servidor reinicializar (10s)..."
sleep 10

echo ""
echo "🧪 FASE 2: Testando Correções"
echo "-----------------------------"

echo "2.1) Health check do servidor:"
curl -s "https://146.59.227.248/health" | jq -r '.status // "offline"'

echo ""
echo "2.2) Listando clientes ativos:"
curl -s "https://146.59.227.248/clients" | jq -r 'length // 0' | xargs printf "Total de clientes: %s\n"

echo ""
echo "📋 INSTRUÇÕES PARA TESTE:"
echo "========================"
echo ""
echo "1️⃣ Vá para o painel admin: https://146.59.227.248:8080/admin/instances"
echo ""
echo "2️⃣ Crie uma nova instância WhatsApp"
echo ""
echo "3️⃣ Clique em 'Conectar' e aguarde o QR code aparecer"
echo ""
echo "4️⃣ Escaneie o QR code com seu WhatsApp"
echo ""
echo "5️⃣ Execute este comando para monitorar:"
echo "   ./scripts/monitor-connection-real-time.sh"
echo ""
echo "✅ RESULTADO ESPERADO:"
echo "   - Status muda automaticamente para 'connected'"
echo "   - Número do telefone aparece"
echo "   - Botão 'Ir para Chat' fica disponível"
echo ""
echo "🔍 Para debug detalhado, execute:"
echo "   ./scripts/debug-whatsapp-connection.sh"