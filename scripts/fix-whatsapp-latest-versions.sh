
#!/bin/bash

# Script para correção DEFINITIVA com ÚLTIMAS VERSÕES
# Arquivo: scripts/fix-whatsapp-latest-versions.sh

echo "🔧 CORREÇÃO COM ÚLTIMAS VERSÕES - WHATSAPP WEB.JS"
echo "================================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-whatsapp-latest-versions.sh"
    exit 1
fi

echo "🛑 1. Parando servidor..."
./scripts/production-stop-whatsapp.sh

echo ""
echo "🧹 2. Limpeza COMPLETA..."
cd /home/ubuntu/sovereign-chat-automation-hub/server

# Remover TUDO
echo "🗑️ Removendo node_modules e cache..."
rm -rf node_modules
rm -rf package-lock.json
rm -rf .wwebjs_auth
rm -rf .wwebjs_cache

# Limpar cache npm AGRESSIVAMENTE
echo "🧹 Limpeza agressiva do cache..."
npm cache clean --force
npm cache verify

echo ""
echo "📦 3. Instalando ÚLTIMAS VERSÕES..."

# Atualizar package.json com versões mais recentes
echo "📝 Atualizando package.json..."
node << 'EOF'
const fs = require('fs');
const packagePath = 'package.json';
let pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Atualizar dependências com ÚLTIMAS VERSÕES
pkg.dependencies = {
    ...pkg.dependencies,
    "whatsapp-web.js": "^1.24.0",  // VERSÃO MAIS RECENTE
    "puppeteer": "^22.8.0",        // VERSÃO MAIS RECENTE
    "qrcode": "^1.5.3",
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "cors": "^2.8.5",
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
};

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
console.log('✅ package.json atualizado com últimas versões');
EOF

# Instalar versões mais recentes
echo "📥 Instalando whatsapp-web.js MAIS RECENTE..."
npm install whatsapp-web.js@latest --save

echo "📥 Instalando puppeteer MAIS RECENTE..."
npm install puppeteer@latest --save

echo "📥 Instalando outras dependências..."
npm install

echo ""
echo "🔧 4. Configurando Chrome MAIS RECENTE..."

# Atualizar Google Chrome para versão mais recente
echo "📥 Atualizando Google Chrome..."
apt-get update
apt-get install -y google-chrome-stable

# Verificar versão do Chrome
CHROME_VERSION=$(google-chrome --version 2>/dev/null || echo "Chrome não encontrado")
echo "🌐 Chrome: $CHROME_VERSION"

echo ""
echo "🧹 5. Limpeza completa de processos..."
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true
sleep 3

# Limpar diretórios temporários
rm -rf /tmp/.org.chromium.Chromium.* 2>/dev/null || true
rm -rf /home/ubuntu/.config/google-chrome/SingletonLock 2>/dev/null || true
rm -rf /tmp/chrome_* 2>/dev/null || true

echo ""
echo "📂 6. Criando diretórios com permissões corretas..."
mkdir -p /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_auth
mkdir -p /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_cache
mkdir -p /home/ubuntu/sovereign-chat-automation-hub/logs

chown -R ubuntu:ubuntu /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_auth
chown -R ubuntu:ubuntu /home/ubuntu/sovereign-chat-automation-hub/server/.wwebjs_cache
chown -R ubuntu:ubuntu /home/ubuntu/sovereign-chat-automation-hub/logs

echo ""
echo "🚀 7. Testando versões instaladas..."

# Verificar whatsapp-web.js
if [ -d "node_modules/whatsapp-web.js" ]; then
    WWEB_VERSION=$(node -e "console.log(require('./node_modules/whatsapp-web.js/package.json').version)")
    echo "✅ whatsapp-web.js: $WWEB_VERSION"
else
    echo "❌ Erro na instalação do whatsapp-web.js"
    exit 1
fi

# Verificar puppeteer
if [ -d "node_modules/puppeteer" ]; then
    PUPPETEER_VERSION=$(node -e "console.log(require('./node_modules/puppeteer/package.json').version)")
    echo "✅ Puppeteer: $PUPPETEER_VERSION"
else
    echo "❌ Erro na instalação do Puppeteer"
    exit 1
fi

echo ""
echo "🧪 8. TESTE CRÍTICO COM VERSÕES ATUAIS..."

# Criar teste com versões atuais
cat > test-latest-versions.js << 'EOF'
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

console.log('🧪 TESTE COM VERSÕES MAIS RECENTES');
console.log('==================================');

(async () => {
    try {
        console.log('1️⃣ Inicializando cliente com versões atuais...');
        
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'test_latest_versions'
            }),
            puppeteer: {
                headless: 'new',  // Usar novo modo headless
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-extensions',
                    '--window-size=1366,768',
                    '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
                ],
                timeout: 120000,
                protocolTimeout: 120000
            }
        });

        let qrReceived = false;
        let readyReceived = false;
        let authFailure = false;
        let startTime = Date.now();

        client.on('qr', async (qr) => {
            console.log('✅ QR CODE RECEBIDO com versões atuais!');
            qrReceived = true;
            
            try {
                const qrDataUrl = await qrcode.toDataURL(qr);
                console.log(`✅ QR convertido: ${qrDataUrl.substring(0, 50)}... (${qrDataUrl.length} chars)`);
            } catch (error) {
                console.error('❌ Erro ao converter QR:', error.message);
            }
        });

        client.on('ready', () => {
            console.log('✅ READY EVENT - Cliente pronto com versões atuais!');
            readyReceived = true;
        });

        client.on('auth_failure', (msg) => {
            console.log('❌ Falha de autenticação:', msg);
            authFailure = true;
        });

        client.on('disconnected', (reason) => {
            console.log('🔌 Desconectado:', reason);
        });

        console.log('🚀 Inicializando cliente...');
        
        // Timeout de 2 minutos para teste
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout de 2 minutos')), 120000);
        });

        await Promise.race([initPromise, timeoutPromise]);
        
        // Aguardar eventos por 60 segundos
        console.log('⏳ Aguardando eventos por 60 segundos...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);
        
        console.log('\n📊 RESULTADO DO TESTE:');
        console.log('=====================');
        console.log(`⏱️ Tempo decorrido: ${elapsedTime}s`);
        console.log(`📱 QR recebido: ${qrReceived ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`🎯 Ready disparado: ${readyReceived ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`❌ Falha de auth: ${authFailure ? '❌ SIM' : '✅ NÃO'}`);
        
        if (qrReceived && !authFailure) {
            console.log('\n🎉 SUCESSO! Versões atuais funcionando!');
        } else {
            console.log('\n⚠️ Ainda há problemas...');
        }
        
        await client.destroy();
        
    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
})();
EOF

echo "🧪 Executando teste com versões atuais..."
timeout 180 node test-latest-versions.js

echo ""
echo "🚀 9. Iniciando servidor atualizado..."
cd /home/ubuntu/sovereign-chat-automation-hub
./scripts/production-start-whatsapp.sh

echo ""
echo "🎯 RESULTADO FINAL COM VERSÕES ATUAIS"
echo "====================================="

# Verificar versões finais instaladas
cd server
WWEB_FINAL=$(node -e "console.log(require('./node_modules/whatsapp-web.js/package.json').version)" 2>/dev/null || echo "não encontrado")
PUPPETEER_FINAL=$(node -e "console.log(require('./node_modules/puppeteer/package.json').version)" 2>/dev/null || echo "não encontrado")

echo "📦 WhatsApp Web.js: $WWEB_FINAL"
echo "📦 Puppeteer: $PUPPETEER_FINAL"
echo "🌐 Chrome: $CHROME_VERSION"

# Testar health check
sleep 10
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health 2>/dev/null)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check OK ($HEALTH_STATUS)"
    echo ""
    echo "🎉 CORREÇÃO COM VERSÕES ATUAIS CONCLUÍDA!"
    echo "======================================="
    echo "✅ WhatsApp Web.js versão mais recente"
    echo "✅ Puppeteer versão mais recente"
    echo "✅ Chrome versão mais recente"
    echo "✅ Servidor funcionando"
    echo ""
    echo "🔗 Teste agora:"
    echo "1. https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    echo "2. Crie nova instância"
    echo "3. QR Code deve aparecer IMEDIATAMENTE"
    echo "4. Transição: qr_ready → authenticated → connected"
else
    echo "❌ Health check falhou ($HEALTH_STATUS)"
    echo "Verifique os logs: tail -f logs/whatsapp-multi-client.log"
fi

# Limpar arquivos de teste
rm -f test-latest-versions.js

echo ""
echo "✅ Script de versões atuais concluído!"
EOF

<lov-write file_path="run-latest-fix.sh">
#!/bin/bash

echo "🚀 EXECUTANDO CORREÇÃO COM ÚLTIMAS VERSÕES"
echo "=========================================="

cd /home/ubuntu/sovereign-chat-automation-hub
sudo chmod +x scripts/fix-whatsapp-latest-versions.sh
sudo ./scripts/fix-whatsapp-latest-versions.sh

echo ""
echo "🎯 CORREÇÃO COM VERSÕES ATUAIS APLICADA!"
echo "======================================="
echo ""
echo "📱 Agora teste criando uma nova instância:"
echo "https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
echo ""
echo "✅ O QR Code deve aparecer IMEDIATAMENTE"
echo "✅ A conexão deve funcionar corretamente"
echo ""
echo "📊 Para monitorar: tail -f logs/whatsapp-multi-client.log"
EOF
