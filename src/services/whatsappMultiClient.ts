
import { io, Socket } from 'socket.io-client';
import { SERVER_URL, API_BASE_URL, SOCKET_URL } from '@/config/environment';

console.log(`🔗 WhatsApp Service - Conectando ao servidor: ${SERVER_URL}`);

export interface WhatsAppClient {
  clientId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'connected' | 'error' | 'auth_failed';
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
}

export interface ChatData {
  id: string;
  name: string;
  isGroup: boolean;
  isReadOnly: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage?: {
    body: string;
    type: string;
    timestamp: number;
    fromMe: boolean;
  };
}

export interface MessageData {
  id: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe: boolean;
  author?: string;
  from: string;
  to: string;
}

class WhatsAppMultiClientService {
  private socket: Socket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    console.log('🚀 Inicializando WhatsApp Multi-Client Service');
    console.log(`🎯 Servidor fixo: ${SERVER_URL}`);
  }

  // Conectar ao WebSocket
  connectSocket(): Socket {
    if (!this.socket) {
      console.log(`🔌 Conectando ao WebSocket: ${SOCKET_URL}`);
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000
      });

      this.socket.on('connect', () => {
        console.log(`✅ WebSocket conectado: ${SOCKET_URL}`);
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket:', error);
        this.reconnectAttempts++;
      });
    }

    return this.socket;
  }

  // Reconectar
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    setTimeout(() => {
      this.connectSocket();
    }, 1000);
  }

  // Desconectar
  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Entrar no room de um cliente
  joinClientRoom(clientId: string) {
    if (this.socket) {
      this.socket.emit('join_client', clientId);
      console.log(`📱 Room do cliente: ${clientId}`);
    }
  }

  // Listeners
  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void) {
    if (this.socket) {
      this.socket.on(`client_status_${clientId}`, callback);
    }
  }

  onClientMessage(clientId: string, callback: (message: MessageData) => void) {
    if (this.socket) {
      this.socket.on(`message_${clientId}`, callback);
    }
  }

  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void) {
    if (this.socket) {
      this.socket.on('clients_update', callback);
    }
  }

  removeListener(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // API Calls
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      console.log(`📡 GET ${API_BASE_URL}/clients`);
      
      const response = await fetch(`${API_BASE_URL}/clients`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar clientes');
      }
      
      console.log(`✅ ${data.clients.length} clientes encontrados`);
      return data.clients;
    } catch (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔗 Conectando cliente: ${clientId}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar cliente');
      }
      
      console.log(`✅ Cliente ${clientId} conectado`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao conectar ${clientId}:`, error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      console.log(`🔌 Desconectando cliente: ${clientId}`);
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao desconectar cliente');
      }
      
      console.log(`✅ Cliente ${clientId} desconectado`);
      return data;
    } catch (error) {
      console.error(`❌ Erro ao desconectar ${clientId}:`, error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/status`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar status');
      }
      
      return {
        clientId: data.clientId,
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: !!data.qrCode,
        qrCode: data.qrCode
      };
    } catch (error) {
      console.error(`❌ Erro status ${clientId}:`, error);
      throw error;
    }
  }

  async sendMessage(clientId: string, to: string, message: string, mediaUrl?: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message, mediaUrl })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async getChats(clientId: string): Promise<ChatData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/chats`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar chats');
      }
      
      return data.chats;
    } catch (error) {
      console.error('❌ Erro ao buscar chats:', error);
      throw error;
    }
  }

  async getChatMessages(clientId: string, chatId: string, limit: number = 50): Promise<MessageData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/chats/${chatId}/messages?limit=${limit}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar mensagens');
      }
      
      return data.messages;
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      throw error;
    }
  }

  async checkServerHealth(): Promise<any> {
    try {
      const healthURL = `${SERVER_URL}/health`;
      console.log(`🔍 Health check: ${healthURL}`);
      
      const response = await fetch(healthURL, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Servidor saudável:', data);
      return data;
    } catch (error) {
      console.error('❌ Health check falhou:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.checkServerHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton
export const whatsappService = new WhatsAppMultiClientService();
export default whatsappService;
