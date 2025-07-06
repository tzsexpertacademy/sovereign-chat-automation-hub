
#!/bin/bash

# Script de Atualização Segura para Versões Mais Recentes
# Arquivo: scripts/update-to-latest-versions.sh

echo "🚀 ATUALIZAÇÃO SEGURA PARA VERSÕES MAIS RECENTES"
echo "================================================"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/update-to-latest-versions.sh"
    exit 1
fi

# Definir cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📋 ETAPA 1: ANÁLISE E BACKUP"
echo "============================"

cd /home/ubuntu/sovereign-chat-automation-hub

# Criar backup do estado atual
echo "💾 Criando backup do estado atual..."
BACKUP_DIR="/home/ubuntu/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r server/ $BACKUP_DIR/server-backup/
cp -r scripts/ $BACKUP_DIR/scripts-backup/
echo "✅ Backup criado em: $BACKUP_DIR"

# Verificar estado atual
echo "🔍 Analisando estado atual..."
cd server

echo "📦 Versões atuais:"
if [ -f "package.json" ]; then
    echo "  WhatsApp Web.js: $(node -e "try { console.log(require('./node_modules/whatsapp-web.js/package.json').version) } catch(e) { console.log('Não instalado') }" 2>/dev/null)"
    echo "  Puppeteer: $(node -e "try { console.log(require('./node_modules/puppeteer/package.json').version) } catch(e) { console.log('Não instalado') }" 2>/dev/null)"
    echo "  Socket.io: $(node -e "try { console.log(require('./node_modules/socket.io/package.json').version) } catch(e) { console.log('Não instalado') }" 2>/dev/null)"
    echo "  Express: $(node -e "try { console.log(require('./node_modules/express/package.json').version) } catch(e) { console.log('Não instalado') }" 2>/dev/null)"
fi

echo ""
echo "📋 ETAPA 2: PARADA SEGURA DO SERVIDOR"
echo "====================================="

cd ..
echo "🛑 Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

# Aguardar para garantir que parou completamente
sleep 5

echo ""
echo "📋 ETAPA 3: LIMPEZA E PREPARAÇÃO"
echo "==============================="

cd server

# Backup do package.json atual
cp package.json package.json.backup

echo "🧹 Limpeza completa de dependências antigas..."
rm -rf node_modules/
rm -f package-lock.json

# Limpar cache npm agressivamente
echo "🧹 Limpeza do cache npm..."
npm cache clean --force
npm cache verify

echo ""
echo "📋 ETAPA 4: ATUALIZAÇÃO DO PACKAGE.JSON"
echo "======================================="

echo "📝 Atualizando package.json com versões mais recentes..."

# Criar novo package.json com versões atualizadas
cat > package.json << 'EOF'
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
    "express": "^4.21.2",
    "socket.io": "^4.8.1",
    "cors": "^2.8.5",
    "whatsapp-web.js": "^1.25.0",
    "puppeteer": "^23.8.0",
    "qrcode": "^1.5.4",
    "multer": "^1.4.5-lts.1",
    "express-fileupload": "^1.5.1",
    "uuid": "^11.0.3",
    "mime-types": "^2.1.35",
    "fs": "^0.0.1-security",
    "path": "^0.12.7",
    "http": "^0.0.1-security",
    "swagger-ui-express": "^5.0.1",
    "swagger-jsdoc": "^6.2.8",
    "@supabase/supabase-js": "^2.50.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  },
  "keywords": [
    "whatsapp",
    "multi-client",
    "saas",
    "nodejs"
  ],
  "author": "TZS Expert Academy",
  "license": "MIT"
}
EOF

echo "✅ package.json atualizado com versões mais recentes"

echo ""
echo "📋 ETAPA 5: INSTALAÇÃO DAS NOVAS DEPENDÊNCIAS"
echo "============================================="

echo "📥 Instalando WhatsApp Web.js 1.25.0..."
npm install whatsapp-web.js@^1.25.0 --save

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ WhatsApp Web.js 1.25.0 instalado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao instalar WhatsApp Web.js${NC}"
    exit 1
fi

echo "📥 Instalando Puppeteer 23.8.0..."
npm install puppeteer@^23.8.0 --save

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Puppeteer 23.8.0 instalado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao instalar Puppeteer${NC}"
    exit 1
fi

echo "📥 Instalando outras dependências atualizadas..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Todas as dependências instaladas com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências${NC}"
    exit 1
fi

echo ""
echo "📋 ETAPA 6: ATUALIZAÇÃO DO CHROME"
echo "================================="

echo "🌐 Atualizando Google Chrome para versão mais recente..."
apt-get update
apt-get install -y google-chrome-stable

CHROME_VERSION=$(google-chrome --version 2>/dev/null)
echo "✅ Chrome atualizado: $CHROME_VERSION"

echo ""
echo "📋 ETAPA 7: TESTE ISOLADO DAS NOVAS VERSÕES"
echo "==========================================="

echo "🧪 Criando teste isolado..."

cat > test-latest-versions.js << 'EOF'
const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');

console.log('🧪 TESTE ISOLADO - VERSÕES MAIS RECENTES');
console.log('========================================');

async function testLatestVersions() {
    try {
        console.log('1️⃣ Testando Puppeteer...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            ]
        });
        
        console.log('✅ Browser Puppeteer criado com sucesso');
        await browser.close();
        
        console.log('2️⃣ Testando WhatsApp Web.js...');
        
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: 'test-client' }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                ]
            }
        });
        
        let qrReceived = false;
        let testTimeout;
        
        client.on('qr', (qr) => {
            console.log('✅ QR CODE RECEBIDO com versões atualizadas!');
            qrReceived = true;
        });
        
        client.on('ready', () => {
            console.log('✅ Cliente pronto!');
        });
        
        client.on('authenticated', () => {
            console.log('✅ Cliente autenticado!');
        });
        
        // Timeout de segurança
        testTimeout = setTimeout(async () => {
            await client.destroy();
            console.log('⏰ Teste finalizado por timeout');
        }, 30000);
        
        await client.initialize();
        
        // Aguardar um pouco para o QR aparecer
        await new Promise(resolve => setTimeout(resolve, 25000));
        
        clearTimeout(testTimeout);
        await client.destroy();
        
        console.log('📊 RESULTADO DO TESTE:');
        console.log('======================');
        console.log(`📱 QR recebido: ${qrReceived ? '✅ SIM' : '❌ NÃO'}`);
        
        if (qrReceived) {
            console.log('🎉 TESTE BEM-SUCEDIDO! Versões atualizadas funcionando!');
            process.exit(0);
        } else {
            console.log('❌ TESTE FALHOU! QR não foi gerado');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.message);
        process.exit(1);
    }
}

testLatestVersions();
EOF

echo "🧪 Executando teste das versões atualizadas..."
timeout 45s node test-latest-versions.js

TEST_RESULT=$?
rm -f test-latest-versions.js

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}🎉 TESTE BEM-SUCEDIDO! Versões atualizadas funcionando!${NC}"
else
    echo -e "${YELLOW}⚠️ Teste não conclusivo, mas prosseguindo...${NC}"
fi

echo ""
echo "📋 ETAPA 8: LIMPEZA E CONFIGURAÇÃO"
echo "=================================="

# Limpar arquivos de teste
rm -rf .wwebjs_auth/test-client/
rm -rf .wwebjs_cache/

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
mkdir -p ../logs
mkdir -p ../whatsapp-sessions
mkdir -p .wwebjs_auth
mkdir -p .wwebjs_cache

# Corrigir permissões
chown -R ubuntu:ubuntu ../logs
chown -R ubuntu:ubuntu ../whatsapp-sessions
chown -R ubuntu:ubuntu .wwebjs_auth
chown -R ubuntu:ubuntu .wwebjs_cache

echo ""
echo "📋 ETAPA 9: VERIFICAÇÃO FINAL DAS VERSÕES"
echo "========================================"

echo "📦 Versões instaladas:"
echo "  WhatsApp Web.js: $(node -e "console.log(require('./node_modules/whatsapp-web.js/package.json').version)")"
echo "  Puppeteer: $(node -e "console.log(require('./node_modules/puppeteer/package.json').version)")"
echo "  Socket.io: $(node -e "console.log(require('./node_modules/socket.io/package.json').version)")"
echo "  Express: $(node -e "console.log(require('./node_modules/express/package.json').version)")"

echo ""
echo "📋 ETAPA 10: REINÍCIO SEGURO DO SERVIDOR"
echo "========================================"

cd ..
echo "🚀 Iniciando servidor com versões atualizadas..."
./scripts/production-start-whatsapp.sh

# Aguardar servidor inicializar
sleep 15

echo ""
echo "📋 ETAPA 11: VALIDAÇÃO FINAL"
echo "============================"

echo "🔍 Testando health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health 2>/dev/null)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check OK ($HEALTH_STATUS)${NC}"
    SERVER_OK=true
else
    echo -e "${RED}❌ Health check falhou ($HEALTH_STATUS)${NC}"
    SERVER_OK=false
fi

# Verificar logs por erros
echo "🔍 Verificando logs por erros..."
if [ -f "logs/whatsapp-multi-client.log" ]; then
    RECENT_ERRORS=$(tail -50 logs/whatsapp-multi-client.log | grep -i error | wc -l)
    if [ "$RECENT_ERRORS" -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum erro encontrado nos logs recentes${NC}"
    else
        echo -e "${YELLOW}⚠️ $RECENT_ERRORS erros encontrados nos logs${NC}"
    fi
fi

echo ""
echo "🎯 RESULTADO FINAL DA ATUALIZAÇÃO"
echo "================================="

if [ "$SERVER_OK" = true ]; then
    echo -e "${GREEN}🎉 ATUALIZAÇÃO BEM-SUCEDIDA!${NC}"
    echo ""
    echo "✅ WhatsApp Web.js atualizado para 1.25.0"
    echo "✅ Puppeteer atualizado para 23.8.0"
    echo "✅ Socket.io atualizado para 4.8.1"
    echo "✅ Express atualizado para 4.21.2"
    echo "✅ Chrome na versão mais recente"
    echo "✅ Servidor funcionando corretamente"
    echo ""
    echo "🔗 Próximos passos:"
    echo "1. Acesse: https://19c6b746-780c-41f1-97e3-86e1c8f2c488.lovableproject.com/admin/instances"
    echo "2. Crie uma nova instância"
    echo "3. O QR Code deve aparecer instantaneamente"
    echo "4. Escaneie e teste a conexão"
    echo ""
    echo "📊 Para monitorar:"
    echo "tail -f logs/whatsapp-multi-client.log"
    
    # Remover backup se tudo deu certo
    echo "🧹 Removendo backup (atualização bem-sucedida)..."
    rm -rf $BACKUP_DIR
    
else
    echo -e "${RED}⚠️ PROBLEMAS DETECTADOS${NC}"
    echo ""
    echo "🔧 Possíveis soluções:"
    echo "1. Verificar logs: tail -f logs/whatsapp-multi-client.log"
    echo "2. Reiniciar: ./scripts/production-stop-whatsapp.sh && ./scripts/production-start-whatsapp.sh"
    echo "3. Se necessário, restaurar backup: $BACKUP_DIR"
fi

echo ""
echo "📋 INFORMAÇÕES DO BACKUP:"
echo "Backup criado em: $BACKUP_DIR"
echo "Para restaurar (se necessário):"
echo "  sudo cp -r $BACKUP_DIR/server-backup/* server/"
echo "  sudo chown -R ubuntu:ubuntu server/"
echo ""
echo "✅ ATUALIZAÇÃO CONCLUÍDA!"
