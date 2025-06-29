
#!/bin/bash

# Script para verificar saúde do sistema WhatsApp Multi-Cliente
# Arquivo: scripts/check-whatsapp-health.sh

echo "🔍 Verificando saúde do sistema WhatsApp Multi-Cliente..."
echo "================================================="

# Detectar IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')
HEALTH_URL="http://localhost:4000/health"
PUBLIC_HEALTH_URL="http://${SERVER_IP}:4000/health"

# Verificar servidor localmente
if curl -s --max-time 10 $HEALTH_URL > /dev/null; then
    echo "✅ Servidor WhatsApp Multi-Cliente está rodando (porta 4000)"
    
    # Mostrar informações do servidor
    echo ""
    echo "📊 Status do servidor (local):"
    HEALTH_DATA=$(curl -s --max-time 5 $HEALTH_URL)
    echo "$HEALTH_DATA" | jq . 2>/dev/null || echo "$HEALTH_DATA"
    
    # Verificar acesso público
    echo ""
    echo "🌐 Testando acesso público..."
    if curl -s --max-time 10 $PUBLIC_HEALTH_URL > /dev/null; then
        echo "✅ Servidor acessível publicamente"
        echo "📊 Status público:"
        PUBLIC_HEALTH_DATA=$(curl -s --max-time 5 $PUBLIC_HEALTH_URL)
        echo "$PUBLIC_HEALTH_DATA" | jq . 2>/dev/null || echo "$PUBLIC_HEALTH_DATA"
    else
        echo "⚠️ Servidor não acessível publicamente"
        echo "🔍 Verificar firewall e configurações de rede"
    fi
    
    echo ""
    echo "🌐 URLs disponíveis:"
    echo "• API Health (local): http://localhost:4000/health"
    echo "• API Health (público): http://${SERVER_IP}:4000/health"
    echo "• Swagger API (local): http://localhost:4000/api-docs"
    echo "• Swagger API (público): http://${SERVER_IP}:4000/api-docs"
    echo "• Frontend Admin: http://${SERVER_IP}:8080/admin/instances"
    
    # Verificar se PID file existe e processo está rodando
    if [ -f "logs/whatsapp-server.pid" ]; then
        PID=$(cat logs/whatsapp-server.pid)
        if ps -p $PID > /dev/null 2>&1; then
            echo ""
            echo "✅ Processo PID $PID está ativo"
            
            # Mostrar uso de CPU e memória
            echo "📈 Uso de recursos:"
            ps -p $PID -o pid,ppid,%cpu,%mem,etime,cmd --no-headers 2>/dev/null || echo "Não foi possível obter dados de recursos"
        else
            echo ""
            echo "⚠️ Arquivo PID existe mas processo não está rodando"
        fi
    else
        echo ""
        echo "⚠️ Arquivo PID não encontrado"
    fi
    
    # Verificar PM2 se disponível
    if command -v pm2 &> /dev/null; then
        echo ""
        echo "🔧 Status PM2:"
        pm2 jlist | jq -r '.[] | select(.name=="whatsapp-multi-client") | "Nome: \(.name), Status: \(.pm2_env.status), PID: \(.pid), CPU: \(.monit.cpu)%, Memória: \(.monit.memory/1024/1024|floor)MB, Uptime: \(.pm2_env.pm_uptime)"' 2>/dev/null || echo "Nenhum processo PM2 encontrado"
    fi
    
else
    echo "❌ Servidor WhatsApp Multi-Cliente não está rodando"
    echo ""
    echo "🔍 Verificando possíveis causas:"
    
    # Verificar se porta está em uso
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️ Porta 4000 está em uso por outro processo:"
        lsof -Pi :4000 -sTCP:LISTEN
    else
        echo "ℹ️ Porta 4000 está livre"
    fi
    
    # Verificar logs se existirem
    if [ -f "logs/whatsapp-multi-client.log" ]; then
        echo ""
        echo "📝 Últimas 15 linhas do log:"
        tail -15 logs/whatsapp-multi-client.log
    fi
    
    if [ -f "logs/whatsapp-error.log" ]; then
        echo ""
        echo "📝 Últimas 10 linhas do log de erro:"
        tail -10 logs/whatsapp-error.log
    fi
    
    echo ""
    echo "💡 Para iniciar o servidor:"
    echo "  ./scripts/production-start-whatsapp.sh"
fi

echo ""
echo "🔍 Processos WhatsApp/Chrome ativos:"
ps aux | grep -E "(whatsapp|chrome|chromium)" | grep -v grep | head -10

echo ""
echo "🔍 Uso de memória do sistema:"
free -h

echo ""
echo "🔍 Uso de disco:"
df -h | grep -E "(/$|/tmp|/var)"

echo ""
echo "🔍 Portas relacionadas em uso:"
echo "Porta 4000 (WhatsApp Multi-Cliente):"
lsof -i :4000 2>/dev/null | head -5 || echo "  Livre"

echo "Porta 8080 (Frontend):"
lsof -i :8080 2>/dev/null | head -5 || echo "  Livre"

echo ""
echo "📅 Verificação concluída em: $(date)"
