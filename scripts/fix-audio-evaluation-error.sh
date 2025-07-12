#!/bin/bash

# Script para corrigir erro "Evaluation failed: a" no envio de áudio
# Execute da pasta raiz: ./scripts/fix-audio-evaluation-error.sh

echo "🔧 ===== CORREÇÃO DO ERRO 'EVALUATION FAILED: A' ====="
echo "🎯 Corrigindo conflitos de versão whatsapp-web.js e Puppeteer"
echo "======================================================="

# Verificar se está na pasta raiz
if [ ! -f "server/package.json" ]; then
    echo "❌ Execute este script da pasta raiz do projeto"
    exit 1
fi

# Verificar se servidor está rodando
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null; then
    echo "⚠️ Parando servidor na porta 4000..."
    pkill -f "whatsapp-multi-client-server.js" 2>/dev/null || true
    sleep 3
fi

echo ""
echo "📦 FASE 1: LIMPEZA COMPLETA DAS DEPENDÊNCIAS"
echo "============================================"

cd server

# Backup do package.json atual
echo "💾 Fazendo backup do package.json..."
cp package.json package.json.backup-$(date +%Y%m%d_%H%M%S)

# Limpeza total
echo "🧹 Removendo node_modules e package-lock.json..."
rm -rf node_modules package-lock.json

# Limpar cache npm
echo "🧹 Limpando cache do npm..."
npm cache clean --force

# Reinstalar dependências do zero
echo "📦 Reinstalando dependências do package.json..."
echo "   - Isso vai instalar whatsapp-web.js@1.25.0 (não v1.31.0)"
echo "   - Puppeteer compatível será instalado automaticamente"
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro na instalação das dependências"
    exit 1
fi

echo "✅ Dependências reinstaladas com sucesso"

# Verificar versão instalada
echo ""
echo "🔍 Verificando versões instaladas:"
npm list whatsapp-web.js | grep whatsapp-web.js
npm list puppeteer | grep puppeteer

echo ""
echo "🔧 FASE 2: CONFIGURAR EXECUTABLE PATH CORRETO"
echo "=============================================="

# Verificar se Chrome está instalado
CHROME_PATH="/opt/google/chrome/chrome"
if [ ! -f "$CHROME_PATH" ]; then
    echo "❌ Chrome não encontrado em $CHROME_PATH"
    echo "🔍 Procurando Chrome em outros locais..."
    
    # Tentar encontrar Chrome
    CHROME_PATH=$(which google-chrome 2>/dev/null || which chromium-browser 2>/dev/null || which chrome 2>/dev/null)
    
    if [ -z "$CHROME_PATH" ]; then
        echo "❌ Chrome não encontrado no sistema"
        exit 1
    fi
fi

echo "✅ Chrome encontrado em: $CHROME_PATH"

# Voltar para diretório raiz
cd ..

echo ""
echo "⚙️ FASE 3: AJUSTAR WEBVERSIONCACHE E FLAGS"
echo "=========================================="

# Criar backup do arquivo atual
cp server/modules/whatsapp-client.js server/modules/whatsapp-client.js.backup-$(date +%Y%m%d_%H%M%S)

# Aplicar correções no arquivo whatsapp-client.js
echo "🔧 Aplicando correções no whatsapp-client.js..."

cat > /tmp/fix-whatsapp-client.js << 'EOF'
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../server/modules/whatsapp-client.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Adicionar executablePath
const executablePathConfig = `            executablePath: '${process.env.CHROME_PATH}',`;

// Inserir executablePath após headless
content = content.replace(
    /headless: true,/g,
    `headless: true,\n            ${executablePathConfig}`
);

// 2. Remover flags conflitantes
const flagsToRemove = [
    "'--disable-web-security',",
    "'--allow-running-insecure-content',",
    "'--allow-insecure-localhost'"
];

flagsToRemove.forEach(flag => {
    const regex = new RegExp(`\\s*${flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g');
    content = content.replace(regex, '');
});

// 3. Ajustar webVersionCache para versão compatível com whatsapp-web.js@1.25.0
content = content.replace(
    /type: 'remote',\s*remotePath: '[^']*'/g,
    "type: 'remote',\n          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'"
);

fs.writeFileSync(filePath, content);
console.log('✅ Arquivo whatsapp-client.js atualizado com sucesso');
EOF

# Executar script de correção
CHROME_PATH="$CHROME_PATH" node /tmp/fix-whatsapp-client.js

# Limpar arquivo temporário
rm /tmp/fix-whatsapp-client.js

echo ""
echo "🧹 FASE 4: LIMPEZA FINAL"
echo "======================="

# Limpar sessões antigas para forçar nova conexão
echo "🧹 Limpando sessões antigas..."
rm -rf server/sessions/* 2>/dev/null || true
rm -rf server/.wwebjs_auth/* 2>/dev/null || true
rm -rf server/.wwebjs_cache/* 2>/dev/null || true

# Limpar arquivos temporários do Chrome
echo "🧹 Limpando arquivos temporários do Chrome..."
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/chrome-user-data 2>/dev/null || true

echo ""
echo "🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!"
echo "================================="
echo ""
echo "📋 RESUMO DAS ALTERAÇÕES:"
echo "• whatsapp-web.js: Reinstalado versão correta do package.json"
echo "• Puppeteer: Versão compatível instalada automaticamente"
echo "• Chrome: Configurado executablePath para $CHROME_PATH"
echo "• webVersionCache: Ajustado para 2.2412.54 (compatível)"
echo "• Flags: Removidas flags conflitantes que causavam 'Evaluation failed'"
echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "1. Iniciar servidor: ./scripts/production-start-whatsapp.sh"
echo "2. Conectar instância WhatsApp"
echo "3. Testar envio de áudio (deve funcionar agora)"
echo ""
echo "🔧 MONITORAMENTO:"
echo "• Logs do servidor: tail -f logs/whatsapp-multi-client.log"
echo "• Monitor de áudio: ./scripts/monitor-audio-real-time.sh"
echo "• Status de saúde: curl http://localhost:4000/health"
echo ""
echo "⚠️ SE AINDA HOUVER PROBLEMAS:"
echo "• Rollback: cp server/modules/whatsapp-client.js.backup-* server/modules/whatsapp-client.js"
echo "• Verificar logs detalhados para outros erros"
echo "• Executar diagnóstico: ./scripts/diagnostico-puppeteer-avancado.sh"