// YUMER Native WebSocket Service - Substituição completa do Socket.IO
import { SOCKET_URL } from '@/config/environment';
import { yumerJwtService } from './yumerJwtService';

export interface WebSocketConnectionOptions {
  instanceName: string;
  event: string;
  useSecureConnection?: boolean;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export type WebSocketEventHandler = (data: any) => void;
export type WebSocketStatusHandler = (status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting') => void;

class YumerNativeWebSocketService {
  private ws: WebSocket | null = null;
  private connectionOptions: WebSocketConnectionOptions | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private statusHandlers: WebSocketStatusHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isManualDisconnect = false;

  // ============ CONEXÃO WEBSOCKET NATIVA ============
  async connect(options: WebSocketConnectionOptions): Promise<void> {
    this.connectionOptions = options;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.isManualDisconnect = false;

    await this.establishConnection();
  }

  private async establishConnection(): Promise<void> {
    if (!this.connectionOptions) {
      throw new Error('Opções de conexão não definidas');
    }

    try {
      this.notifyStatus('connecting');
      console.log('🔌 Conectando WebSocket nativo YUMER...');

      // Gerar JWT para autenticação (local - sem endpoint)
      const jwtSecret = 'sfdgs8152g5s1s5'; // Secret hardcoded conforme backend
      const jwt = await yumerJwtService.generateLocalJWT(jwtSecret, this.connectionOptions.instanceName);
      
      // Construir URL com parâmetros obrigatórios
      const url = new URL('/ws/events', SOCKET_URL);
      url.searchParams.set('event', this.connectionOptions.event);
      url.searchParams.set('token', jwt);

      // Determinar protocolo (ws:// ou wss://)
      const protocol = this.connectionOptions.useSecureConnection !== false ? 'wss:' : 'ws:';
      const wsUrl = url.toString().replace(/^https?:/, protocol);

      console.log('📡 Conectando em:', wsUrl);
      console.log('🎯 Evento:', this.connectionOptions.event);
      console.log('🔐 Instância:', this.connectionOptions.instanceName);

      // Criar conexão WebSocket
      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();

    } catch (error: any) {
      console.error('❌ Erro ao estabelecer conexão:', error);
      this.notifyStatus('error');
      
      if (this.connectionOptions.autoReconnect !== false) {
        this.scheduleReconnect();
      }
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('✅ WebSocket nativo conectado com sucesso!');
      this.reconnectAttempts = 0;
      this.notifyStatus('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [CODECHAT] Mensagem recebida:', data);
        
        // Processar evento baseado na estrutura do CodeChat
        this.processCodeChatMessage(data);
      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        console.log('📦 Dados brutos:', event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket fechado:', event.code, event.reason);
      this.notifyStatus('disconnected');
      
      if (!this.isManualDisconnect && this.connectionOptions?.autoReconnect !== false) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Erro no WebSocket:', error);
      this.notifyStatus('error');
    };
  }

  // ============ PROCESSAMENTO CODECHAT API v1.3.3 ============
  private processCodeChatMessage(data: any): void {
    try {
      console.log('📨 [CODECHAT] Processando mensagem CodeChat API v1.3.3:', data);
      
      // Identificar tipo de evento baseado na estrutura CodeChat
      let eventType = 'unknown';
      let eventData = data;
      
      // Estrutura baseada na documentação CodeChat API v1.3.3
      if (data.event) {
        // Eventos webhook padrão CodeChat
        const codechatEvents: Record<string, string> = {
          'qrcodeUpdated': 'qr_code',
          'connectionUpdated': 'instance_status', 
          'statusInstance': 'instance_status',
          'messagesUpsert': 'message_received',
          'messagesUpdated': 'message_updated',
          'chatsUpsert': 'chat_update',
          'contactsUpsert': 'contact_update'
        };
        
        eventType = codechatEvents[data.event] || data.event;
        eventData = {
          instanceName: this.connectionOptions?.instanceName,
          originalEvent: data.event,
          ...data.data,
          ...data
        };
        
        console.log(`🎯 [CODECHAT] Evento mapeado: ${data.event} → ${eventType}`);
      } 
      // QR Code direto da resposta /instance/connect
      else if (data.base64 || data.qrCode || data.code) {
        eventType = 'qr_code';
        eventData = {
          instanceName: this.connectionOptions?.instanceName,
          qrCode: data.base64 || data.qrCode || data.code,
          count: data.count
        };
        console.log(`📱 [CODECHAT] QR Code recebido via connect response`);
      }
      // Status de conexão da resposta /instance/connectionState
      else if (data.state !== undefined) {
        eventType = 'instance_status';
        eventData = {
          instanceName: this.connectionOptions?.instanceName,
          status: this.mapCodeChatStatus(data.state),
          statusReason: data.statusReason,
          rawState: data.state
        };
        console.log(`🔌 [CODECHAT] Status de conexão: ${data.state}`);
      }
      // Instância com conexão Whatsapp
      else if (data.Whatsapp?.connection) {
        eventType = 'instance_status';
        eventData = {
          instanceName: this.connectionOptions?.instanceName,
          status: this.mapCodeChatStatus(data.Whatsapp.connection.state),
          statusReason: data.Whatsapp.connection.statusReason,
          phoneNumber: data.ownerJid,
          profilePicUrl: data.profilePicUrl
        };
        console.log(`📱 [CODECHAT] Instância conectada: ${data.Whatsapp.connection.state}`);
      }
      
      console.log(`🎯 [CODECHAT] Evento processado: ${eventType}`, eventData);
      
      // Notificar handlers registrados para o evento específico
      if (this.eventHandlers.has(eventType)) {
        console.log(`📢 [CODECHAT] Notificando ${this.eventHandlers.get(eventType)!.length} handlers para ${eventType}`);
        this.notifyEventHandlers(eventType, eventData);
      }
      
      // Fallback - notificar como message_received para debug
      if (eventType !== 'message_received') {
        this.notifyEventHandlers('message_received', { type: eventType, data: eventData, original: data });
      }
      
    } catch (error) {
      console.error('❌ [CODECHAT] Erro ao processar mensagem:', error);
    }
  }

  // Mapear status CodeChat para nossos status internos
  private mapCodeChatStatus(state: string): string {
    const statusMap: Record<string, string> = {
      'open': 'connected',
      'close': 'disconnected',
      'connecting': 'connecting',
      'CONNECTED': 'connected',
      'DISCONNECTED': 'disconnected',
      'CONNECTING': 'connecting',
      'qr': 'qr_ready'
    };
    
    return statusMap[state] || state;
  }

  // ============ RECONEXÃO AUTOMÁTICA ============
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay}ms`);
    this.notifyStatus('reconnecting');

    setTimeout(async () => {
      try {
        await this.establishConnection();
      } catch (error) {
        console.error('❌ Falha na reconexão:', error);
      }
    }, delay);
  }

  // ============ ENVIO DE MENSAGENS ============
  send(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket não está conectado');
      return;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      console.log('📤 Mensagem enviada:', data);
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
    }
  }

  // ============ GERENCIAMENTO DE EVENTOS ============
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) return;
    
    if (handler) {
      const handlers = this.eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.set(event, []);
    }
  }

  onStatus(handler: WebSocketStatusHandler): void {
    this.statusHandlers.push(handler);
  }

  offStatus(handler: WebSocketStatusHandler): void {
    const index = this.statusHandlers.indexOf(handler);
    if (index > -1) {
      this.statusHandlers.splice(index, 1);
    }
  }

  private notifyEventHandlers(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('❌ Erro no handler de evento:', error);
      }
    });
  }

  private notifyStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'): void {
    this.statusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('❌ Erro no handler de status:', error);
      }
    });
  }

  // ============ CONTROLE DE CONEXÃO ============
  disconnect(): void {
    this.isManualDisconnect = true;
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    yumerJwtService.clearRenewal();
    console.log('🔌 WebSocket desconectado manualmente');
  }

  getConnectionState(): number {
    return this.ws?.readyState || WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionInfo(): any {
    if (!this.connectionOptions) return null;
    
    return {
      instanceName: this.connectionOptions.instanceName,
      event: this.connectionOptions.event,
      state: this.getConnectionState(),
      stateText: this.getStateText(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isSecure: this.connectionOptions.useSecureConnection !== false,
    };
  }

  private getStateText(): string {
    switch (this.getConnectionState()) {
      case WebSocket.CONNECTING: return 'Conectando';
      case WebSocket.OPEN: return 'Conectado';
      case WebSocket.CLOSING: return 'Fechando';
      case WebSocket.CLOSED: return 'Fechado';
      default: return 'Desconhecido';
    }
  }

  // ============ TESTE DE CONECTIVIDADE ============
  async testConnection(options: WebSocketConnectionOptions): Promise<{ success: boolean; error?: string; details?: any }> {
    const testOptions = { ...options, autoReconnect: false };
    
    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Timeout na conexão' });
        }
      }, 10000);

      this.connect(testOptions)
        .then(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.disconnect();
            resolve({ 
              success: true, 
              details: { 
                protocol: testOptions.useSecureConnection !== false ? 'wss://' : 'ws://',
                event: testOptions.event,
                instanceName: testOptions.instanceName
              }
            });
          }
        })
        .catch((error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({ success: false, error: error.message, details: { protocol: testOptions.useSecureConnection !== false ? 'wss://' : 'ws://' } });
          }
        });
    });
  }
}

export const yumerNativeWebSocketService = new YumerNativeWebSocketService();