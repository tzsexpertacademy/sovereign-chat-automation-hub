# WhatsApp Multi-Client Server - Guia de Uso

## 📋 Servidor Unificado

O sistema agora usa **um único método** para evitar conflitos de porta e duplicação de processos.

## 🚀 Comandos Principais

### Produção (Recomendado)
```bash
# Iniciar servidor (porta 4000, PM2)
npm start

# Parar servidor
npm stop

# Reiniciar servidor
npm restart

# Forçar parada completa
npm run force-stop
```

### Desenvolvimento (Porta 4001)
```bash
# Servidor simples para desenvolvimento
npm run dev

# Servidor com hot-reload
npm run dev-watch
```

## 🔧 Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `npm start` | Produção PM2 | Servidor principal (porta 4000) |
| `npm stop` | Para produção | Para servidor PM2 |
| `npm restart` | Reinicia | Para + inicia servidor |
| `npm run dev` | Desenvolvimento | Servidor simples (porta 4001) |
| `npm run dev-watch` | Dev + watch | Com hot-reload (porta 4001) |
| `npm run force-stop` | Parada forçada | Mata todos os processos |

## 📊 Verificações

```bash
# Status do servidor
curl http://localhost:4000/health

# API Documentation
curl http://localhost:4000/api-docs

# Logs em tempo real
tail -f logs/whatsapp-multi-client.log
```

## ⚠️ Importante

- **USE APENAS `npm start`** para produção
- **Porta 4000** = Produção (PM2)
- **Porta 4001** = Desenvolvimento
- **QR Code** funciona apenas no servidor de produção
- **WebSocket** requer servidor de produção

## 🛠️ Resolução de Problemas

```bash
# Se porta 4000 estiver ocupada
npm run force-stop
sudo fuser -k 4000/tcp

# Limpar tudo e recomeçar
npm run force-stop
npm run clean-install
npm start
```