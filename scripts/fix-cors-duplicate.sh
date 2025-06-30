
#!/bin/bash

# Script para corrigir CORS duplicado no servidor Node.js
# Arquivo: scripts/fix-cors-duplicate.sh

echo "🔧 CORRIGINDO CORS DUPLICADO NO SERVIDOR NODE.JS"
echo "==============================================="

# Verificar se estamos no diretório correto
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    echo "❌ Execute este script da pasta raiz do projeto"
    exit 1
fi

# Backup do arquivo original
cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.js.backup

echo "✅ Backup criado: server/whatsapp-multi-client-server.js.backup"

# Reescrever apenas a seção CORS do servidor
echo "🔧 Corrigindo CORS duplicado no servidor..."

# Criar versão temporária com CORS corrigido
cat > /tmp/cors-fix.js << 'EOF'
// CORS Middleware ÚNICO - SEM DUPLICAÇÃO
app.use((req, res, next) => {
    const origin = req.get('origin');
    console.log(`🌐 ${req.method} ${req.url} - Origin: ${origin || 'none'}`);
    
    // Headers CORS ÚNICOS - NÃO DUPLICAR
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma');
    res.header('Access-Control-Allow-Credentials', 'false');
    res.header('Access-Control-Max-Age', '86400');
    
    // Para requisições OPTIONS, responder imediatamente
    if (req.method === 'OPTIONS') {
        console.log('✅ Respondendo preflight OPTIONS com CORS ÚNICO');
        res.status(200).end();
        return;
    }
    
    next();
});
EOF

echo "✅ Arquivo de correção CORS criado"
echo "⚠️ Para aplicar a correção, edite manualmente:"
echo "   server/whatsapp-multi-client-server.js"
echo "   e substitua a seção CORS pela versão em /tmp/cors-fix.js"
echo ""
echo "🚀 Depois execute:"
echo "   sudo ./scripts/setup-https-production-definitive.sh"
echo ""
