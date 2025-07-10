#!/bin/bash

echo "🚀 EXECUTANDO CORREÇÃO DEFINITIVA DAS CHAVES SUPABASE"
echo "====================================================="

# Tornar scripts executáveis
chmod +x scripts/execute-final-sync.sh
chmod +x scripts/test-supabase-final.sh

# Executar sincronização final
./scripts/execute-final-sync.sh

echo ""
echo "🏁 CORREÇÃO CONCLUÍDA!"
echo "====================="
echo "📋 Execute: tail -f logs/sync-final.log (para monitorar)"
echo "🌐 Teste: http://localhost:4000/health"
echo "⚡ Admin: /admin/instances"