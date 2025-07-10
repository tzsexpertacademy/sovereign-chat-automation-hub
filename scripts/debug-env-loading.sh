#!/bin/bash

# Script para debug definitivo do problema .env
# Arquivo: scripts/debug-env-loading.sh

echo "🔍 DEBUG DEFINITIVO - CARREGAMENTO DO .env"
echo "=========================================="

echo ""
echo "📁 VERIFICANDO ARQUIVOS:"
echo "========================"

echo "🔍 Arquivo server/.env existe?"
if [ -f "server/.env" ]; then
    echo "✅ server/.env existe"
    echo "📋 Conteúdo do server/.env:"
    cat server/.env
else
    echo "❌ server/.env NÃO EXISTE!"
fi

echo ""
echo "🔍 Permissões do server/.env:"
ls -la server/.env

echo ""
echo "🔍 Verificando se o Node.js consegue ler o .env:"
echo "============================================="

cd server || exit 1

# Criar script de teste para verificar carregamento do .env
cat > test-env.js << 'EOF'
console.log('🔍 TESTE DE CARREGAMENTO DO .env');
console.log('================================');

console.log('📁 Diretório atual:', __dirname);
console.log('📁 Arquivo .env esperado:', require('path').join(__dirname, '.env'));

// Tentar carregar .env
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('');
console.log('📋 VARIÁVEIS DE AMBIENTE CARREGADAS:');
console.log('====================================');
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY (primeiros 20 chars):', process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.substring(0, 20) + '...' : 'UNDEFINED');
console.log('DEBUG:', process.env.DEBUG);

console.log('');
console.log('🧪 TESTE DO CONFIG.JS:');
console.log('======================');

const config = require('./modules/config.js');
console.log('Config carregado com sucesso!');
EOF

echo "🚀 Executando teste do Node.js..."
node test-env.js

echo ""
echo "🧹 Limpando arquivo de teste..."
rm test-env.js

cd ..

echo ""
echo "🔧 CORREÇÃO SUGERIDA:"
echo "====================="
echo "Se o .env não foi carregado corretamente, vamos:"
echo "1. Verificar se o dotenv está instalado"
echo "2. Corrigir o caminho do .env"
echo "3. Usar variáveis de ambiente diretas"

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "=================="
echo "Se as variáveis aparecerem como UNDEFINED, o problema é o carregamento do .env"
echo "Se aparecerem corretas, o problema é em outro lugar"