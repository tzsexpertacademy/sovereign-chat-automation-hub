#!/bin/bash

# Script para diagnosticar erro 500 do servidor WhatsApp
# Arquivo: scripts/diagnose-server-error.sh

echo "🔍 DIAGNÓSTICO DO ERRO 500 - SERVIDOR WHATSAPP"
echo "=============================================="

DOMAIN="146.59.227.248"
INSTANCE_ID="206a06f2-5536-4be8-a653-cb5e997d1d0e_1752159789706"

echo "📋 Verificando saúde do servidor..."
HEALTH_RESPONSE=$(curl -s https://$DOMAIN/health)
echo "Health: $HEALTH_RESPONSE"

echo ""
echo "🔍 Testando endpoint de conexão..."
CONNECT_RESPONSE=$(curl -s -X POST https://$DOMAIN/clients/$INSTANCE_ID/connect \
  -H "Content-Type: application/json" \
  -H "Origin: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com" \
  2>&1)

echo "Connect Response: $CONNECT_RESPONSE"

echo ""
echo "📊 Verificando logs do servidor (últimas 20 linhas)..."
if [ -f "/var/log/whatsapp-multi-client.log" ]; then
    tail -20 /var/log/whatsapp-multi-client.log
else
    echo "⚠️ Log não encontrado em /var/log/whatsapp-multi-client.log"
fi

echo ""
echo "🔧 Verificando processo do servidor..."
ps aux | grep "whatsapp-multi-client" | grep -v grep

echo ""
echo "🌐 Verificando porta 4000..."
lsof -i :4000

echo ""
echo "📦 Verificando estrutura de módulos..."
ls -la server/modules/

echo ""
echo "🔐 Verificando arquivo .env (sem expor senhas)..."
if [ -f "server/.env" ]; then
    echo "✅ Arquivo .env existe"
    echo "Variáveis encontradas:"
    grep -E "^[A-Z_]+" server/.env | cut -d'=' -f1 | sort
else
    echo "❌ Arquivo .env não encontrado"
fi

echo ""
echo "📝 Recomendações:"
echo "1. Verificar se SUPABASE_SERVICE_ROLE_KEY está configurado"
echo "2. Confirmar se módulos estão carregando corretamente"
echo "3. Verificar logs de erro específicos do Supabase"
echo "4. Testar conectividade com banco de dados"