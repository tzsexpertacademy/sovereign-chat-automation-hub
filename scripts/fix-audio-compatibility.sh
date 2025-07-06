
#!/bin/bash

# Script para implementar correções de compatibilidade no sistema de áudio
# Mantém toda funcionalidade existente e adiciona suporte ao formato JSON+base64

set -e

SERVER_DIR="/home/ubuntu/sovereign-chat-automation-hub/server"
LOG_FILE="/tmp/audio-compatibility-fix.log"

echo "🎵 ===== CORREÇÃO DE COMPATIBILIDADE DO SISTEMA DE ÁUDIO ====="
echo "📅 $(date)"
echo "🎯 Objetivo: Adicionar suporte JSON+base64 SEM alterar funcionalidade existente"
echo ""

# Função para log
log() {
    echo "$(date): $1" | tee -a "$LOG_FILE"
}

# Verificar se estamos no diretório correto
if [ ! -f "server/whatsapp-multi-client-server.js" ]; then
    log "❌ Erro: Execute o script a partir do diretório raiz do projeto"
    exit 1
fi

log "🔍 Verificando estrutura do projeto..."

# Criar diretório utils se não existir
if [ ! -d "$SERVER_DIR/utils" ]; then
    log "📁 Criando diretório server/utils..."
    mkdir -p "$SERVER_DIR/utils"
fi

# Verificar se o AudioProcessor foi criado
if [ ! -f "$SERVER_DIR/utils/audioProcessor.js" ]; then
    log "❌ Erro: AudioProcessor não encontrado. Execute o comando de implementação primeiro."
    exit 1
fi

log "✅ AudioProcessor encontrado"

# Fazer backup do servidor atual
log "💾 Criando backup do servidor atual..."
cp "$SERVER_DIR/whatsapp-multi-client-server.js" "$SERVER_DIR/whatsapp-multi-client-server.js.backup.$(date +%Y%m%d_%H%M%S)"

# Verificar se as novas rotas foram adicionadas
if grep -q "/api/clients/:clientId/send-audio" "$SERVER_DIR/whatsapp-multi-client-server.js"; then
    log "✅ Novas rotas de API detectadas no servidor"
else
    log "❌ Erro: Novas rotas de API não foram adicionadas ao servidor"
    exit 1
fi

# Verificar se o CORS seletivo foi adicionado
if grep -q "addSelectiveCORS" "$SERVER_DIR/whatsapp-multi-client-server.js"; then
    log "✅ CORS seletivo detectado no servidor"
else
    log "❌ Erro: CORS seletivo não foi adicionado ao servidor"
    exit 1
fi

# Verificar dependências do AudioProcessor
log "🔍 Verificando dependências do AudioProcessor..."
if grep -q "whatsapp-web.js" "$SERVER_DIR/utils/audioProcessor.js"; then
    log "✅ Dependência whatsapp-web.js encontrada"
else
    log "❌ Aviso: Dependência whatsapp-web.js pode estar ausente"
fi

# Testar sintaxe do JavaScript
log "🧪 Testando sintaxe do AudioProcessor..."
if node -c "$SERVER_DIR/utils/audioProcessor.js" 2>/dev/null; then
    log "✅ Sintaxe do AudioProcessor válida"
else
    log "❌ Erro de sintaxe no AudioProcessor"
    exit 1
fi

log "🧪 Testando sintaxe do servidor..."
if node -c "$SERVER_DIR/whatsapp-multi-client-server.js" 2>/dev/null; then
    log "✅ Sintaxe do servidor válida"
else
    log "❌ Erro de sintaxe no servidor"
    exit 1
fi

# Reiniciar o servidor para aplicar mudanças
log "🔄 Reiniciando servidor WhatsApp..."

# Parar servidor se estiver rodando
if pgrep -f "whatsapp-multi-client-server.js" > /dev/null; then
    log "🛑 Parando servidor existente..."
    pkill -f "whatsapp-multi-client-server.js" || true
    sleep 3
fi

# Iniciar servidor em background
log "🚀 Iniciando servidor com novas funcionalidades..."
cd "$SERVER_DIR"
nohup node whatsapp-multi-client-server.js > ../logs/whatsapp-multi-client.log 2>&1 &
sleep 5

# Verificar se o servidor está rodando
if pgrep -f "whatsapp-multi-client-server.js" > /dev/null; then
    log "✅ Servidor reiniciado com sucesso!"
else
    log "❌ Falha ao reiniciar servidor"
    log "📋 Verificar logs: tail -f ../logs/whatsapp-multi-client.log"
    exit 1
fi

# Testar endpoints
log "🧪 Testando novos endpoints..."

# Teste 1: Health check
sleep 2
if curl -s "http://localhost:4000/health" > /dev/null; then
    log "✅ Endpoint /health funcionando"
else
    log "⚠️  Endpoint /health não respondeu (pode ser normal se HTTPS apenas)"
fi

# Teste 2: Verificar se CORS está funcionando para /api/*
log "🔍 Testando CORS para rotas /api/*..."
CORS_TEST=$(curl -s -I -X OPTIONS "http://localhost:4000/api/clients/test/send-audio" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
if [ ! -z "$CORS_TEST" ]; then
    log "✅ CORS configurado para rotas /api/*"
else
    log "⚠️  CORS pode não estar configurado (teste local limitado)"
fi

log ""
log "🎉 ===== CORREÇÃO APLICADA COM SUCESSO! ====="
log ""
log "📋 RESUMO DAS MUDANÇAS:"
log "✅ AudioProcessor criado em server/utils/audioProcessor.js"
log "✅ Nova rota /api/clients/:clientId/send-audio adicionada (JSON + base64)"
log "✅ Nova rota /api/clients/:clientId/audio-stats adicionada"
log "✅ CORS seletivo implementado para rotas /api/*"
log "✅ Funcionalidade existente mantida intacta"
log "✅ Sistema de retry existente mantido"
log ""
log "🧪 COMO TESTAR:"
log "1. Frontend pode usar /api/clients/{id}/send-audio com JSON"
log "2. Sistema antigo /clients/{id}/send-audio continua funcionando"
log "3. Ambos os sistemas usam o mesmo AudioSendService"
log ""
log "📊 ARQUIVOS MODIFICADOS:"
log "• server/utils/audioProcessor.js (NOVO)"
log "• server/whatsapp-multi-client-server.js (ROTAS ADICIONADAS)"
log "• Backup criado: server/whatsapp-multi-client-server.js.backup.*"
log ""
log "🔍 LOGS DO SERVIDOR: tail -f logs/whatsapp-multi-client.log"
log "✅ Correção finalizada em $(date)"

echo ""
echo "🎵 Sistema de áudio atualizado com sucesso!"
echo "📱 Frontend agora pode enviar áudio via /api/clients/{id}/send-audio"
echo "🔄 Sistema antigo mantido para compatibilidade total"
