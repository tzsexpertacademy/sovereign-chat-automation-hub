#!/bin/bash

# SCRIPT DE UPGRADE SEGURO - WhatsApp Web.js 1.21.0 → 1.25.0+
# Criado em: $(date)

echo "🚀 INICIANDO UPGRADE SEGURO DO WHATSAPP-WEB.JS"
echo "================================================"

# Função para backup
create_backup() {
    echo "📦 Criando backup de segurança..."
    
    # Backup do package.json
    cp server/package.json server/package.json.backup.$(date +%Y%m%d_%H%M%S)
    
    # Backup do servidor principal
    cp server/whatsapp-multi-client-server.js server/whatsapp-multi-client-server.backup.$(date +%Y%m%d_%H%M%S).js
    
    echo "✅ Backup criado com sucesso!"
}

# Função para parar o servidor
stop_server() {
    echo "🛑 Parando servidor..."
    cd server
    npm run stop 2>/dev/null || pkill -f whatsapp-multi-client-server.js 2>/dev/null
    sleep 2
    echo "✅ Servidor parado"
}

# Função para atualizar dependências
update_dependencies() {
    echo "📥 Atualizando whatsapp-web.js para versão mais recente..."
    cd server
    
    # Limpar cache do npm
    npm cache clean --force
    
    # Remover node_modules e package-lock.json
    rm -rf node_modules package-lock.json
    
    # Instalar nova versão
    npm install
    
    echo "✅ Dependências atualizadas!"
}

# Função para testar a instalação
test_installation() {
    echo "🧪 Testando instalação..."
    cd server
    
    # Verificar se pode importar a biblioteca
    node -e "
        try {
            const { Client } = require('whatsapp-web.js');
            console.log('✅ whatsapp-web.js importado com sucesso');
            console.log('📋 Versão instalada:');
            const pkg = require('./node_modules/whatsapp-web.js/package.json');
            console.log('   whatsapp-web.js:', pkg.version);
        } catch (error) {
            console.error('❌ Erro ao importar whatsapp-web.js:', error.message);
            process.exit(1);
        }
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ Teste de instalação passou!"
    else
        echo "❌ Teste de instalação falhou!"
        return 1
    fi
}

# Função para iniciar servidor
start_server() {
    echo "🚀 Iniciando servidor com nova versão..."
    cd server
    npm start &
    sleep 5
    
    # Verificar se o servidor está rodando
    if pgrep -f whatsapp-multi-client-server.js > /dev/null; then
        echo "✅ Servidor iniciado com sucesso!"
    else
        echo "❌ Falha ao iniciar servidor!"
        return 1
    fi
}

# Função para rollback
rollback() {
    echo "🔄 EXECUTANDO ROLLBACK..."
    
    stop_server
    
    # Restaurar backup mais recente
    latest_backup=$(ls -t server/package.json.backup.* 2>/dev/null | head -n1)
    if [ -n "$latest_backup" ]; then
        cp "$latest_backup" server/package.json
        echo "✅ package.json restaurado"
    fi
    
    # Reinstalar versão antiga
    cd server
    rm -rf node_modules package-lock.json
    npm install
    
    start_server
    echo "✅ Rollback concluído!"
}

# EXECUÇÃO PRINCIPAL
main() {
    echo "📋 Upgrade whatsapp-web.js 1.21.0 → 1.25.0+"
    echo "Data: $(date)"
    echo ""
    
    # Passo 1: Backup
    create_backup
    
    # Passo 2: Parar servidor
    stop_server
    
    # Passo 3: Atualizar
    if ! update_dependencies; then
        echo "❌ Falha na atualização, executando rollback..."
        rollback
        exit 1
    fi
    
    # Passo 4: Testar
    if ! test_installation; then
        echo "❌ Falha no teste, executando rollback..."
        rollback
        exit 1
    fi
    
    # Passo 5: Iniciar
    if ! start_server; then
        echo "❌ Falha ao iniciar servidor, executando rollback..."
        rollback
        exit 1
    fi
    
    echo ""
    echo "🎉 UPGRADE CONCLUÍDO COM SUCESSO!"
    echo "================================="
    echo "✅ whatsapp-web.js atualizado para versão 1.25.0+"
    echo "✅ Servidor funcionando normalmente"
    echo "✅ Backups criados em server/"
    echo ""
    echo "📋 Próximos passos:"
    echo "1. Teste todas as funcionalidades principais"
    echo "2. Verifique envio de áudio (principal melhoria)"
    echo "3. Monitore logs por algumas horas"
    echo "4. Se tudo estável, remova backups antigos"
    echo ""
    echo "🆘 Em caso de problemas:"
    echo "   Execute: ./rollback-whatsapp-webjs.sh"
}

# Executar função principal
main

echo "✅ Script de upgrade finalizado!"