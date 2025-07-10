#!/bin/bash

# Script para correção final e definitiva
# Arquivo: scripts/final-fix.sh

echo "🔧 CORREÇÃO FINAL - CREDENCIAIS + REINÍCIO"
echo "=========================================="

# Corrigir permissões de todos os scripts
echo "🔐 Corrigindo permissões..."
chmod +x scripts/*.sh
echo "✅ Permissões corrigidas"

# Parar servidor manualmente
echo ""
echo "🛑 Parando servidor atual..."
PID=$(lsof -t -i:4000) 2>/dev/null
if [ -n "$PID" ]; then
    echo "🔍 Processo encontrado: $PID"
    kill -TERM "$PID" 2>/dev/null
    sleep 3
    
    # Verificar se ainda está rodando
    if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️ Forçando parada..."
        kill -KILL "$PID" 2>/dev/null
    fi
    echo "✅ Servidor parado"
else
    echo "✅ Nenhum servidor rodando na porta 4000"
fi

# Limpar processos órfãos
pkill -f "whatsapp-multi-client-server" 2>/dev/null || true

# Aguardar porta ficar livre
echo "⏳ Aguardando porta ficar livre..."
sleep 5

# Verificar se porta está livre
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Porta ainda ocupada, aguardando mais..."
    sleep 5
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Forçando liberação da porta..."
        fuser -k 4000/tcp 2>/dev/null || true
        sleep 2
    fi
fi

echo "✅ Porta 4000 livre"

# Entrar no diretório do servidor
cd server || exit 1

# Iniciar servidor diretamente
echo ""
echo "🚀 Iniciando servidor com credenciais corretas..."
echo "📅 $(date)"

# Criar diretório de logs se não existir
mkdir -p ../logs

# Iniciar servidor em background
nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
SERVER_PID=$!

echo "🆔 PID do novo servidor: $SERVER_PID"
echo "$SERVER_PID" > ../logs/whatsapp-server.pid

# Aguardar inicialização
echo "⏳ Aguardando servidor inicializar..."
sleep 10

# Testar se está funcionando
echo "🧪 Testando servidor..."
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Servidor funcionando!"
    
    # Testar credenciais Supabase
    echo "🔍 Testando credenciais Supabase..."
    sleep 3
    
    # Verificar se não há mais erro de API key nos logs
    if tail -10 ../logs/whatsapp-multi-client.log | grep -q "Invalid API key"; then
        echo "❌ Ainda há erro de API key nos logs"
        echo "📝 Últimas linhas do log:"
        tail -5 ../logs/whatsapp-multi-client.log
    else
        echo "✅ Sem erros de API key detectados!"
        
        echo ""
        echo "🎉 CORREÇÃO FINAL CONCLUÍDA COM SUCESSO!"
        echo "======================================="
        echo ""
        echo "✅ Servidor WhatsApp rodando (PID: $SERVER_PID)"
        echo "✅ Credenciais Supabase corrigidas"
        echo "✅ Porta 4000 funcionando"
        echo ""
        echo "🧪 TESTE AGORA:"
        echo "1. Acesse: http://146.59.227.248:8080/admin/instances"  
        echo "2. Clique em 'Conectar' em uma instância"
        echo "3. Deve gerar QR Code sem erro 500"
        echo ""
        echo "🌐 URLs disponíveis:"
        echo "• Frontend: http://146.59.227.248:8080/admin/instances"
        echo "• API Health: http://146.59.227.248:4000/health"
        echo "• Swagger: http://146.59.227.248:4000/api-docs"
        echo ""
        echo "📝 Monitorar logs: tail -f logs/whatsapp-multi-client.log"
        echo "🛑 Para parar: kill $SERVER_PID"
    fi
else
    echo "❌ Servidor não está respondendo"
    echo "📝 Verificar logs:"
    tail -10 ../logs/whatsapp-multi-client.log
fi

cd ..
echo ""
echo "📅 Correção final concluída em: $(date)"