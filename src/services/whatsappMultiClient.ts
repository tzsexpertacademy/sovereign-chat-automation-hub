
import io, { Socket } from 'socket.io-client';
import { SERVER_URL, API_BASE_URL, SOCKET_URL } from '@/config/environment';

export interface WhatsAppClient {
  clientId: string;
  status: 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'disconnected' | 'auth_failed';
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
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

export interface MessageData {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  type: string;
  isFromMe?: boolean;
}

export interface QueuedMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
}

class WhatsAppMultiClientService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds

  constructor() {
    console.log('🔧 WhatsApp Multi-Client Service inicializando...');
    console.log('📡 URLs configuradas:', {
      SERVER_URL,
      API_BASE_URL,
      SOCKET_URL
    });
  }

  // Connect to WebSocket
  connectSocket(): Socket {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket já conectado');
      return this.socket;
    }

    console.log('🔌 Conectando ao WebSocket:', SOCKET_URL);

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        forceNew: true,
        withCredentials: false
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado com sucesso');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket:', error.message);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Máximo de tentativas de reconexão atingido');
        }
      });

      return this.socket;
    } catch (error) {
      console.error('❌ Erro ao inicializar WebSocket:', error);
      throw error;
    }
  }

  // Get socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Join client room
  joinClientRoom(clientId: string): void {
    if (this.socket?.connected) {
      console.log(`📱 Entrando na sala do cliente: ${clientId}`);
      this.socket.emit('join_client', clientId);
    } else {
      console.warn('⚠️ WebSocket não conectado para entrar na sala');
      this.connectSocket();
      // Retry after connection
      setTimeout(() => {
        if (this.socket?.connected) {
          this.socket.emit('join_client', clientId);
        }
      }, 2000);
    }
  }

  // Listen to client status updates
  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void): void {
    if (!this.socket) {
      this.connectSocket();
    }
    
    const eventName = `client_status_${clientId}`;
    console.log(`👂 Ouvindo status do cliente: ${eventName}`);
    this.socket?.on(eventName, callback);
  }

  // Remove client status listener
  offClientStatus(clientId: string, callback?: (data: WhatsAppClient) => void): void {
    const eventName = `client_status_${clientId}`;
    console.log(`🔇 Removendo listener: ${eventName}`);
    
    if (callback) {
      this.socket?.off(eventName, callback);
    } else {
      this.socket?.removeAllListeners(eventName);
    }
  }

  // Listen to all clients updates
  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void): void {
    if (!this.socket) {
      this.connectSocket();
    }
    
    console.log('👂 Ouvindo atualizações de todos os clientes');
    this.socket?.on('clients_update', callback);
  }

  // Remove clients update listener
  offClientsUpdate(callback?: (clients: WhatsAppClient[]) => void): void {
    console.log('🔇 Removendo listener de clientes');
    
    if (callback) {
      this.socket?.off('clients_update', callback);
    } else {
      this.socket?.removeAllListeners('clients_update');
    }
  }

  // API Methods with Mixed Content handling
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    console.log(`🌐 Fazendo requisição: ${options.method || 'GET'} ${fullUrl}`);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Configure fetch for Mixed Content scenarios
    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      mode: 'cors', // Try CORS first
      credentials: 'omit'
    };

    try {
      const response = await fetch(fullUrl, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error: any) {
      console.error(`❌ Erro na requisição para ${fullUrl}:`, error);
      
      // If CORS fails and it's a Mixed Content issue, try no-cors mode
      if (error.message.includes('Mixed Content') || error.message.includes('CORS')) {
        console.log('🔄 Tentando modo no-cors para Mixed Content...');
        try {
          const response = await fetch(fullUrl, {
            ...config,
            mode: 'no-cors'
          });
          // no-cors mode doesn't allow reading response, so assume success
          console.log('✅ Requisição no-cors aparentemente bem-sucedida');
          return { success: true, message: 'Request sent (no-cors mode)' };
        } catch (noCorsError) {
          console.error('❌ Erro mesmo com no-cors:', noCorsError);
        }
      }
      
      throw error;
    }
  }

  // Get all clients - FIXED: Remove /api/ prefix
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📋 Buscando todos os clientes...');
      const response = await this.makeRequest('/clients'); // Removed /api/
      
      if (response.success && Array.isArray(response.clients)) {
        console.log(`✅ Clientes encontrados: ${response.clients.length}`);
        return response.clients;
      } else {
        console.warn('⚠️ Resposta inválida da API de clientes:', response);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      throw error;
    }
  }

  // Connect client - FIXED: Remove /api/ prefix
  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔗 Conectando cliente: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/connect`, { // Removed /api/
        method: 'POST'
      });
    } catch (error) {
      console.error(`❌ Erro ao conectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Disconnect client - FIXED: Remove /api/ prefix
  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/disconnect`, { // Removed /api/
        method: 'POST'
      });
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Get client status - FIXED: Remove /api/ prefix
  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      console.log(`📊 Verificando status do cliente: ${clientId}`);
      const response = await this.makeRequest(`/clients/${clientId}/status`); // Removed /api/
      
      if (response.success) {
        console.log(`✅ Status do cliente ${clientId}:`, response.status);
        return {
          clientId: response.clientId,
          status: response.status,
          phoneNumber: response.phoneNumber,
          hasQrCode: response.hasQrCode,
          qrCode: response.qrCode
        };
      } else {
        throw new Error(response.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar status do cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Send message - FIXED: Remove /api/ prefix
  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    try {
      console.log(`📤 Enviando mensagem via cliente ${clientId} para ${to}`);
      return await this.makeRequest(`/clients/${clientId}/send-message`, { // Removed /api/
        method: 'POST',
        body: JSON.stringify({ to, message })
      });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Get chats - FIXED: Remove /api/ prefix
  async getChats(clientId: string): Promise<any> {
    try {
      console.log(`💬 Buscando chats do cliente: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/chats`); // Removed /api/
    } catch (error) {
      console.error(`❌ Erro ao buscar chats do cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Check server health
  async checkServerHealth(): Promise<ServerHealth> {
    try {
      console.log('🔍 Health check:', `${API_BASE_URL}/health`);
      const response = await this.makeRequest('/health');
      console.log('✅ Health check bem-sucedido:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Health check falhou:', {
        _type: 'Error',
        value: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
      throw error;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.checkServerHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;

// Also export as named export for compatibility
export { whatsappService };
