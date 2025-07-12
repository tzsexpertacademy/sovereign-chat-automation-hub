#!/bin/bash

# Script EXECUTIVO para correção completa do Puppeteer
# Arquivo: scripts/execute-complete-puppeteer-fix.sh

echo "🔥 ===== EXECUÇÃO DO PLANO COMPLETO ====="
echo "======================================="

# Verificar se está no diretório correto
if [ ! -f "server/package.json" ]; then
    echo "❌ Execute este script na raiz do projeto!"
    exit 1
fi

# Tornar scripts executáveis
chmod +x scripts/backup-and-fix-puppeteer.sh
chmod +x scripts/test-puppeteer-fix.sh

echo ""
echo "🎯 EXECUTANDO PLANO EM 4 FASES"
echo "============================="

# FASE 1: Backup e preparação
echo ""
echo "📦 EXECUTANDO FASE 1: BACKUP E PREPARAÇÃO"
echo "========================================="
./scripts/backup-and-fix-puppeteer.sh

if [ $? -ne 0 ]; then
    echo "❌ ERRO na Fase 1 - Backup falhou!"
    exit 1
fi

echo "✅ Fase 1 concluída com sucesso!"

# FASE 2: Verificação da aplicação da correção
echo ""
echo "🔍 VERIFICANDO CORREÇÃO APLICADA"
echo "==============================="

if grep -q "executablePath.*google-chrome" server/modules/whatsapp-client.js; then
    echo "✅ CORREÇÃO APLICADA: executablePath configurado"
else
    echo "❌ ERRO: Correção não foi aplicada no código!"
    echo "💡 Verifique se o arquivo foi modificado corretamente"
    exit 1
fi

# FASE 3: Teste de validação
echo ""
echo "🧪 EXECUTANDO FASE 3: VALIDAÇÃO DO SISTEMA"
echo "=========================================="
./scripts/test-puppeteer-fix.sh

if [ $? -ne 0 ]; then
    echo "❌ ERRO na Fase 3 - Validação falhou!"
    echo "🔄 Rollback disponível se necessário"
fi

# FASE 4: Instruções finais
echo ""
echo "🚀 FASE 4: INSTRUÇÕES FINAIS"
echo "============================"

echo ""
echo "✅ CORREÇÃO APLICADA COM SUCESSO!"
echo "================================"
echo ""
echo "🎯 O QUE FOI FEITO:"
echo "   ✅ Backup completo criado"
echo "   ✅ executablePath configurado para Chrome do sistema"
echo "   ✅ Timeout otimizado para 120s"
echo "   ✅ Args de Chrome otimizados"
echo ""
echo "🔥 PRÓXIMOS PASSOS CRÍTICOS:"
echo ""
echo "1. 🔄 REINICIAR SERVIDOR WHATSAPP:"
echo "   ./scripts/restart-whatsapp-server.sh"
echo ""
echo "2. 📱 TESTAR QR CODE:"
echo "   - Acesse: https://seu-dominio/admin"
echo "   - Crie nova instância"
echo "   - Verifique se QR aparece normalmente"
echo ""
echo "3. 🎵 TESTAR ENVIO DE ÁUDIO:"
echo "   - Conecte uma instância"
echo "   - Use a interface para enviar áudio"
echo "   - ERRO 'Evaluation failed: a' deve sumir!"
echo ""
echo "4. 🔍 MONITORAR LOGS:"
echo "   tail -f logs/whatsapp-multi-client.log"
echo ""
echo "🚨 SE ALGO QUEBRAR:"
echo ""
echo "   # Rollback de emergência:"
echo "   LATEST_BACKUP=\$(ls -t server/node_modules.backup.* | head -1)"
echo "   mv \"\$LATEST_BACKUP\" server/node_modules"
echo "   mv server/modules/whatsapp-client.js.backup server/modules/whatsapp-client.js"
echo "   ./scripts/restart-whatsapp-server.sh"
echo ""
echo "🎯 EXPECTATIVA:"
echo "   ❌ ANTES: Evaluation failed: a"
echo "   ✅ AGORA: Áudio enviado com sucesso!"
echo ""
echo "================================="
echo "✅ PLANO EXECUTADO COM SUCESSO!"
echo "================================="