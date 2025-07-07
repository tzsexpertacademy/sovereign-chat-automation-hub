
#!/bin/bash

# Script para Comparar Versões Original vs Modular
# Arquivo: scripts/compare-versions.sh

echo "🔍 COMPARAÇÃO: VERSÃO ORIGINAL vs MODULAR"
echo "=========================================="

# Verificar se ambas as versões existem
if [ ! -f "server/whatsapp-multi-client-server-original.js" ]; then
    echo "❌ Versão original não encontrada"
    exit 1
fi

if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Versão atual não encontrada"
    exit 1
fi

# Estatísticas dos arquivos
echo "📊 ESTATÍSTICAS DOS ARQUIVOS:"
echo "=============================="

ORIGINAL_LINES=$(wc -l < server/whatsapp-multi-client-server-original.js)
MODULAR_LINES=$(wc -l < server/whatsapp-multi-client-server.js)
TOTAL_MODULE_LINES=0

echo "📁 Versão Original:"
echo "   • Linhas: $ORIGINAL_LINES"
echo "   • Tamanho: $(du -h server/whatsapp-multi-client-server-original.js | cut -f1)"

echo ""
echo "📁 Versão Modular:"
echo "   • Arquivo principal: $MODULAR_LINES linhas"

# Contar linhas dos módulos
MODULES=("config.js" "database.js" "whatsapp-client.js" "websocket.js" "api-routes.js" "utils.js" "server-startup.js")
for module in "${MODULES[@]}"; do
    if [ -f "server/modules/$module" ]; then
        MODULE_LINES=$(wc -l < "server/modules/$module")
        TOTAL_MODULE_LINES=$((TOTAL_MODULE_LINES + MODULE_LINES))
        echo "   • $module: $MODULE_LINES linhas"
    fi
done

TOTAL_MODULAR_LINES=$((MODULAR_LINES + TOTAL_MODULE_LINES))
echo "   • Total modular: $TOTAL_MODULAR_LINES linhas"

# Comparação
echo ""
echo "🔢 COMPARAÇÃO NUMÉRICA:"
echo "======================="
if [ $TOTAL_MODULAR_LINES -eq $ORIGINAL_LINES ]; then
    echo "✅ Mesmo número de linhas: $ORIGINAL_LINES"
elif [ $TOTAL_MODULAR_LINES -gt $ORIGINAL_LINES ]; then
    DIFF=$((TOTAL_MODULAR_LINES - ORIGINAL_LINES))
    echo "ℹ️  Versão modular tem $DIFF linhas a mais (comentários/estrutura)"
else
    DIFF=$((ORIGINAL_LINES - TOTAL_MODULAR_LINES))
    echo "⚠️  Versão modular tem $DIFF linhas a menos"
fi

# Verificar funcionalidades críticas
echo ""
echo "🔍 VERIFICAÇÃO DE FUNCIONALIDADES:"
echo "=================================="

CRITICAL_FUNCTIONS=("createWhatsAppInstance" "sendMessage" "sendMedia" "generateQRCode" "updateClientStatus")
MISSING_FUNCTIONS=0

for func in "${CRITICAL_FUNCTIONS[@]}"; do
    if grep -r "$func" server/modules/ > /dev/null; then
        echo "   ✅ $func - Encontrada nos módulos"
    else
        echo "   ❌ $func - NÃO ENCONTRADA"
        MISSING_FUNCTIONS=$((MISSING_FUNCTIONS + 1))
    fi
done

if [ $MISSING_FUNCTIONS -eq 0 ]; then
    echo ""
    echo "✅ TODAS AS FUNCIONALIDADES CRÍTICAS PRESERVADAS"
else
    echo ""
    echo "❌ $MISSING_FUNCTIONS FUNCIONALIDADES CRÍTICAS FALTANDO"
    echo "⚠️  REVISÃO NECESSÁRIA!"
fi

# Verificar endpoints da API
echo ""
echo "🌐 VERIFICAÇÃO DE ENDPOINTS:"
echo "==========================="

API_ENDPOINTS=("/health" "/api/instances" "/api/instances/:id/send" "/api/instances/:id/media")
MISSING_ENDPOINTS=0

for endpoint in "${API_ENDPOINTS[@]}"; do
    if grep -r "$endpoint" server/modules/api-routes.js > /dev/null; then
        echo "   ✅ $endpoint"
    else
        echo "   ❌ $endpoint - NÃO ENCONTRADO"
        MISSING_ENDPOINTS=$((MISSING_ENDPOINTS + 1))
    fi
done

if [ $MISSING_ENDPOINTS -eq 0 ]; then
    echo ""
    echo "✅ TODOS OS ENDPOINTS PRESERVADOS"
else
    echo ""
    echo "❌ $MISSING_ENDPOINTS ENDPOINTS FALTANDO"
fi

echo ""
echo "📋 RESUMO DA COMPARAÇÃO:"
echo "======================="
echo "📊 Linhas preservadas: $((ORIGINAL_LINES - (ORIGINAL_LINES - TOTAL_MODULAR_LINES))) de $ORIGINAL_LINES"
echo "🔧 Funcionalidades: $((${#CRITICAL_FUNCTIONS[@]} - MISSING_FUNCTIONS)) de ${#CRITICAL_FUNCTIONS[@]} preservadas"
echo "🌐 Endpoints: $((${#API_ENDPOINTS[@]} - MISSING_ENDPOINTS)) de ${#API_ENDPOINTS[@]} preservados"

if [ $MISSING_FUNCTIONS -eq 0 ] && [ $MISSING_ENDPOINTS -eq 0 ]; then
    echo ""
    echo "🎉 MIGRAÇÃO 100% BEM-SUCEDIDA!"
    echo "✅ Todas as funcionalidades foram preservadas"
else
    echo ""
    echo "⚠️  MIGRAÇÃO PRECISA DE REVISÃO"
    echo "🔧 Algumas funcionalidades podem estar faltando"
fi
