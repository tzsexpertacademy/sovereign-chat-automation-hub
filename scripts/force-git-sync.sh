#!/bin/bash

echo "🔄 SINCRONIZAÇÃO FORÇADA COM GIT - COPIA TUDO"
echo "============================================="

# Fazer backup completo do .env se existir
if [ -f "server/.env" ]; then
    echo "💾 Fazendo backup do .env..."
    cp server/.env /tmp/env_backup_$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup salvo em /tmp/"
fi

# Stash qualquer alteração local
echo "📦 Salvando alterações locais..."
git stash push -m "backup_antes_sync_$(date +%Y%m%d_%H%M%S)"

# Limpar arquivos não rastreados que podem causar conflito
echo "🧹 Limpando arquivos não rastreados..."
git clean -fd

# Resetar para o estado limpo
echo "🔄 Resetando para estado limpo..."
git reset --hard HEAD

# Fazer fetch de todas as atualizações
echo "📥 Buscando todas as atualizações..."
git fetch --all

# Forçar pull da branch main
echo "⬇️ Forçando pull da branch main..."
git reset --hard origin/main
git pull origin main --force

# Verificar se deu certo
if [ $? -eq 0 ]; then
    echo "✅ Sincronização forçada bem-sucedida!"
    
    # Recriar .env com credenciais corretas
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
    
    echo "✅ Arquivo .env recriado"
    
    # Instalar dependências se necessário
    echo "📦 Verificando dependências..."
    cd server
    if [ -f "package.json" ]; then
        npm install
    fi
    cd ..
    
    # Tornar scripts executáveis
    echo "🔧 Tornando scripts executáveis..."
    chmod +x scripts/*.sh
    
    # Aplicar correções
    echo "🚀 Aplicando correções do sistema..."
    if [ -f "scripts/apply-surgical-fix.sh" ]; then
        ./scripts/apply-surgical-fix.sh
    else
        echo "⚠️ Script de correção não encontrado - aplicando manualmente..."
        ./scripts/production-stop-whatsapp.sh
        sleep 3
        ./scripts/production-start-whatsapp.sh
    fi
    
else
    echo "❌ Erro na sincronização forçada"
    echo "🔄 Tentando restaurar estado anterior..."
    git stash pop 2>/dev/null || echo "Nenhum stash para restaurar"
fi

echo ""
echo "📊 STATUS FINAL:"
echo "Git branch: $(git branch --show-current)"
echo "Último commit: $(git log -1 --oneline)"
echo ""
echo "🎯 TESTE AGORA:"
echo "   curl -s https://146.59.227.248/health | jq"