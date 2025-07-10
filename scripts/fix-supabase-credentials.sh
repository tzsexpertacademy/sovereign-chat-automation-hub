#!/bin/bash

# Script para correção urgente das credenciais Supabase
# Arquivo: scripts/fix-supabase-credentials.sh

echo "🔧 CORREÇÃO URGENTE - CREDENCIAIS SUPABASE"
echo "=========================================="

echo "🔍 Problema identificado: SERVICE_ROLE_KEY incorreta"
echo "✅ Credenciais corrigidas no arquivo .env"

echo ""
echo "🔄 REINICIANDO SERVIDOR COM CREDENCIAIS CORRETAS"
echo "==============================================="

# Parar servidor atual
echo "🛑 Parando servidor atual..."
./scripts/force-stop-whatsapp.sh

sleep 3

# Verificar se parou
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Servidor ainda rodando, forçando parada..."
    pkill -9 -f "whatsapp-multi-client-server"
    sleep 2
fi

echo "✅ Servidor parado"

# Iniciar servidor com novas credenciais
echo ""
echo "🚀 Iniciando servidor com credenciais corretas..."
./scripts/robust-start-whatsapp.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 CREDENCIAIS CORRIGIDAS COM SUCESSO!"
    echo "====================================="
    echo ""
    echo "✅ O erro 500 'Invalid API key' deve estar resolvido"
    echo "✅ Agora as instâncias WhatsApp devem conectar normalmente"
    echo ""
    echo "🧪 TESTE AGORA:"
    echo "1. Acesse: http://146.59.227.248:8080/admin/instances"
    echo "2. Clique em 'Conectar' em uma instância"
    echo "3. Deve funcionar sem erro 500"
    echo ""
    echo "📱 Se gerar QR Code, escaneie com WhatsApp para conectar"
else
    echo "❌ Falha ao reiniciar servidor"
    echo "💡 Verifique os logs: tail -f logs/whatsapp-multi-client.log"
fi

echo ""
echo "📅 Correção de credenciais concluída em: $(date)"