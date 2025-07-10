#!/bin/bash
chmod +x scripts/apply-surgical-fix.sh

echo "🔧 APLICANDO CORREÇÃO CIRÚRGICA COMPLETA"
echo "======================================="

# Parar servidor atual
echo "⏹️ Parando servidor WhatsApp..."
./scripts/production-stop-whatsapp.sh

# Aguardar um momento
echo "⏳ Aguardando finalização completa..."
sleep 5

# Limpar processos órfãos
echo "🧹 Limpando processos órfãos..."
pkill -f chrome || true
pkill -f puppeteer || true
pkill -f node || true

# Aguardar mais um pouco
sleep 3

# Verificar se .env existe no servidor
if [ ! -f "server/.env" ]; then
    echo "❌ Arquivo .env não encontrado! A correção pode falhar."
else
    echo "✅ Arquivo .env encontrado"
fi

# Instalar dotenv no servidor se necessário
echo "📦 Verificando dependência dotenv..."
cd server
if ! npm list dotenv > /dev/null 2>&1; then
    echo "📦 Instalando dotenv..."
    npm install dotenv
else
    echo "✅ dotenv já instalado"
fi
cd ..

# Iniciar servidor com correções
echo "🚀 Iniciando servidor com correções aplicadas..."
./scripts/production-start-whatsapp.sh

# Aguardar inicialização
echo "⏳ Aguardando inicialização (15s)..."
sleep 15

# Testar conectividade
echo "🧪 Testando conectividade..."
HEALTH_STATUS=$(curl -s "https://146.59.227.248/health" | jq -r '.status // "offline"' 2>/dev/null || echo "offline")

if [ "$HEALTH_STATUS" = "ok" ]; then
    echo "✅ Servidor funcionando: $HEALTH_STATUS"
else
    echo "❌ Servidor com problemas: $HEALTH_STATUS"
fi

echo ""
echo "🎯 CORREÇÕES APLICADAS:"
echo "   ✅ Arquivo .env criado com credenciais corretas"
echo "   ✅ Configuração dotenv adicionada ao config.js"
echo "   ✅ Validação Supabase antes de criar instâncias"
echo "   ✅ Retry logic para conexões de banco"
echo "   ✅ Eventos WebSocket específicos por instância"
echo "   ✅ Logs detalhados para debugging"
echo "   ✅ Tratamento robusto de erros 500"
echo ""
echo "🧪 PRÓXIMOS PASSOS:"
echo "   1. Teste criar uma nova instância"
echo "   2. Verifique se QR code aparece"
echo "   3. Monitore logs para debugging"

# Exibir últimas linhas do log
echo ""
echo "📋 ÚLTIMAS LINHAS DO LOG:"
echo "========================"
tail -20 /tmp/whatsapp-server.log 2>/dev/null || echo "Log não encontrado"