import io, { Socket } from 'socket.io-client';
import { SERVER_URL, API_BASE_URL, SOCKET_URL, HTTPS_SERVER_URL, getServerConfig } from '@/config/environment';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppClient {
  clientId: string;
  status: 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'disconnected' | 'auth_failed';
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
  timestamp?: string;
  qrTimestamp?: string;
}

export interface QueuedMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
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
  private reconnectInterval = 3000;
  private healthCheckCache: { result: any; timestamp: number } | null = null;

  constructor() {
    console.log('🔧 WhatsApp Service - SSL CORRIGIDO VIA NGINX');
    console.log('📊 Configuração:', getServerConfig());
  }

  // HTTPS connection test - CORRIGIDO para Nginx proxy
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Testando conexão via Nginx HTTPS:', API_BASE_URL);
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest' // Ajudar CORS
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Nginx HTTPS proxy funcionando:', data);
        return {
          success: true,
          message: `✅ NGINX HTTPS OK! Status: ${data.status} | Server: ${data.server} | Via Proxy: SIM`
        };
      } else {
        return {
          success: false,
          message: `❌ Nginx retornou HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      console.error('❌ Erro na conexão Nginx HTTPS:', error);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: '⏰ Timeout - Nginx não respondeu em 15 segundos'
        };
      } else if (error.message === 'Failed to fetch') {
        return {
          success: false,
          message: `🔒 Certificado SSL precisa ser aceito no navegador: ${API_BASE_URL}/health`
        };
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        return {
          success: false,
          message: `🔐 Problema SSL: Aceite o certificado em ${API_BASE_URL}/health`
        };
      } else {
        return {
          success: false,
          message: `❌ Erro Nginx: ${error.message}`
        };
      }
    }
  }

  // WebSocket connection - CORRIGIDO para usar Nginx proxy
  connectSocket(): Socket {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket já conectado via Nginx');
      return this.socket;
    }

    console.log('🔌 Conectando WebSocket via Nginx HTTPS:', SOCKET_URL);

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
        forceNew: false,
        upgrade: true,
        // Configurações para certificado autoassinado via Nginx
        rejectUnauthorized: false,
        secure: !SOCKET_URL.includes('localhost'),
        // Headers adicionais para CORS via Nginx
        extraHeaders: {
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': window.location.origin
        }
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket conectado via Nginx HTTPS!');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket Nginx desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket Nginx:', error.message);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('❌ Máximo de tentativas WebSocket Nginx atingido');
        }
      });

      return this.socket;
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket via Nginx:', error);
      throw error;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando WebSocket HTTPS...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // HTTPS API request - OTIMIZADO para Nginx proxy
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    console.log(`📡 Requisição via Nginx: ${options.method || 'GET'} ${fullUrl}`);
    
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
      
      console.log(`📡 Resposta Nginx: ${response.status} ${response.statusText}`);
      
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
      console.error(`❌ Erro na requisição Nginx para ${fullUrl}:`, error);
      throw error;
    }
  }

  // Health check - CORRIGIDO
  async checkServerHealth(): Promise<ServerHealth> {
    try {
      if (this.healthCheckCache && 
          Date.now() - this.healthCheckCache.timestamp < 10000) {
        console.log('📋 Usando cache do health check HTTPS');
        return this.healthCheckCache.result;
      }

      console.log('🔍 Health check HTTPS...');
      const response = await this.makeRequest('/health');
      
      this.healthCheckCache = {
        result: response,
        timestamp: Date.now()
      };
      
      console.log('✅ Health check HTTPS bem-sucedido:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Health check HTTPS falhou:', error.message);
      this.healthCheckCache = null;
      throw error;
    }
  }

  // Get all clients
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log('📋 Buscando clientes HTTPS...');
      const response = await this.makeRequest('/clients');
      
      if (response.success && Array.isArray(response.clients)) {
        console.log(`✅ ${response.clients.length} clientes encontrados via HTTPS`);
        return response.clients;
      } else {
        console.warn('⚠️ Resposta inválida HTTPS:', response);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao buscar clientes HTTPS:', error);
      throw error;
    }
  }

  // Connect client - CORRIGIDO
  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔗 Conectando cliente HTTPS: ${clientId}`);
      const response = await this.makeRequest(`/clients/${clientId}/connect`, {
        method: 'POST'
      });
      console.log(`✅ Cliente conectado HTTPS: ${clientId}`, response);
      return response;
    } catch (error: any) {
      console.error(`❌ Erro ao conectar cliente HTTPS ${clientId}:`, error.message);
      throw error;
    }
  }

  // Disconnect client
  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente HTTPS: ${clientId}`);
      return await this.makeRequest(`/clients/${clientId}/disconnect`, {
        method: 'POST'
      });
    } catch (error) {
      console.error(`❌ Erro ao desconectar cliente HTTPS ${clientId}:`, error);
      throw error;
    }
  }

  // Get client status - SIMPLIFICADO E DIRETO
  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      console.log(`📊 Status do cliente HTTPS: ${clientId}`);
      
      const response = await this.makeRequest(`/clients/${clientId}/status`);
      
      if (response.success) {
        const result = {
          clientId: response.clientId || clientId,
          status: response.status,
          phoneNumber: response.phoneNumber,
          hasQrCode: response.hasQrCode || false,
          qrCode: response.qrCode,
          qrTimestamp: response.qrExpiresAt
        };
        
        console.log(`✅ Status HTTPS obtido para ${clientId}:`, {
          status: result.status,
          hasQrCode: result.hasQrCode,
          phoneNumber: result.phoneNumber ? 'SIM' : 'NÃO'
        });
        
        return result;
      } else {
        throw new Error(response.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar status HTTPS do cliente ${clientId}:`, error);
      throw error;
    }
  }

  // WebSocket event handlers - CORRIGIDOS
  joinClientRoom(clientId: string): void {
    if (this.socket?.connected) {
      console.log(`📱 Entrando na sala HTTPS: ${clientId}`);
      this.socket.emit('join_client', clientId);
    } else {
      console.warn('⚠️ WebSocket HTTPS não conectado para entrar na sala');
    }
  }

  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void): void {
    if (!this.socket) {
      this.connectSocket();
    }
    
    const eventName = `client_status_${clientId}`;
    console.log(`👂 Ouvindo HTTPS: ${eventName}`);
    this.socket?.on(eventName, callback);
  }

  offClientStatus(clientId: string, callback?: (data: WhatsAppClient) => void): void {
    const eventName = `client_status_${clientId}`;
    console.log(`🔇 Removendo listener HTTPS: ${eventName}`);
    
    if (callback) {
      this.socket?.off(eventName, callback);
    } else {
      this.socket?.removeAllListeners(eventName);
    }
  }

  // Send message - CORRIGIDO para usar endpoint /api/
  async sendMessage(clientId: string, to: string, message: string): Promise<any> {
    try {
      console.log(`📤 Enviando mensagem HTTPS via ${clientId} para ${to}`);
      return await this.makeRequest(`/api/clients/${clientId}/send`, {
        method: 'POST',
        body: JSON.stringify({ to, message })
      });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem HTTPS:`, error);
      throw error;
    }
  }

  // Get chats - CORRIGIDO para usar endpoint /api/
  async getChats(clientId: string): Promise<any> {
    try {
      console.log(`💬 Buscando chats HTTPS: ${clientId}`);
      return await this.makeRequest(`/api/clients/${clientId}/chats`);
    } catch (error) {
      console.error(`❌ Erro ao buscar chats HTTPS:`, error);
      throw error;
    }
  }

  // Send media/files - Sistema completo para qualquer tipo de arquivo
  async sendMedia(clientId: string, to: string, file: File, caption?: string): Promise<any> {
    try {
      console.log(`📤 Enviando mídia HTTPS via ${clientId} para ${to}:`, {
        filename: file.name,
        size: file.size,
        type: file.type
      });
      
      const formData = new FormData();
      formData.append('to', to);
      formData.append('file', file);
      if (caption) {
        formData.append('caption', caption);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}/send-media`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(60000), // 60s para arquivos grandes
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': window.location.origin
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Mídia enviada com sucesso:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Erro ao enviar mídia HTTPS:`, error);
      throw error;
    }
  }

  // Send audio - Alias para compatibilidade
  async sendAudio(clientId: string, to: string, audioFile: File): Promise<any> {
    return this.sendMedia(clientId, to, audioFile);
  }
}

// Export singleton instance
const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
export { whatsappService };
