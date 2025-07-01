
import io, { Socket } from 'socket.io-client';
import { SERVER_URL, API_BASE_URL, SOCKET_URL, getServerConfig } from '@/config/environment';

export interface WhatsAppClient {
  clientId: string;
  status: 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'disconnected' | 'auth_failed';
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
  qrTimestamp?: string;
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
  protocol?: string;
  cors?: any;
}

class WhatsAppMultiClientService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;

  constructor() {
    console.log('🔧 WhatsApp Multi-Client Service iniciado');
    const config = getServerConfig();
    console.log('📡 URLs configuradas:', {
      SERVER_URL,
      API_BASE_URL,
      SOCKET_URL,
      protocol: config.protocol,
      serverIP: config.serverIP,
      serverPort: config.serverPort
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
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        forceNew: true,
        withCredentials: false,
        extraHeaders: {
          'Origin': window.location.origin,
          'User-Agent': 'Lovable-WhatsApp-Client'
        }
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado com sucesso');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error.message);
        this.reconnectAttempts++;
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

  // API Methods with proper error handling
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    console.log(`🔗 Requisição: ${options.method || 'GET'} ${fullUrl}`);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': window.location.origin
    };

    const fetchConfig: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      mode: 'cors',
      credentials: 'omit',
      signal: options.signal || AbortSignal.timeout(30000)
    };

    try {
      const response = await fetch(fullUrl, fetchConfig);
      
      console.log(`📡 Resposta: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('✅ Dados JSON recebidos:', data);
        return data;
      } else {
        const text = await response.text();
        console.log('✅ Texto recebido:', text);
        return text;
      }
    } catch (error: any) {
      console.error(`❌ Erro para ${fullUrl}:`, error);
      
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error('TIMEOUT_ERROR');
      } else if (error.message === 'Failed to fetch' || 
                 error.name === 'TypeError' ||
                 error.message.includes('net::')) {
        throw new Error('CONNECTION_ERROR');
      }
      
      throw error;
    }
  }

  // Get all clients
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📋 Buscando todos os clientes...');
      const response = await this.makeRequest('/clients');
      
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

  // Connect client
  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔗 Conectando cliente: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/connect`, {
        method: 'POST'
      });
    } catch (error: any) {
      console.error(`❌ Erro ao conectar cliente ${clientId}:`, error.message);
      throw error;
    }
  }

  // Disconnect client
  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/disconnect`, {
        method: 'POST'
      });
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Get client status
  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      console.log(`📊 Verificando status do cliente: ${clientId}`);
      const response = await this.makeRequest(`/clients/${clientId}/status`);
      
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

  // Send message
  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    try {
      console.log(`📤 Enviando mensagem via cliente ${clientId} para ${to}`);
      return await this.makeRequest(`/clients/${clientId}/send-message`, {
        method: 'POST',
        body: JSON.stringify({ to, message })
      });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
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
      console.error('❌ Health check falhou:', error.message);
      
      if (error.message === 'CONNECTION_ERROR') {
        throw new Error('SERVER_OFFLINE');
      } else if (error.message === 'TIMEOUT_ERROR') {
        throw new Error('SERVER_TIMEOUT');
      }
      
      throw error;
    }
  }

  // Test connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Testando conexão...');
      const health = await this.checkServerHealth();
      
      if (health && health.status === 'ok') {
        return {
          success: true,
          message: `✅ Servidor funcionando! IP: ${health.server || 'localhost:4000'} | Versão: ${health.version || 'unknown'}`
        };
      } else {
        return {
          success: false,
          message: 'Servidor respondeu mas com status inválido'
        };
      }
    } catch (error: any) {
      console.error('❌ Teste de conexão falhou:', error.message);
      
      if (error.message === 'SERVER_OFFLINE') {
        return {
          success: false,
          message: 'Servidor offline: Verifique se o servidor está rodando na porta 4000'
        };
      } else if (error.message === 'SERVER_TIMEOUT') {
        return {
          success: false,
          message: 'Timeout: Servidor não respondeu em 30 segundos'
        };
      }
      
      return {
        success: false,
        message: `Erro de conexão: ${error.message}`
      };
    }
  }
}

// Export singleton instance
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;

// Also export as named export for compatibility
export { whatsappService };
