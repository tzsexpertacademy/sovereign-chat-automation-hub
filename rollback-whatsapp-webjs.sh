#!/bin/bash

# SCRIPT DE ROLLBACK - WhatsApp Web.js
# Volta para versão 1.21.0 em caso de problemas

echo "🔄 INICIANDO ROLLBACK PARA WHATSAPP-WEB.JS 1.21.0"
echo "================================================"

# Parar servidor
echo "🛑 Parando servidor..."
cd server
npm run stop 2>/dev/null || pkill -f whatsapp-multi-client-server.js 2>/dev/null
sleep 3

# Restaurar package.json
echo "📦 Restaurando package.json..."
latest_backup=$(ls -t server/package.json.backup.* 2>/dev/null | head -n1)
if [ -n "$latest_backup" ]; then
    cp "$latest_backup" server/package.json
    echo "✅ package.json restaurado de $latest_backup"
else
    # Fallback manual
    cat > server/package.json << 'EOF'
{
  "name": "whatsapp-multi-client-backend",
  "version": "1.0.0",
  "description": "Backend para sistema WhatsApp Multi-Cliente",
  "main": "whatsapp-multi-client-server.js",
  "scripts": {
    "start": "node whatsapp-multi-client-server.js",
    "dev": "nodemon whatsapp-multi-client-server.js",
    "stop": "pkill -f whatsapp-multi-client-server.js",
    "restart": "npm run stop && npm run start",
    "clean-install": "rm -rf node_modules package-lock.json && npm install"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "cors": "^2.8.5",
    "whatsapp-web.js": "1.21.0",
    "qrcode": "^1.5.3",
    "multer": "^1.4.5-lts.1",
    "express-fileupload": "^1.4.0",
    "uuid": "^9.0.1",
    "mime-types": "^2.1.35",
    "fs": "^0.0.1-security",
    "path": "^0.12.7",
    "http": "^0.0.1-security",
    "swagger-ui-express": "^5.0.0",
    "swagger-jsdoc": "^6.2.8",
    "@supabase/supabase-js": "^2.50.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "keywords": ["whatsapp", "multi-client", "saas", "nodejs"],
  "author": "TZS Expert Academy",
  "license": "MIT"
}
EOF
    echo "✅ package.json restaurado (fallback manual)"
fi

# Reinstalar dependências
echo "📥 Reinstalando whatsapp-web.js 1.21.0..."
rm -rf node_modules package-lock.json
npm install

# Verificar instalação
echo "🧪 Verificando instalação..."
node -e "
    const pkg = require('./node_modules/whatsapp-web.js/package.json');
    console.log('📋 Versão instalada:', pkg.version);
    if (pkg.version === '1.21.0') {
        console.log('✅ Rollback para 1.21.0 concluído com sucesso!');
    } else {
        console.log('⚠️  Versão não é 1.21.0, mas instalação parece OK');
    }
"

# Reiniciar servidor
echo "🚀 Reiniciando servidor..."
npm start &
sleep 5

if pgrep -f whatsapp-multi-client-server.js > /dev/null; then
    echo ""
    echo "✅ ROLLBACK CONCLUÍDO COM SUCESSO!"
    echo "================================="
    echo "✅ whatsapp-web.js voltou para versão 1.21.0"
    echo "✅ Servidor reiniciado"
    echo ""
    echo "⚠️  Sistema voltou ao estado anterior"
    echo "   Problemas conhecidos da 1.21.0 podem retornar"
else
    echo "❌ Falha ao reiniciar servidor após rollback"
    echo "🆘 Verifique logs e tente iniciar manualmente"
fi

echo "🔄 Script de rollback finalizado!"