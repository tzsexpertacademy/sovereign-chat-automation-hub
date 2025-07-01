
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
  private reconnectInterval = 5000;

  constructor() {
    console.log('🔒 WhatsApp Multi-Client Service - HTTPS DEFINITIVO');
    const config = getServerConfig();
    console.log('📡 URLs HTTPS DEFINITIVO configuradas:', {
      SERVER_URL,
      API_BASE_URL,
      SOCKET_URL,
      HTTPS_SERVER_URL,
      isHttps: config.isHttps,
      nginxProxy: config.nginxProxy,
      lovableCompatible: config.lovableCompatible
    });
  }

  // Connect to WebSocket
  connectSocket(): Socket {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket já conectado');
      return this.socket;
    }

    console.log('🔌 Conectando ao WebSocket HTTPS DEFINITIVO:', SOCKET_URL);

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        forceNew: true,
        withCredentials: false,
        rejectUnauthorized: false, // Accept self-signed certificates
        secure: SOCKET_URL.startsWith('wss://'),
        extraHeaders: {
          'Origin': window.location.origin,
          'User-Agent': 'Lovable-WhatsApp-Client'
        }
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket HTTPS DEFINITIVO conectado');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket HTTPS DEFINITIVO desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket HTTPS DEFINITIVO:', error.message);
        this.reconnectAttempts++;
      });

      return this.socket;
    } catch (error) {
      console.error('❌ Erro ao inicializar WebSocket HTTPS DEFINITIVO:', error);
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

  // API Methods with HTTPS DEFINITIVO
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    console.log(`🔒 Requisição HTTPS DEFINITIVO: ${options.method || 'GET'} ${fullUrl}`);
    
    const config = getServerConfig();
    if (!config.isDevelopment && !fullUrl.startsWith('https://')) {
      throw new Error('HTTPS_REQUIRED: HTTPS é obrigatório via Nginx');
    }
    
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
      signal: options.signal || AbortSignal.timeout(20000)
    };

    try {
      const response = await fetch(fullUrl, fetchConfig);
      
      console.log(`📡 Resposta HTTPS DEFINITIVO: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTPS ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('✅ Dados JSON recebidos via HTTPS DEFINITIVO:', data);
        return data;
      } else {
        const text = await response.text();
        console.log('✅ Texto recebido via HTTPS DEFINITIVO:', text);
        return text;
      }
    } catch (error: any) {
      console.error(`❌ Erro HTTPS DEFINITIVO para ${fullUrl}:`, error);
      
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error('TIMEOUT_ERROR');
      } else if (error.message === 'Failed to fetch' || 
                 error.name === 'TypeError' ||
                 error.message.includes('net::') ||
                 error.message.includes('SSL') ||
                 error.message.includes('certificate') ||
                 error.message.includes('TLS')) {
        throw new Error('SSL_CERTIFICATE_ERROR');
      } else if (error.message.includes('HTTPS_REQUIRED')) {
        throw new Error('HTTPS_REQUIRED');
      }
      
      throw error;
    }
  }

  // Get all clients
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📋 Buscando todos os clientes via HTTPS...');
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

  // Connect client with improved HTTPS handling
  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔗 Conectando cliente via HTTPS: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/connect`, {
        method: 'POST'
      });
    } catch (error: any) {
      console.error(`❌ Erro ao conectar cliente ${clientId}:`, error.message);
      
      if (error.message.includes('HTTPS_CERT_ERROR')) {
        throw new Error('CERTIFICADO_SSL: Acesse https://146.59.227.248/health no navegador e aceite o certificado antes de usar o sistema');
      }
      
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

  // Get chats
  async getChats(clientId: string): Promise<any> {
    try {
      console.log(`💬 Buscando chats do cliente: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/chats`);
    } catch (error) {
      console.error(`❌ Erro ao buscar chats do cliente ${clientId}:`, error);
      throw error;
    }
  }

  // Check if CORS is working
  async checkCorsStatus(): Promise<boolean> {
    try {
      await this.checkServerHealth();
      return true;
    } catch (error: any) {
      if (error.message === 'CORS_ERROR') {
        return false;
      }
      throw error;
    }
  }

  // Check server health with HTTPS DEFINITIVO
  async checkServerHealth(): Promise<ServerHealth> {
    try {
      console.log('🔍 Health check HTTPS DEFINITIVO:', `${API_BASE_URL}/health`);
      
      const response = await this.makeRequest('/health');
      console.log('✅ Health check HTTPS DEFINITIVO bem-sucedido:', response);
      
      return response;
    } catch (error: any) {
      console.error('❌ Health check HTTPS DEFINITIVO falhou:', error.message);
      
      if (error.message === 'SSL_CERTIFICATE_ERROR') {
        throw new Error('SSL_CERTIFICATE_NOT_ACCEPTED');
      } else if (error.message === 'TIMEOUT_ERROR') {
        throw new Error('SERVER_TIMEOUT');
      } else if (error.message === 'HTTPS_REQUIRED') {
        throw new Error('HTTPS_REQUIRED');
      }
      
      throw error;
    }
  }

  // Test connection with HTTPS DEFINITIVO
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Testando conexão HTTPS DEFINITIVO...');
      const health = await this.checkServerHealth();
      
      if (health && health.status === 'ok') {
        return {
          success: true,
          message: `✅ HTTPS DEFINITIVO funcionando! Servidor: ${health.server || 'HTTPS via Nginx'} | Versão: ${health.version || 'unknown'} | SSL: ✅`
        };
      } else {
        return {
          success: false,
          message: 'Servidor respondeu mas com status inválido'
        };
      }
    } catch (error: any) {
      console.error('❌ Teste HTTPS DEFINITIVO falhou:', error.message);
      
      if (error.message === 'SSL_CERTIFICATE_NOT_ACCEPTED') {
        return {
          success: false,
          message: 'Certificado SSL: Aceite o certificado abrindo https://146.59.227.248/health no navegador primeiro'
        };
      } else if (error.message === 'SERVER_TIMEOUT') {
        return {
          success: false,
          message: 'Timeout: Servidor não respondeu em 20 segundos'
        };
      } else if (error.message === 'HTTPS_REQUIRED') {
        return {
          success: false,
          message: 'HTTPS obrigatório: Sistema configurado para HTTPS via Nginx'
        };
      }
      
      return {
        success: false,
        message: `Erro HTTPS DEFINITIVO: ${error.message}`
      };
    }
  }
}

// Export singleton instance
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;

// Also export as named export for compatibility
export { whatsappService };
