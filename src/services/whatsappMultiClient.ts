
import io, { Socket } from 'socket.io-client';

export interface WhatsAppClient {
  clientId: string;
  status: 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'disconnected' | 'auth_failed';
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
}

export interface ServerHealth {
  status: string;
  timestamp: string;
  activeClients: number;
  connectedClients: number;
  uptime: number;
  memory: any;
  version: string;
  server: string;
}

class WhatsAppMultiClientService {
  private socket: Socket | null = null;
  private readonly baseUrl = 'https://146.59.227.248';

  constructor() {
    console.log('🔧 WhatsApp Service inicializado:', this.baseUrl);
  }

  // Método para fazer requisições HTTP
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`📡 Requisição: ${options.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Resposta recebida:', data);
      return data;
    } catch (error: any) {
      console.error(`❌ Erro na requisição para ${url}:`, error);
      throw error;
    }
  }

  // Connect to WebSocket
  connectSocket(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    console.log('🔌 Conectando WebSocket:', `${this.baseUrl}`);

    this.socket = io(this.baseUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro WebSocket:', error);
    });

    return this.socket;
  }

  // Get socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  // API Methods
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      const response = await this.makeRequest('/clients');
      return response.clients || [];
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      return [];
    }
  }

  async connectClient(clientId: string): Promise<any> {
    return this.makeRequest(`/clients/${clientId}/connect`, {
      method: 'POST'
    });
  }

  async disconnectClient(clientId: string): Promise<any> {
    return this.makeRequest(`/clients/${clientId}/disconnect`, {
      method: 'POST'
    });
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    const response = await this.makeRequest(`/clients/${clientId}/status`);
    return {
      clientId: response.clientId || clientId,
      status: response.status,
      phoneNumber: response.phoneNumber,
      hasQrCode: response.hasQrCode,
      qrCode: response.qrCode
    };
  }

  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    return this.makeRequest(`/clients/${clientId}/send-message`, {
      method: 'POST',
      body: JSON.stringify({ to, message })
    });
  }

  async getChats(clientId: string): Promise<any> {
    return this.makeRequest(`/clients/${clientId}/chats`);
  }

  async checkServerHealth(): Promise<ServerHealth> {
    return this.makeRequest('/health');
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const health = await this.checkServerHealth();
      return {
        success: true,
        message: `✅ Servidor funcionando! Status: ${health.status}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `❌ Erro: ${error.message}`
      };
    }
  }

  // WebSocket methods
  joinClientRoom(clientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_client', clientId);
    }
  }

  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void): void {
    if (!this.socket) {
      this.connectSocket();
    }
    const eventName = `client_status_${clientId}`;
    this.socket?.on(eventName, callback);
  }

  offClientStatus(clientId: string, callback?: (data: WhatsAppClient) => void): void {
    const eventName = `client_status_${clientId}`;
    if (callback) {
      this.socket?.off(eventName, callback);
    } else {
      this.socket?.removeAllListeners(eventName);
    }
  }
}

const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
export { whatsappService };
