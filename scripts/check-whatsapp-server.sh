
#!/bin/bash

# Script para verificar e iniciar o servidor WhatsApp
# Arquivo: scripts/check-whatsapp-server.sh

echo "🔍 VERIFICANDO SERVIDOR WHATSAPP"
echo "================================="

BACKEND_PORT=4000

echo "📍 Verificando se o servidor WhatsApp está rodando na porta $BACKEND_PORT..."

# Verificar se algo está rodando na porta 4000
if netstat -tlnp | grep -q ":$BACKEND_PORT "; then
    echo "✅ Servidor rodando na porta $BACKEND_PORT"
    
    # Mostrar detalhes do processo
    echo "📊 Detalhes do processo:"
    netstat -tlnp | grep ":$BACKEND_PORT "
    
    # Testar se responde
    echo "🧪 Testando resposta HTTP..."
    if curl -s --connect-timeout 5 http://localhost:$BACKEND_PORT/health > /dev/null; then
        echo "✅ Servidor respondendo normalmente"
    else
        echo "❌ Servidor não está respondendo"
    fi
    
else
    echo "❌ Nenhum servidor rodando na porta $BACKEND_PORT"
    echo ""
    echo "🚀 INICIANDO SERVIDOR WHATSAPP..."
    echo ""
    
    # Verificar se o diretório do servidor existe
    if [ -d "whatsapp-multi-client-server" ]; then
        echo "📁 Diretório do servidor encontrado"
        cd whatsapp-multi-client-server
        
        # Verificar se package.json existe
        if [ -f "package.json" ]; then
            echo "📦 package.json encontrado"
            
            # Instalar dependências se necessário
            if [ ! -d "node_modules" ]; then
                echo "📥 Instalando dependências..."
                npm install
            fi
            
            # Iniciar servidor
            echo "🚀 Iniciando servidor WhatsApp..."
            npm start &
            
            # Aguardar inicialização
            echo "⏳ Aguardando servidor inicializar..."
            sleep 10
            
            # Verificar se iniciou
            if netstat -tlnp | grep -q ":$BACKEND_PORT "; then
                echo "✅ Servidor WhatsApp iniciado com sucesso!"
            else
                echo "❌ Falha ao iniciar servidor WhatsApp"
            fi
            
        else
            echo "❌ package.json não encontrado no diretório do servidor"
        fi
    else
        echo "❌ Diretório do servidor não encontrado"
        echo "💡 Certifique-se de que o servidor WhatsApp está no diretório correto"
    fi
fi

echo ""
echo "🌐 Status das portas:"
echo "  • Porta 4000 (Backend): $(netstat -tlnp | grep -q ":4000 " && echo "✅ Ativa" || echo "❌ Inativa")"
echo "  • Porta 8080 (Frontend): $(netstat -tlnp | grep -q ":8080 " && echo "✅ Ativa" || echo "❌ Inativa")"
echo "  • Porta 443 (HTTPS): $(netstat -tlnp | grep -q ":443 " && echo "✅ Ativa" || echo "❌ Inativa")"
echo ""
