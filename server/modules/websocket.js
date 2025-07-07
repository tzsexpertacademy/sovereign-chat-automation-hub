
// server/modules/websocket.js - Handlers do Socket.IO
const { cleanupExpiredQRCodes } = require('./database');

// Configurar WebSocket handlers
function setupWebSocketHandlers(io) {
  console.log('🔌 Configurando handlers do WebSocket...');
  
  // Conexão estabelecida
  io.on('connection', (socket) => {
    console.log(`🔗 Nova conexão WebSocket: ${socket.id}`);
    
    // Cliente se juntou a uma sala
    socket.on('join_instance', (instanceId) => {
      socket.join(`instance_${instanceId}`);
      console.log(`🏠 Socket ${socket.id} entrou na sala da instância ${instanceId}`);
    });
    
    // Cliente saiu de uma sala
    socket.on('leave_instance', (instanceId) => {
      socket.leave(`instance_${instanceId}`);
      console.log(`🚪 Socket ${socket.id} saiu da sala da instância ${instanceId}`);
    });
    
    // Solicitar status de uma instância
    socket.on('request_status', async (instanceId) => {
      try {
        console.log(`📊 Status solicitado para instância: ${instanceId}`);
        
        // Aqui você pode adicionar lógica para buscar status do cliente
        // e emitir de volta para o socket
        
        socket.emit('status_response', {
          instanceId,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`❌ Erro ao processar solicitação de status:`, error);
        socket.emit('error', {
          message: 'Erro ao obter status da instância',
          instanceId
        });
      }
    });
    
    // Heartbeat para manter conexão ativa
    socket.on('ping', () => {
      socket.emit('pong');
    });
    
    // Desconexão
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket ${socket.id} desconectado: ${reason}`);
    });
    
    // Erro na conexão
    socket.on('error', (error) => {
      console.error(`💥 Erro no socket ${socket.id}:`, error);
    });
  });
  
  // Emitir eventos globais periodicamente
  setInterval(() => {
    io.emit('server_heartbeat', {
      timestamp: new Date().toISOString(),
      connectedClients: io.engine.clientsCount
    });
  }, 30000); // A cada 30 segundos
  
  console.log('✅ Handlers do WebSocket configurados');
}

// Função para emitir evento para instância específica
function emitToInstance(io, instanceId, event, data) {
  io.to(`instance_${instanceId}`).emit(event, data);
  console.log(`📡 Evento '${event}' enviado para instância ${instanceId}`);
}

// Função para emitir evento global
function emitGlobal(io, event, data) {
  io.emit(event, data);
  console.log(`📡 Evento global '${event}' enviado`);
}

// Configurar limpeza automática de QR codes
function setupAutoCleanup(io) {
  console.log('🧹 Configurando limpeza automática...');
  
  // Limpar QR codes expirados a cada 60 segundos
  setInterval(async () => {
    try {
      const result = await cleanupExpiredQRCodes();
      
      if (result.success && result.count > 0) {
        console.log(`🧹 Limpeza automática: ${result.count} QR codes expirados removidos`);
        
        // Notificar clientes sobre limpeza
        io.emit('qr_cleanup', {
          count: result.count,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Erro na limpeza automática:', error);
    }
  }, 60000);
  
  console.log('✅ Limpeza automática configurada');
}

module.exports = {
  setupWebSocketHandlers,
  emitToInstance,
  emitGlobal,
  setupAutoCleanup
};
