#!/bin/bash

# Script para parar DEFINITIVAMENTE todos os processos WhatsApp
# Execute: ./scripts/force-stop-whatsapp.sh

echo "🛑 PARADA FORÇADA - WHATSAPP MULTI-CLIENTE"
echo "========================================="

# Função para aguardar porta ficar livre
wait_for_port_free() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if ! lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ Porta 4000 está livre"
            return 0
        fi
        
        echo "⏳ Tentativa $attempt/$max_attempts - Aguardando porta 4000 ficar livre..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Timeout: Porta 4000 ainda em uso após $max_attempts tentativas"
    return 1
}

# 1. Parar PM2 se disponível
echo "🔧 1. Verificando PM2..."
PM2_PATH=""

# Procurar PM2 em diferentes locais
PM2_LOCATIONS=(
    "pm2"
    "/usr/bin/pm2"
    "/usr/local/bin/pm2"
    "/home/ubuntu/.nvm/versions/node/*/bin/pm2"
    "/root/.nvm/versions/node/*/bin/pm2"
)

for location in "${PM2_LOCATIONS[@]}"; do
    if command -v $location >/dev/null 2>&1; then
        PM2_PATH=$location
        break
    fi
done

if [ -n "$PM2_PATH" ]; then
    echo "✅ PM2 encontrado: $PM2_PATH"
    
    # Parar processos PM2 relacionados ao WhatsApp
    $PM2_PATH stop whatsapp-multi-client 2>/dev/null || true
    $PM2_PATH delete whatsapp-multi-client 2>/dev/null || true
    $PM2_PATH kill 2>/dev/null || true
    
    echo "✅ Processos PM2 parados"
else
    echo "⚠️ PM2 não encontrado - continuando sem PM2"
fi

# 2. Parar por arquivo PID
echo "🔧 2. Verificando arquivo PID..."
if [ -f "logs/whatsapp-server.pid" ]; then
    PID=$(cat logs/whatsapp-server.pid)
    echo "📄 PID encontrado: $PID"
    
    if ps -p $PID >/dev/null 2>&1; then
        echo "⏹️ Enviando SIGTERM para PID $PID..."
        kill -TERM $PID 2>/dev/null || true
        sleep 5
        
        if ps -p $PID >/dev/null 2>&1; then
            echo "⚠️ Processo resistente, enviando SIGKILL..."
            kill -KILL $PID 2>/dev/null || true
            sleep 3
        fi
        
        if ps -p $PID >/dev/null 2>&1; then
            echo "❌ Processo ainda ativo após SIGKILL"
        else
            echo "✅ Processo PID $PID terminado"
        fi
    else
        echo "⚠️ Processo PID $PID não estava rodando"
    fi
    
    rm -f logs/whatsapp-server.pid
else
    echo "⚠️ Arquivo PID não encontrado"
fi

# 3. Identificar e parar TODOS os processos na porta 4000
echo "🔧 3. Forçando liberação da porta 4000..."
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ Porta 4000 ainda em uso, identificando processos..."
    
    PIDS=$(lsof -Pi :4000 -sTCP:LISTEN -t 2>/dev/null)
    for pid in $PIDS; do
        echo "🎯 Terminando processo PID: $pid"
        ps -p $pid -o pid,command --no-headers 2>/dev/null || echo "  Processo já terminado"
        
        # SIGTERM primeiro
        kill -TERM $pid 2>/dev/null || true
        sleep 3
        
        # SIGKILL se necessário
        if ps -p $pid >/dev/null 2>&1; then
            echo "  Forçando com SIGKILL..."
            kill -KILL $pid 2>/dev/null || true
            sleep 2
        fi
    done
    
    # Usar fuser como último recurso
    echo "🔧 Usando fuser para liberar porta 4000..."
    fuser -k 4000/tcp 2>/dev/null || true
    sleep 3
fi

# 4. Parar processos por nome/padrão
echo "🔧 4. Parando processos por padrão..."
pkill -TERM -f "whatsapp-multi-client" 2>/dev/null || true
pkill -TERM -f "node.*server" 2>/dev/null || true
sleep 5

pkill -KILL -f "whatsapp-multi-client" 2>/dev/null || true
pkill -KILL -f "node.*server" 2>/dev/null || true
sleep 3

# 5. Limpar processos Chrome/Puppeteer órfãos
echo "🔧 5. Limpando processos Chrome/Puppeteer..."
pkill -f "chrome.*--remote-debugging-port" 2>/dev/null || true
pkill -f "chromium.*--remote-debugging-port" 2>/dev/null || true

# 6. Limpar arquivos temporários
echo "🧹 6. Limpando arquivos temporários..."
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true

# 7. Aguardar porta ficar completamente livre
echo "⏳ 7. Aguardando porta 4000 ficar completamente livre..."
if wait_for_port_free; then
    echo "✅ PARADA FORÇADA CONCLUÍDA COM SUCESSO!"
    echo ""
    echo "📊 Status final:"
    echo "  • Porta 4000: LIVRE"
    echo "  • Processos WhatsApp: TERMINADOS"
    echo "  • Sistema limpo para nova inicialização"
else
    echo "❌ AVISO: Porta 4000 ainda pode estar em uso"
    echo "🔍 Processos restantes na porta 4000:"
    lsof -Pi :4000 2>/dev/null || echo "  Nenhum detectado pelo lsof"
fi

echo ""
echo "🚀 Para iniciar o servidor novamente:"
echo "   ./scripts/robust-start-whatsapp.sh"
echo ""
echo "📅 Parada forçada concluída em: $(date)"