#!/bin/bash

# make-all-scripts-executable.sh - Tornar todos os scripts executáveis

echo "🔧 TORNANDO TODOS OS SCRIPTS EXECUTÁVEIS"
echo "========================================"

cd /home/ubuntu/sovereign-chat-automation-hub

echo "📁 Scripts encontrados:"
find scripts/ -name "*.sh" -type f | while read script; do
    echo "   📝 $script"
    chmod +x "$script"
done

echo ""
echo "✅ Todos os scripts estão executáveis"
echo ""
echo "🚀 Para executar a correção definitiva:"
echo "   ./scripts/execute-definitive-fix.sh"