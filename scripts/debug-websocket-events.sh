#!/bin/bash

echo "🔌 TESTE DE EVENTOS WEBSOCKET"
echo "================================"

# Criar um cliente WebSocket simples para testar eventos
cat > /tmp/websocket-test.js << 'EOF'
const io = require('socket.io-client');

console.log('🔌 Conectando ao WebSocket...');
const socket = io('https://146.59.227.248', {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ WebSocket conectado!');
  console.log('Socket ID:', socket.id);
  
  // Entrar na sala de uma instância específica
  const instanceId = '35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751730495129';
  socket.emit('join_client_room', instanceId);
  console.log(`🚪 Entrando na sala: ${instanceId}`);
});

socket.on('disconnect', (reason) => {
  console.log('❌ WebSocket desconectado:', reason);
});

socket.on('connect_error', (error) => {
  console.log('❌ Erro de conexão:', error.message);
});

// Escutar todos os eventos possíveis
const events = [
  'client_status_update',
  'client_authenticated', 
  'client_ready',
  'client_qr',
  'client_status_35f36a03-39b2-412c-bba6-01fdd45c2dd3_1751730495129'
];

events.forEach(eventName => {
  socket.on(eventName, (data) => {
    console.log(`📡 Evento recebido [${eventName}]:`, JSON.stringify(data, null, 2));
  });
});

// Escutar qualquer evento
const originalOn = socket.on;
socket.on = function(event, callback) {
  const wrappedCallback = function(...args) {
    if (!events.includes(event) && !event.startsWith('client_status_')) {
      console.log(`📡 Evento não mapeado [${event}]:`, args);
    }
    return callback.apply(this, args);
  };
  return originalOn.call(this, event, wrappedCallback);
};

console.log('🎧 Escutando eventos WebSocket... (Ctrl+C para sair)');
console.log('Eventos monitorados:', events);

// Manter o script rodando
setInterval(() => {
  if (socket.connected) {
    console.log('💗 Heartbeat - Socket ainda conectado');
  } else {
    console.log('💔 Socket desconectado');
  }
}, 30000);
EOF

# Verificar se socket.io-client existe
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js não encontrado!"
    exit 1
fi

cd /home/ubuntu/sovereign-chat-automation-hub/server

if [ ! -d "node_modules/socket.io-client" ]; then
    echo "📦 Instalando socket.io-client..."
    npm install socket.io-client
fi

echo "🚀 Iniciando teste WebSocket..."
node /tmp/websocket-test.js