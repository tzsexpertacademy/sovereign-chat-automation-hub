#!/bin/bash

echo "🧹 LIMPEZA COMPLETA DO SISTEMA WHATSAPP"
echo "======================================="

echo ""
echo "⚠️ ATENÇÃO: Esta operação vai:"
echo "   • Parar o servidor WhatsApp"
echo "   • Limpar todas as sessões ativas"
echo "   • Remover processos Chrome órfãos"
echo "   • Limpar cache e arquivos temporários"
echo ""

read -p "Deseja continuar? (s/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operação cancelada"
    exit 1
fi

echo "🚀 Iniciando limpeza completa..."

echo ""
echo "1️⃣ PARANDO SERVIDOR"
echo "==================="
./scripts/production-stop-whatsapp.sh

echo ""
echo "2️⃣ LIMPANDO PROCESSOS"
echo "====================="
echo "🔥 Matando processos Chrome/Puppeteer..."
pkill -f chrome || true
pkill -f chromium || true
pkill -f puppeteer || true
pkill -f "node.*whatsapp" || true

sleep 3

REMAINING_CHROME=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)
echo "📊 Processos Chrome restantes: $REMAINING_CHROME"

echo ""
echo "3️⃣ LIMPANDO SESSÕES WHATSAPP"
echo "============================"
cd /home/ubuntu/sovereign-chat-automation-hub/server

echo "🗑️ Removendo sessões antigas..."
rm -rf .wwebjs_auth/session-* 2>/dev/null || true
rm -rf .wwebjs_cache/* 2>/dev/null || true

# Verificar se diretórios foram limpos
AUTH_SESSIONS=$(find .wwebjs_auth -name "session-*" -type d 2>/dev/null | wc -l)
echo "📊 Sessões restantes em .wwebjs_auth: $AUTH_SESSIONS"

echo ""
echo "4️⃣ LIMPANDO ARQUIVOS TEMPORÁRIOS"
echo "================================"
echo "🧹 Limpando arquivos temporários do Chrome..."
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
rm -rf /home/ubuntu/.config/google-chrome/SingletonLock 2>/dev/null || true
rm -rf /home/ubuntu/.cache/google-chrome 2>/dev/null || true

echo ""
echo "5️⃣ LIMPANDO LOGS ANTIGOS"
echo "========================"
cd /home/ubuntu/sovereign-chat-automation-hub

if [ -f "logs/whatsapp-multi-client.log" ]; then
    echo "📋 Fazendo backup do log atual..."
    cp logs/whatsapp-multi-client.log logs/whatsapp-multi-client.log.backup-$(date +%Y%m%d-%H%M%S)
    
    echo "🗑️ Limpando log atual..."
    > logs/whatsapp-multi-client.log
    echo "✅ Log limpo (backup criado)"
else
    echo "ℹ️ Nenhum log para limpar"
fi

echo ""
echo "6️⃣ LIMPANDO INSTÂNCIAS TRAVADAS DO SUPABASE"
echo "==========================================="
echo "🧪 Verificando instâncias no Supabase..."

SUPABASE_URL="https://ymygyagbvbsdfkduxmgu.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

# Atualizar instâncias conectando/qr_ready para disconnected
STUCK_UPDATE=$(curl -s -X PATCH "$SUPABASE_URL/rest/v1/whatsapp_instances?status=in.(connecting,qr_ready)" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"disconnected\",
    \"has_qr_code\": false,
    \"qr_code\": null,
    \"qr_expires_at\": null,
    \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
  }")

echo "✅ Instâncias travadas resetadas no Supabase"

echo ""
echo "7️⃣ VERIFICAÇÃO FINAL"
echo "===================="
echo "💾 Uso de memória após limpeza:"
free -h | head -2

echo ""
echo "🔍 Processos Chrome restantes:"
FINAL_CHROME=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)
echo "   Quantidade: $FINAL_CHROME"

echo ""
echo "📁 Espaço liberado:"
cd /home/ubuntu/sovereign-chat-automation-hub/server
du -sh .wwebjs_auth .wwebjs_cache 2>/dev/null || echo "Diretórios limpos"

echo ""
echo "8️⃣ PREPARAÇÃO PARA REINÍCIO"
echo "==========================="
echo "🔧 Verificando dependências..."
if [ ! -d "node_modules" ]; then
    echo "⚠️ Dependências não instaladas - executando npm install..."
    npm install
else
    echo "✅ Dependências OK"
fi

echo ""
echo "🎉 LIMPEZA COMPLETA FINALIZADA!"
echo "=============================="
echo "✅ Servidor parado"
echo "✅ Processos Chrome limpos"
echo "✅ Sessões WhatsApp removidas"
echo "✅ Cache temporário limpo"
echo "✅ Instâncias Supabase resetadas"
echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "1. Executar correção: './scripts/fix-puppeteer-complete.sh'"
echo "2. Ou iniciar servidor: './scripts/production-start-whatsapp.sh'"
echo ""
echo "✅ Sistema pronto para nova inicialização!"
echo "📅 $(date)"