
#!/bin/bash

# Script para monitorar logs do WhatsApp Multi-Client
# Use: ./scripts/monitor-whatsapp-logs.sh

LOG_FILE="logs/whatsapp-multi-client.log"
SERVER_IP="146.59.227.248"
SERVER_PORT="4000"

echo "📊 ===== MONITOR DE LOGS WHATSAPP MULTI-CLIENT ====="
echo "📁 Arquivo de log: ${LOG_FILE}"
echo "🌐 Servidor: http://${SERVER_IP}:${SERVER_PORT}"
echo ""

# Verificar se o arquivo de log existe
if [ ! -f "${LOG_FILE}" ]; then
  echo "⚠️  Arquivo de log não encontrado: ${LOG_FILE}"
  echo "🔍 Tentando localizar logs..."
  
  # Procurar por arquivos de log em locais comuns
  find . -name "*whatsapp*.log" -o -name "*multi-client*.log" 2>/dev/null | head -5
  
  echo ""
  echo "📝 Se não encontrar logs, verifique:"
  echo "   • Se o servidor está rodando"
  echo "   • Se o diretório logs/ existe"
  echo "   • Se há permissões de escrita"
  exit 1
fi

echo "🔄 Iniciando monitoramento em tempo real..."
echo "   💡 Use Ctrl+C para parar"
echo "   🔍 Filtrando por: send-audio, áudio, FormData, POST"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Monitorar logs em tempo real com filtros
tail -f "${LOG_FILE}" | grep --line-buffered -i -E "(send-audio|áudio|audio|formdata|POST.*audio|erro|error|success|cliente|client)" | while read line; do
  # Adicionar timestamp se não houver
  if [[ $line == *"$(date +%Y-%m-%d)"* ]]; then
    echo "📅 $line"
  else
    echo "⏰ $(date '+%H:%M:%S') | $line"
  fi
done
