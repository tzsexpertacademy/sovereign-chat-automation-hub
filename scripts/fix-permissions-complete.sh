#!/bin/bash

echo "🔧 CORRIGINDO PERMISSÕES DE TODOS OS SCRIPTS"
echo "==========================================="

# Tornar todos os scripts executáveis
chmod +x scripts/*.sh

echo "✅ Permissões corrigidas para todos os scripts"

# Listar permissões atuais
echo ""
echo "📋 Permissões atuais dos scripts principais:"
ls -la scripts/production-*.sh scripts/quick-*.sh scripts/diagnose-*.sh scripts/monitor-*.sh 2>/dev/null || echo "Alguns scripts não encontrados"

echo ""
echo "🚀 Scripts prontos para execução!"