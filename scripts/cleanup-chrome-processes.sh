
#!/bin/bash

# Script para limpar processos Chrome órfãos do WhatsApp Multi-Cliente
# Arquivo: scripts/cleanup-chrome-processes.sh

echo "🧹 LIMPEZA DE PROCESSOS CHROME - WHATSAPP MULTI-CLIENTE"
echo "====================================================="

echo "🔍 Identificando processos Chrome do WhatsApp..."

# Listar processos Chrome relacionados ao WhatsApp
echo "📊 Processos Chrome atuais:"
ps aux | grep -E "(chrome|chromium).*remote-debugging" | grep -v grep | head -10

echo ""
echo "🛑 Parando processos Chrome órfãos..."

# Parar processos Chrome com debugging port
pkill -f "chrome.*--remote-debugging-port" || echo "  Nenhum processo Chrome com debugging encontrado"

# Parar processos Chrome do puppeteer
pkill -f "chrome.*puppeteer" || echo "  Nenhum processo Chrome do Puppeteer encontrado"

# Parar processos Chrome headless
pkill -f "chrome.*headless" || echo "  Nenhum processo Chrome headless encontrado"

# Parar processos Chromium
pkill -f "chromium.*remote-debugging" || echo "  Nenhum processo Chromium encontrado"

sleep 3

echo ""
echo "🧽 Limpando diretórios temporários..."

# Limpar diretórios temporários do Chrome
rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true

# Limpar sessões órfãs do WhatsApp Web.js
if [ -d "server/.wwebjs_auth" ]; then
    echo "🗂️ Limpando sessões órfãs do WhatsApp Web.js..."
    find server/.wwebjs_auth -name "session-*" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true
    echo "  Sessões antigas removidas"
fi

# Limpar cache do Puppeteer
if [ -d "server/.wwebjs_cache" ]; then
    echo "🗂️ Limpando cache do Puppeteer..."
    rm -rf server/.wwebjs_cache/* 2>/dev/null || true
fi

echo ""
echo "📊 Status final dos processos Chrome:"
CHROME_COUNT=$(ps aux | grep -E "(chrome|chromium)" | grep -v grep | wc -l)
if [ "$CHROME_COUNT" -eq 0 ]; then
    echo "✅ Nenhum processo Chrome em execução"
else
    echo "⚠️ $CHROME_COUNT processos Chrome ainda em execução:"
    ps aux | grep -E "(chrome|chromium)" | grep -v grep | head -5
fi

echo ""
echo "💾 Uso de memória após limpeza:"
free -h | head -2

echo ""
echo "✅ Limpeza de processos Chrome concluída!"
echo "📅 $(date)"
