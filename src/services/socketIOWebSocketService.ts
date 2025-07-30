import { io, Socket } from 'socket.io-client';
import { businessTokenService } from './businessTokenService';
import { webSocketConfigService } from './webSocketConfigService';

interface SocketIOConnectionConfig {
  instanceId: string;
  clientId: string;
  onMessage?: (message: any) => void;
  onQRUpdate?: (qr: any) => void;
  onConnectionUpdate?: (status: any) => void;
  onPresenceUpdate?: (presence: any) => void;
}

interface SocketIOStatus {
  connected: boolean;
  authenticated: boolean;
  configured: boolean;
  lastHeartbeat?: Date;
  reconnectAttempts: number;
  error?: string;
}

class SocketIOWebSocketService {
  private socket: Socket | null = null;
  private config: SocketIOConnectionConfig | null = null;
  private status: SocketIOStatus = {
    connected: false,
    authenticated: false,
    configured: false,
    reconnectAttempts: 0
  };
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Conecta usando Socket.IO conforme documentação oficial da API
   */
  async connect(config: SocketIOConnectionConfig): Promise<boolean> {
    try {
      console.log('🔌 [SOCKET.IO] Iniciando conexão...', {
        instanceId: config.instanceId,
        clientId: config.clientId
      });

      this.config = config;

      // Fase 1: Configurar WebSocket na API
      const configured = await webSocketConfigService.ensureWebSocketConfigured(config.instanceId);
      if (!configured) {
        console.error('❌ [SOCKET.IO] Falha ao configurar WebSocket na API');
        this.updateStatus({ error: 'Falha ao configurar WebSocket na API' });
        return false;
      }

      // Fase 2: Obter token JWT válido
      const token = await businessTokenService.getValidBusinessToken(config.clientId);
      if (!token) {
        console.error('❌ [SOCKET.IO] Falha ao obter token JWT válido');
        this.updateStatus({ error: 'Token JWT inválido' });
        return false;
      }

      // Fase 3: Criar conexão Socket.IO conforme documentação
      // URL: wss://api.domain.com (conforme docs: const socket = io('wss://api.domain.com'))
      this.socket = io('wss://api.yumer.com.br', {
        transports: ['websocket'],
        timeout: 15000,
        reconnection: false, // Controlaremos manualmente
        auth: {
          token: `Bearer ${token}`,
          instanceId: config.instanceId
        },
        extraHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });

      this.setupEventListeners();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('❌ [SOCKET.IO] Timeout na conexão');
          resolve(false);
        }, 15000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ [SOCKET.IO] Conectado com sucesso!');
          this.updateStatus({
            connected: true,
            authenticated: true,
            configured: true,
            reconnectAttempts: 0,
            error: undefined
          });
          this.startHeartbeat();
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ [SOCKET.IO] Erro de conexão:', error);
          this.updateStatus({ 
            error: `Erro de conexão: ${error.message}`,
            reconnectAttempts: this.status.reconnectAttempts + 1
          });
          resolve(false);
        });
      });

    } catch (error: any) {
      console.error('❌ [SOCKET.IO] Erro ao conectar:', error);
      this.updateStatus({ error: error.message });
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Eventos de conexão
    this.socket.on('disconnect', (reason) => {
      console.warn('🚫 [SOCKET.IO] Desconectado:', reason);
      this.updateStatus({ connected: false, authenticated: false });
      this.stopHeartbeat();
      
      // Tentar reconectar se não foi desconexão manual
      if (reason !== 'io client disconnect' && this.status.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    // Fase 3: Mapear eventos conforme documentação
    // Evento principal: messages.upsert (conforme docs)
    this.socket.on('messages.upsert', (data) => {
      console.log('📨 [SOCKET.IO] Nova mensagem recebida via messages.upsert:', data);
      this.processMessage(data);
    });

    // QR Code updates
    this.socket.on('qrcode.update', (data) => {
      console.log('🔲 [SOCKET.IO] QR Code atualizado:', data);
      this.config?.onQRUpdate?.(data);
    });

    // Connection updates  
    this.socket.on('connection.update', (data) => {
      console.log('🔄 [SOCKET.IO] Status de conexão atualizado:', data);
      this.config?.onConnectionUpdate?.(data);
    });

    // Presence updates
    this.socket.on('presence.update', (data) => {
      console.log('👤 [SOCKET.IO] Presença atualizada:', data);
      this.config?.onPresenceUpdate?.(data);
    });

    // Auth errors
    this.socket.on('auth.error', (data) => {
      console.error('🔐 [SOCKET.IO] Erro de autenticação:', data);
      this.updateStatus({ error: 'Erro de autenticação', authenticated: false });
    });

    // Heartbeat response (conforme docs: ping/pong)
    this.socket.on('pong.server', (data) => {
      console.log('🏓 [SOCKET.IO] Pong recebido:', data);
      this.updateStatus({ lastHeartbeat: new Date() });
    });
  }

  /**
   * Processa mensagens recebidas via WebSocket
   * Estrutura baseada nos logs do servidor
   */
  private processMessage(data: any): void {
    try {
      console.log('📨 [SOCKET.IO] Processando mensagem:', data);

      // Estrutura esperada baseada nos logs:
      // {
      //   messageId: '01K1E3A4KXBCVF30H2Y47VHSMT',
      //   keyRemoteJid: '554796451886@s.whatsapp.net',
      //   content: { text: 'cade você' },
      //   messageTimestamp: 1753893638,
      //   instanceInstanceId: '01K11NBE1QB0GVFMME8NA4YPCB'
      // }

      // Verificar se é da nossa instância
      if (this.config && data.instanceInstanceId === this.config.instanceId) {
        console.log('✅ [SOCKET.IO] Mensagem da nossa instância, processando...');
        this.config.onMessage?.(data);
      } else {
        console.log('⚠️ [SOCKET.IO] Mensagem de outra instância, ignorando');
      }

    } catch (error) {
      console.error('❌ [SOCKET.IO] Erro ao processar mensagem:', error);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        console.log('💓 [SOCKET.IO] Enviando ping...');
        this.socket.emit('ping.server', 'ping');
      }
    }, 30000); // 30 segundos
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.status.reconnectAttempts), 30000);
    console.log(`⏰ [SOCKET.IO] Reagendando reconexão em ${delay}ms...`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.config) {
        this.connect(this.config);
      }
    }, delay);
  }

  private updateStatus(updates: Partial<SocketIOStatus>): void {
    this.status = { ...this.status, ...updates };
  }

  disconnect(): void {
    console.log('🔌 [SOCKET.IO] Desconectando...');
    
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.updateStatus({
      connected: false,
      authenticated: false,
      configured: false,
      reconnectAttempts: 0,
      error: undefined
    });
  }

  getStatus(): SocketIOStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.connected && this.socket?.connected === true;
  }

  /**
   * Testa a conectividade Socket.IO
   */
  async testConnection(instanceId: string, clientId: string): Promise<boolean> {
    const testConfig: SocketIOConnectionConfig = {
      instanceId,
      clientId,
      onMessage: (msg) => console.log('🧪 [TEST] Mensagem de teste:', msg)
    };

    const connected = await this.connect(testConfig);
    
    if (connected) {
      // Aguardar um pouco para testar a conexão
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.disconnect();
    }
    
    return connected;
  }
}

export const socketIOWebSocketService = new SocketIOWebSocketService();