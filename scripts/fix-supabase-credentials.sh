#!/bin/bash

# Script para corrigir credenciais do Supabase
# Arquivo: scripts/fix-supabase-credentials.sh

echo "🔐 CORREÇÃO DAS CREDENCIAIS SUPABASE"
echo "===================================="

cd server

# Criar arquivo .env com credenciais corretas
echo "📝 Criando arquivo .env com credenciais do Supabase..."

cat > .env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://ymygyagbvbsdfkduxmgu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.0FhNbKFTeTYJfK-K5m-yjvNJRYkm-LHPsrY2J5Ek6rY

# Server Configuration
PORT=4000
NODE_ENV=production

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./sessions
WHATSAPP_MAX_RETRIES=3
EOF

echo "✅ Arquivo .env criado com credenciais do Supabase"

# Verificar se o arquivo foi criado corretamente
if [ -f ".env" ]; then
    echo "📋 Variáveis configuradas:"
    grep -E "^[A-Z_]+" .env | cut -d'=' -f1 | sort
else
    echo "❌ Erro ao criar arquivo .env"
    exit 1
fi

echo ""
echo "🔧 Reiniciando servidor com novas credenciais..."
cd ..

# Parar servidor atual
./scripts/production-stop-whatsapp.sh

echo ""
echo "⏳ Aguardando 3 segundos..."
sleep 3

# Iniciar servidor
./scripts/production-start-whatsapp.sh

echo ""
echo "✅ Credenciais do Supabase corrigidas e servidor reiniciado"
echo "🎯 Teste a conexão de instâncias agora"