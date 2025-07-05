#!/bin/bash

echo "🔧 CORREÇÃO DEFINITIVA DO PUPPETEER"
echo "=================================="

# Parar o servidor atual
echo "1️⃣ Parando servidor atual..."
./scripts/production-stop-whatsapp.sh

# Limpar processos Chrome órfãos
echo "2️⃣ Limpando processos Chrome órfãos..."
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true

# Limpar cache do Puppeteer
echo "3️⃣ Limpando cache do Puppeteer..."
rm -rf /home/ubuntu/.cache/puppeteer || true
rm -rf /tmp/.org.chromium.* || true

# Backup do servidor atual
echo "4️⃣ Fazendo backup do servidor..."
cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.js.backup

echo "5️⃣ Aplicando correções no servidor..."

# Aplicar correções críticas
cat > /tmp/puppeteer-fix.js << 'EOF'
// Patch para corrigir gerenciamento de sessões Puppeteer
const originalCode = require('fs').readFileSync('server/whatsapp-multi-client-server.js', 'utf8');

const fixedCode = originalCode.replace(
  // Corrigir timeout do Puppeteer  
  /puppeteer\.launch\({[\s\S]*?}\)/g,
  `puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--single-process'
    ],
    timeout: 60000,
    protocolTimeout: 60000
  })`
).replace(
  // Adicionar verificação antes de getState
  /client\.getState\(\)/g,
  `(client && client.pupPage && !client.pupPage.isClosed() ? client.getState() : Promise.resolve(null))`
).replace(
  // Melhorar manualConnectionChecker
  /const manualConnectionChecker = async \(clientId\) => {[\s\S]*?};/,
  `const manualConnectionChecker = async (clientId) => {
    const client = clients.get(clientId);
    if (!client || !client.pupPage || client.pupPage.isClosed()) {
      console.log(\`❌ [\${clientId}] Sessão inválida ou fechada\`);
      return;
    }
    
    try {
      const state = await client.getState();
      console.log(\`🔍 [\${clientId}] Estado atual: \${state}\`);
      
      if (state === 'CONNECTED') {
        const info = await client.info || {};
        const phoneNumber = info.wid?.user || null;
        
        console.log(\`✅ [\${clientId}] CONECTADO! Telefone: \${phoneNumber}\`);
        
        // Atualizar status imediatamente
        await updateInstanceStatus(clientId, 'connected', phoneNumber ? { phone_number: phoneNumber } : undefined);
        
        // Emitir evento WebSocket
        io.emit(\`client_status_\${clientId}\`, {
          clientId,
          status: 'connected',
          phoneNumber,
          hasQrCode: false,
          timestamp: Date.now()
        });
        
        return;
      }
      
      if (state === 'OPENING') {
        console.log(\`🔄 [\${clientId}] Abrindo WhatsApp Web...\`);
        await updateInstanceStatus(clientId, 'connecting');
      }
      
    } catch (error) {
      console.error(\`❌ [\${clientId}] Erro no checker: \${error.message}\`);
      
      // Se a sessão morreu, remover cliente
      if (error.message.includes('Session closed') || error.message.includes('null')) {
        console.log(\`🗑️ [\${clientId}] Removendo cliente com sessão morta\`);
        clients.delete(clientId);
      }
    }
  };`
);

require('fs').writeFileSync('server/whatsapp-multi-client-server.js', fixedCode);
console.log('✅ Correções aplicadas com sucesso!');
EOF

node /tmp/puppeteer-fix.js

echo "6️⃣ Instalando dependências atualizadas..."
cd server
npm install puppeteer@latest --save
cd ..

echo "7️⃣ Reiniciando servidor com correções..."
./scripts/production-start-whatsapp.sh

echo ""
echo "✅ CORREÇÃO CONCLUÍDA!"
echo "🔧 O servidor agora tem:"
echo "   • Gerenciamento robusto de sessões Puppeteer"
echo "   • Verificações antes de acessar páginas fechadas"  
echo "   • Detecção automática de conexão WhatsApp"
echo "   • Limpeza automática de sessões mortas"
echo ""
echo "🧪 TESTE AGORA:"
echo "   1. Crie nova instância no painel"
echo "   2. Escaneie o QR code"
echo "   3. O status deve mudar automaticamente para 'connected'"