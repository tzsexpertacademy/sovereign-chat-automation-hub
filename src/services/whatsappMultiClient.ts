
import io, { Socket } from 'socket.io-client';
import { SERVER_URL, API_BASE_URL, SOCKET_URL, HTTPS_SERVER_URL, getServerConfig } from '@/config/environment';

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
  private maxReconnectAttempts = 3;
  private reconnectInterval = 3000;
  private healthCheckCache: { result: any; timestamp: number } | null = null;

  constructor() {
    console.log('🔧 WhatsApp Service - Modo Simplificado para Correção');
  }

  // Simplified connection test
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Testando conexão básica...');
      
      // Test direct HTTP first
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Servidor respondendo:', data);
        return {
          success: true,
          message: `✅ Servidor Online! Status: ${data.status} | Uptime: ${Math.floor(data.uptime/60)}min`
        };
      } else {
        return {
          success: false,
          message: `❌ Servidor retornou HTTP ${response.status}`
        };
      }
    } catch (error: any) {
      console.error('❌ Erro na conexão:', error);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: '⏰ Timeout - Servidor não respondeu em 10 segundos'
        };
      } else if (error.message === 'Failed to fetch') {
        return {
          success: false,
          message: '🔒 Problema SSL/CORS - Aceite o certificado em: https://146.59.227.248/health'
        };
      } else {
        return {
          success: false,
          message: `❌ Erro: ${error.message}`
        };
      }
    }
  }

  // Simplified WebSocket connection
  connectSocket(): Socket {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket já conectado');
      return this.socket;
    }

    console.log('🔌 Tentando conectar WebSocket:', SOCKET_URL);

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        forceNew: false,
        upgrade: true,
        rejectUnauthorized: false
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado com sucesso!');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket:', error.message);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('❌ Máximo de tentativas WebSocket atingido');
        }
      });

      return this.socket;
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket:', error);
      throw error;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Simplified API request
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    console.log(`📡 Requisição: ${options.method || 'GET'} ${fullUrl}`);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    };

    const fetchConfig: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      mode: 'cors',
      credentials: 'omit',
      signal: options.signal || AbortSignal.timeout(15000)
    };

    try {
      const response = await fetch(fullUrl, fetchConfig);
      
      console.log(`📡 Resposta: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error: any) {
      console.error(`❌ Erro na requisição para ${fullUrl}:`, error);
      throw error;
    }
  }

  // Health check with cache
  async checkServerHealth(): Promise<ServerHealth> {
    try {
      // Use cache if recent (less than 5 seconds old)
      if (this.healthCheckCache && 
          Date.now() - this.healthCheckCache.timestamp < 5000) {
        console.log('📋 Usando cache do health check');
        return this.healthCheckCache.result;
      }

      console.log('🔍 Health check sem cache...');
      const response = await this.makeRequest('/health');
      
      // Cache the result
      this.healthCheckCache = {
        result: response,
        timestamp: Date.now()
      };
      
      console.log('✅ Health check bem-sucedido:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Health check falhou:', error.message);
      
      // Clear cache on error
      this.healthCheckCache = null;
      
      throw error;
    }
  }

  // Get all clients
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📋 Buscando clientes...');
      const response = await this.makeRequest('/clients');
      
      if (response.success && Array.isArray(response.clients)) {
        console.log(`✅ ${response.clients.length} clientes encontrados`);
        return response.clients;
      } else {
        console.warn('⚠️ Resposta inválida:', response);
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
      console.log(`📊 Status do cliente: ${clientId}`);
      const response = await this.makeRequest(`/clients/${clientId}/status`);
      
      if (response.success) {
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

  // WebSocket event handlers
  joinClientRoom(clientId: string): void {
    if (this.socket?.connected) {
      console.log(`📱 Entrando na sala: ${clientId}`);
      this.socket.emit('join_client', clientId);
    } else {
      console.warn('⚠️ WebSocket não conectado para entrar na sala');
    }
  }

  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void): void {
    if (!this.socket) {
      this.connectSocket();
    }
    
    const eventName = `client_status_${clientId}`;
    console.log(`👂 Ouvindo: ${eventName}`);
    this.socket?.on(eventName, callback);
  }

  offClientStatus(clientId: string, callback?: (data: WhatsAppClient) => void): void {
    const eventName = `client_status_${clientId}`;
    console.log(`🔇 Removendo listener: ${eventName}`);
    
    if (callback) {
      this.socket?.off(eventName, callback);
    } else {
      this.socket?.removeAllListeners(eventName);
    }
  }

  // Send message
  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    try {
      console.log(`📤 Enviando mensagem via ${clientId} para ${to}`);
      return await this.makeRequest(`/clients/${clientId}/send-message`, {
        method: 'POST',
        body: JSON.stringify({ to, message })
      });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  // Get chats
  async getChats(clientId: string): Promise<any> {
    try {
      console.log(`💬 Buscando chats: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/chats`);
    } catch (error) {
      console.error(`❌ Erro ao buscar chats:`, error);
      throw error;
    }
  }
}

// Export singleton instance
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
export { whatsappService };
