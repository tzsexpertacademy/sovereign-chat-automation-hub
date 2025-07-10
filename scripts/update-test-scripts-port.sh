#!/bin/bash

# Script para atualizar scripts de teste para usar porta 4000
echo "🔧 ATUALIZANDO SCRIPTS DE TESTE PARA PORTA 4000"
echo "==============================================="

cd /home/ubuntu/sovereign-chat-automation-hub

echo "🔍 Procurando scripts que usam porta 3001..."

# Lista de scripts que podem estar usando porta errada
SCRIPTS_TO_FIX=(
    "scripts/debug-api-routes.sh"
    "scripts/test-complete-system.sh"
    "scripts/restart-server-debug.sh"
    "scripts/test-endpoints-complete.sh"
    "scripts/validate-api-routes.sh"
)

for script in "${SCRIPTS_TO_FIX[@]}"; do
    if [ -f "$script" ]; then
        echo "🔧 Verificando $script..."
        
        # Verificar se contém referência à porta 3001
        if grep -q "3001" "$script"; then
            echo "   📝 Atualizando porta 3001 -> 4000 em $script"
            sed -i 's/3001/4000/g' "$script"
            echo "   ✅ Atualizado"
        else
            echo "   ✅ Já usa porta correta"
        fi
        
        # Verificar se contém referência ao localhost:3001
        if grep -q "localhost:3001" "$script"; then
            echo "   📝 Atualizando localhost:3001 -> localhost:4000 em $script"
            sed -i 's/localhost:3001/localhost:4000/g' "$script"
            echo "   ✅ Atualizado"
        fi
        
        # Verificar se contém referência ao 127.0.0.1:3001
        if grep -q "127.0.0.1:3001" "$script"; then
            echo "   📝 Atualizando 127.0.0.1:3001 -> 127.0.0.1:4000 em $script"
            sed -i 's/127.0.0.1:3001/127.0.0.1:4000/g' "$script"
            echo "   ✅ Atualizado"
        fi
    else
        echo "⚠️  Script $script não encontrado"
    fi
    echo ""
done

echo "🔍 Verificando se algum script ainda usa porta 3001..."
REMAINING=$(find scripts/ -name "*.sh" -exec grep -l "3001" {} \; 2>/dev/null)

if [ -n "$REMAINING" ]; then
    echo "⚠️  Scripts que ainda referenciam porta 3001:"
    echo "$REMAINING"
    echo ""
    echo "📝 Corrigindo automaticamente..."
    
    find scripts/ -name "*.sh" -exec sed -i 's/:3001/:4000/g' {} \;
    find scripts/ -name "*.sh" -exec sed -i 's/3001/4000/g' {} \;
    
    echo "✅ Correções aplicadas!"
else
    echo "✅ Nenhum script usa mais a porta 3001"
fi

echo ""
echo "🧪 TESTANDO PORTA CORRETA"
echo "========================="

echo "🔍 Verificando se servidor está na porta 4000..."
if netstat -tlnp | grep ":4000 " > /dev/null; then
    echo "✅ Servidor rodando na porta 4000"
    
    echo "🔍 Testando health check..."
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:4000/health")
    echo "   Status: $HEALTH_STATUS"
    
    if [ "$HEALTH_STATUS" = "200" ]; then
        echo "✅ Health check OK - Porta 4000 funcionando!"
    else
        echo "❌ Health check falhou na porta 4000"
    fi
else
    echo "❌ Servidor NÃO está rodando na porta 4000"
    echo "   Execute: ./scripts/restart-server-debug.sh"
fi

echo ""
echo "✅ ATUALIZAÇÃO DOS SCRIPTS CONCLUÍDA!"
echo "======================================"
echo "📋 Todos os scripts agora usam a porta 4000 correta"
echo "🚀 Próximo passo: ./scripts/apply-nginx-fix-and-validate.sh"