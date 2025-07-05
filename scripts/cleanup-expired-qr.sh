#!/bin/bash

# Script para limpeza automática de QR codes expirados
# Arquivo: scripts/cleanup-expired-qr.sh

echo "🧹 LIMPEZA DE QR CODES EXPIRADOS"
echo "================================"

# Verificar se curl está disponível
if ! command -v curl &> /dev/null; then
    echo "❌ curl não encontrado"
    exit 1
fi

API_BASE="https://146.59.227.248"

echo "🔍 Verificando QR codes expirados..."

# Testar conectividade
if ! curl -k -s "$API_BASE/health" > /dev/null; then
    echo "❌ Servidor não está respondendo"
    exit 1
fi

echo "✅ Servidor online"

# Executar limpeza via endpoint
echo "🧹 Executando limpeza de QR codes expirados..."

CLEANUP_RESULT=$(curl -k -s -X POST "$API_BASE/cleanup-expired-qr" | jq -r '.cleaned // 0' 2>/dev/null || echo "0")

if [[ "$CLEANUP_RESULT" =~ ^[0-9]+$ ]]; then
    if [ "$CLEANUP_RESULT" -gt 0 ]; then
        echo "✅ $CLEANUP_RESULT QR codes expirados foram limpos"
    else
        echo "ℹ️ Nenhum QR code expirado encontrado"
    fi
else
    echo "⚠️ Resultado da limpeza não é um número válido"
fi

echo ""
echo "🎉 Limpeza concluída!"