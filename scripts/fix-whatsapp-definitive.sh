#!/bin/bash

# Script definitivo para corrigir sistema WhatsApp Multi-Cliente
# Execute: ./scripts/fix-whatsapp-definitive.sh

echo "🔧 CORREÇÃO DEFINITIVA - WHATSAPP MULTI-CLIENTE"
echo "=============================================="

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script da pasta raiz do projeto"
    exit 1
fi

echo "📂 Diretório atual: $(pwd)"
echo "👤 Usuário atual: $(whoami)"

# 1. Diagnóstico inicial
echo ""
echo "🔍 1. DIAGNÓSTICO INICIAL"
echo "========================"
./scripts/diagnose-port-conflicts.sh

# 2. Parada forçada de tudo
echo ""
echo "🛑 2. PARADA FORÇADA DE TODOS OS PROCESSOS"
echo "========================================="
./scripts/force-stop-whatsapp.sh

# 3. Verificar se realmente parou
echo ""
echo "🔍 3. VERIFICAÇÃO PÓS-PARADA"
echo "============================"
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ CRÍTICO: Porta 4000 ainda ocupada após parada forçada!"
    echo "📋 Processos restantes:"
    lsof -Pi :4000 -sTCP:LISTEN 2>/dev/null
    echo ""
    echo "🆘 AÇÃO MANUAL NECESSÁRIA:"
    echo "1. Identifique o processo: lsof -Pi :4000"
    echo "2. Termine manualmente: sudo kill -9 <PID>"
    echo "3. Execute este script novamente"
    exit 1
else
    echo "✅ Porta 4000 está livre - continuando..."
fi

# 4. Verificar dependências
echo ""
echo "📦 4. VERIFICAÇÃO DE DEPENDÊNCIAS"
echo "================================="

# Verificar Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js não encontrado!"
    exit 1
fi

echo "✅ Node.js: $(node --version)"

# Verificar dependências do Puppeteer
echo ""
echo "🔍 4.1. TESTANDO DEPENDÊNCIAS PUPPETEER"
echo "======================================"
if [ -f "./scripts/test-puppeteer-dependencies.sh" ]; then
    chmod +x ./scripts/test-puppeteer-dependencies.sh
    if ! ./scripts/test-puppeteer-dependencies.sh; then
        echo ""
        echo "❌ DEPENDÊNCIAS DO PUPPETEER COM PROBLEMAS"
        echo "=========================================="
        echo ""
        echo "💡 Deseja tentar corrigir automaticamente? (s/N)"
        read -r -n 1 -t 30 response
        echo ""
        
        if [[ "$response" =~ ^[Ss]$ ]]; then
            echo "🔧 Executando correção automática..."
            chmod +x ./scripts/fix-puppeteer-dependencies.sh
            if sudo ./scripts/fix-puppeteer-dependencies.sh; then
                echo "✅ Dependências corrigidas com sucesso!"
            else
                echo "❌ Falha na correção automática"
                echo "💡 Você pode tentar corrigir manualmente ou continuar"
                echo "   Pressione Enter para continuar ou Ctrl+C para cancelar"
                read -r
            fi
        else
            echo "⚠️ Continuando sem corrigir dependências..."
            echo "💡 Isso pode causar falhas na criação de instâncias WhatsApp"
        fi
    else
        echo "✅ Dependências do Puppeteer OK"
    fi
else
    echo "⚠️ Script de teste do Puppeteer não encontrado"
fi

# Verificar dependências do servidor
cd server
if [ ! -d "node_modules" ] || [ ! -f "node_modules/dotenv/package.json" ]; then
    echo "📦 Dependências do servidor incompletas, instalando..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Falha ao instalar dependências do servidor"
        exit 1
    fi
fi

# Verificar dotenv especificamente
if ! npm list dotenv >/dev/null 2>&1; then
    echo "📦 Instalando dotenv..."
    npm install dotenv
fi

echo "✅ Dependências do servidor verificadas"

# Verificar .env
if [ ! -f ".env" ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "📝 Criando .env básico..."
    cat > .env << EOF
SUPABASE_URL=https://ymygyagbvbsdfkduxmgu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY
NODE_ENV=production
PORT=4000
EOF
fi

echo "✅ Arquivo .env verificado"
cd ..

# 5. Corrigir permissões
echo ""
echo "🔐 5. CORREÇÃO DE PERMISSÕES"
echo "============================"
chmod +x scripts/*.sh
echo "✅ Permissões dos scripts corrigidas"

# 6. Iniciar servidor com novo método robusto
echo ""
echo "🚀 6. INICIANDO SERVIDOR COM MÉTODO ROBUSTO"
echo "=========================================="
./scripts/robust-start-whatsapp.sh

# Verificar se realmente funcionou
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CORREÇÃO DEFINITIVA CONCLUÍDA COM SUCESSO!"
    echo "============================================="
    echo ""
    echo "🎯 PRÓXIMOS PASSOS:"
    echo "1. Teste criar uma nova instância WhatsApp"
    echo "2. Verifique se o erro 500 foi resolvido"
    echo "3. Monitore os logs: tail -f logs/whatsapp-multi-client.log"
    echo ""
    echo "🔗 URLs para testar:"
    echo "• Admin: http://146.59.227.248:8080/admin/instances"
    echo "• API: http://146.59.227.248:4000/api-docs"
    echo "• Health: http://146.59.227.248:4000/health"
    
else
    echo ""
    echo "❌ CORREÇÃO FALHOU"
    echo "=================="
    echo ""
    echo "🔍 Diagnóstico pós-falha:"
    ./scripts/diagnose-port-conflicts.sh
    echo ""
    echo "📝 Últimas linhas do log:"
    tail -20 logs/whatsapp-multi-client.log 2>/dev/null || echo "Log não encontrado"
fi

echo ""
echo "📅 Correção executada em: $(date)"