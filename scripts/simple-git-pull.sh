#!/bin/bash

echo "🔧 RESOLVENDO CONFLITO GIT SIMPLES"
echo "================================="

# Remover o arquivo .env que está causando conflito
echo "🗑️ Removendo server/.env temporariamente..."
rm -f server/.env

# Fazer git pull
echo "📥 Fazendo git pull..."
git pull origin main

# Verificar se deu certo
if [ $? -eq 0 ]; then
    echo "✅ Git pull bem-sucedido!"
    
    # Recriar .env
    echo "📝 Recriando server/.env..."
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
    
    echo "✅ Arquivo .env recriado com sucesso!"
    echo "🎯 Agora você pode aplicar as correções"
    
else
    echo "❌ Erro no git pull - verifique a conexão"
fi