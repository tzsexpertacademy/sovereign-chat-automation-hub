
#!/bin/bash

# Script para correção sistemática das dependências
# Execute da pasta raiz: ./scripts/fix-dependencies.sh

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

# Limpar cache do npm
echo "🧹 Limpando cache do npm..."
npm cache clean --force

# Instalar dependências
echo "📦 Instalando dependências do servidor..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependências do servidor instaladas com sucesso"
else
    echo "❌ Erro ao instalar dependências do servidor"
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
        echo "✅ Dependências instaladas com --force"
    else
        echo "❌ Erro crítico na instalação do frontend"
        echo "🔄 Restaurando backup..."
        cp package.json.backup package.json
        exit 1
    fi
fi

# Limpeza final
echo ""
echo "🧹 LIMPEZA FINAL..."
echo "=================="

# Remover backups se tudo deu certo
rm -f package.json.backup server/package.json.backup

# Remover arquivos temporários
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true

# Limpar sessões antigas do WhatsApp
echo "🧹 Limpando sessões antigas do WhatsApp..."
rm -rf server/sessions/* 2>/dev/null || true
rm -rf server/.wwebjs_auth/* 2>/dev/null || true
rm -rf server/.wwebjs_cache/* 2>/dev/null || true

echo ""
echo "🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!"
echo "================================="
echo ""
echo "🚀 Próximos passos:"
echo "1. Reinicie o servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Conecte um cliente WhatsApp"
echo "3. Teste o envio de áudio"
echo ""
echo "🔧 Se houver problemas:"
echo "• Logs detalhados: tail -f logs/whatsapp-multi-client.log"
echo "• Status de áudio: curl http://localhost:4000/health"
echo "• Reiniciar: ./scripts/production-stop-whatsapp.sh && ./scripts/production-start-whatsapp.sh"
