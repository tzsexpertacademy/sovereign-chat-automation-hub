
#!/bin/bash

# Script para parar WhatsApp Multi-Cliente em produção
# Execute da pasta raiz: ./scripts/production-stop-whatsapp.sh

echo "🛑 PARANDO WHATSAPP MULTI-CLIENTE - PRODUÇÃO"
echo "=========================================="

# Verificar se PM2 está disponível e sendo usado
PM2_FOUND=false

# Procurar PM2 em diferentes locais
PM2_LOCATIONS=(
    "pm2"
    "/usr/bin/pm2"
    "/usr/local/bin/pm2"
    "/home/ubuntu/.nvm/versions/node/*/bin/pm2"
    "/root/.nvm/versions/node/*/bin/pm2"
)

echo "🔧 Verificando processos PM2..."
for location in "${PM2_LOCATIONS[@]}"; do
    if command -v $location &> /dev/null; then
        echo "✅ PM2 encontrado: $location"
        PM2_FOUND=true
        
        if $location jlist | grep -q "whatsapp-multi-client"; then
            echo "⏹️ Parando processo via PM2..."
            $location stop whatsapp-multi-client
            $location delete whatsapp-multi-client
            $location save
            echo "✅ Processo PM2 parado"
        else
            echo "ℹ️ Nenhum processo PM2 encontrado"
        fi
        break
    fi
done

if [ "$PM2_FOUND" = false ]; then
    echo "ℹ️ PM2 não encontrado no PATH"
fi

# Parar pelo PID se disponível
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    echo "🔍 PID encontrado: $PID"
    
    if ps -p $PID > /dev/null 2>&1; then
        echo "⏹️ Enviando sinal SIGTERM para PID: $PID"
        kill -TERM $PID
        sleep 8
        
        # Verificar se ainda está rodando
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️ Processo resistente, enviando SIGKILL..."
            kill -KILL $PID
            sleep 3
        fi
        
        echo "✅ Processo parado com sucesso"
    else
        echo "⚠️ Processo PID $PID não está rodando"
    fi
    
    rm -f logs/whatsapp-server.pid
else
    echo "⚠️ Arquivo PID não encontrado"
fi

# Parar todos os processos relacionados
echo "🔍 Parando todos os processos WhatsApp Multi-Cliente..."
pkill -TERM -f "whatsapp-multi-client-server.js" || true
sleep 5
pkill -KILL -f "whatsapp-multi-client-server.js" || true

# Parar processos Chrome/Chromium do Puppeteer
echo "🔍 Parando processos Chrome/Puppeteer..."
pkill -f "chrome.*--remote-debugging-port" || true
pkill -f "chromium.*--remote-debugging-port" || true

# Verificar porta 4000
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 ainda em uso, forçando liberação..."
    fuser -k 4000/tcp || true
    sleep 3
fi

# Limpar arquivos temporários
echo "🧹 Limpando arquivos temporários..."
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true

# Verificar status final
if ! lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Porta 4000 está livre"
    echo "✅ WhatsApp Multi-Cliente parado com sucesso"
else
    echo "⚠️ Porta 4000 ainda pode estar em uso"
    echo "🔍 Processos na porta 4000:"
    lsof -Pi :4000 2>/dev/null || echo "  Nenhum processo detectado"
fi

echo ""
echo "📊 Status final das portas principais:"
echo "Porta 4000 (WhatsApp Multi-Cliente):"
lsof -i :4000 2>/dev/null | head -5 || echo "  Livre"

echo "Porta 8080 (Frontend):"
lsof -i :8080 2>/dev/null | head -5 || echo "  Livre"

echo ""
echo "📅 Parada concluída em: $(date)"
