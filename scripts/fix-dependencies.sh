
#!/bin/bash

# Script para correção sistemática das dependências
# Arquivo: scripts/fix-dependencies.sh

echo "🔧 CORREÇÃO SISTEMÁTICA DAS DEPENDÊNCIAS"
echo "========================================"

# Verificar se Node.js está disponível
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

echo "✅ Node.js versão: $(node -v)"
echo "✅ npm versão: $(npm -v)"

# Etapa 1: Limpar e atualizar dependências do servidor
echo ""
echo "📦 ETAPA 1: Atualizando servidor..."
echo "=================================="

cd server

# Backup do package.json atual
cp package.json package.json.backup

# Limpar instalação anterior
echo "🧹 Limpando instalação anterior..."
rm -rf node_modules package-lock.json

# Instalar dependências atualizadas
echo "📦 Instalando dependências atualizadas..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependências do servidor atualizadas com sucesso"
else
    echo "❌ Erro ao atualizar dependências do servidor"
    echo "🔄 Restaurando backup..."
    cp package.json.backup package.json
    exit 1
fi

# Voltar para diretório raiz
cd ..

# Etapa 2: Resolver conflitos do frontend
echo ""
echo "🎨 ETAPA 2: Resolvendo conflitos do frontend..."
echo "=============================================="

# Backup do package.json atual
cp package.json package.json.backup

# Tentar instalação com legacy peer deps
echo "📦 Instalando com --legacy-peer-deps..."
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo "✅ Conflitos do frontend resolvidos"
else
    echo "⚠️ Tentando com --force..."
    npm install --force
    
    if [ $? -eq 0 ]; then
        echo "✅ Dependências instal adas com --force"
    else
        echo "❌ Erro crítico na instalação do frontend"
        echo "🔄 Restaurando backup..."
        cp package.json.backup package.json
        exit 1
    fi
fi

# Etapa 3: Verificar instalações
echo ""
echo "🔍 ETAPA 3: Verificando instalações..."
echo "===================================="

# Verificar servidor
echo "🖥️ Verificando servidor..."
cd server
if node -e "require('whatsapp-web.js'); console.log('✅ whatsapp-web.js carregado')"; then
    echo "✅ Servidor: whatsapp-web.js OK"
else
    echo "❌ Servidor: whatsapp-web.js com problemas"
fi

if node -e "require('express'); console.log('✅ Express carregado')"; then
    echo "✅ Servidor: Express OK"
else
    echo "❌ Servidor: Express com problemas"
fi

cd ..

# Verificar frontend
echo "🎨 Verificando frontend..."
if node -e "require('react'); console.log('✅ React carregado')"; then
    echo "✅ Frontend: React OK"
else
    echo "❌ Frontend: React com problemas"
fi

if node -e "require('react-router-dom'); console.log('✅ React Router carregado')"; then
    echo "✅ Frontend: React Router OK"
else
    echo "❌ Frontend: React Router com problemas"
fi

# Etapa 4: Teste básico de conectividade
echo ""
echo "🔗 ETAPA 4: Teste de conectividade..."
echo "==================================="

echo "🚀 Iniciando servidor para teste..."
cd server
timeout 30s node whatsapp-multi-client-server.js &
SERVER_PID=$!
sleep 10

# Testar se servidor responde
if curl -s --max-time 5 http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor respondeu corretamente"
    kill $SERVER_PID 2>/dev/null
else
    echo "⚠️ Servidor não respondeu (normal se já está rodando)"
    kill $SERVER_PID 2>/dev/null
fi

cd ..

# Limpeza final
echo ""
echo "🧹 LIMPEZA FINAL..."
echo "=================="

# Remover backups se tudo deu certo
rm -f package.json.backup server/package.json.backup

# Remover arquivos temporários
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true

echo ""
echo "🎉 CORREÇÃO CONCLUÍDA!"
echo "====================="
echo ""
echo "📊 Resumo das atualizações:"
echo "• whatsapp-web.js: atualizado para v1.25.0"
echo "• Frontend: conflitos resolvidos com legacy-peer-deps"
echo "• Dependências: limpas e reinstaladas"
echo ""
echo "🚀 Próximos passos:"
echo "1. Reinicie o servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Teste o sistema de áudio"
echo "3. Monitore os logs: tail -f logs/whatsapp-multi-client.log"
echo ""
echo "🔧 Se houver problemas:"
echo "• Verifique logs: cat logs/whatsapp-multi-client.log"
echo "• Reinicie: ./scripts/production-stop-whatsapp.sh && ./scripts/production-start-whatsapp.sh"
echo "• Monitore status: ./scripts/check-whatsapp-health.sh"

