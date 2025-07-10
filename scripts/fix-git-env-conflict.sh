#!/bin/bash

echo "🔧 RESOLVENDO CONFLITO GIT - ARQUIVO .env"
echo "========================================"

# Fazer backup do .env existente se houver
if [ -f "server/.env" ]; then
    echo "📋 Fazendo backup do .env existente..."
    cp server/.env server/.env.backup
    echo "✅ Backup salvo em server/.env.backup"
fi

# Remover arquivo .env para permitir git pull
echo "🗑️ Removendo arquivo .env temporariamente..."
rm -f server/.env

# Fazer git pull
echo "📥 Fazendo git pull..."
git pull origin main

# Verificar se o pull foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Git pull bem-sucedido!"
    
    # Recriar arquivo .env com credenciais corretas
    echo "📝 Recriando arquivo .env..."
    cat > server/.env << 'EOF'
# Configurações do WhatsApp Multi-Client Server
PORT=4000

# Configurações do Supabase
SUPABASE_URL=https://ymygyagbvbsdfkduxmgu.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.x9kJjmvyoGaB1e_tBfmSV8Z8eM6t_0WdGqF4_rMwKDI

# Configurações de Debug
DEBUG=true
LOG_LEVEL=debug
EOF
    
    echo "✅ Arquivo .env recriado com credenciais corretas"
    
    # Aplicar as correções
    echo "🚀 Aplicando correções do sistema..."
    chmod +x scripts/apply-surgical-fix.sh
    ./scripts/apply-surgical-fix.sh
    
else
    echo "❌ Erro no git pull"
    
    # Restaurar backup se o pull falhou
    if [ -f "server/.env.backup" ]; then
        echo "🔄 Restaurando backup do .env..."
        mv server/.env.backup server/.env
        echo "✅ Backup restaurado"
    fi
fi

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "   1. Verifique se o servidor está funcionando"
echo "   2. Teste criar uma nova instância"
echo "   3. Monitore os logs para debugging"