
import { io, Socket } from 'socket.io-client';

// Configuração para produção - detecta automaticamente o ambiente
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    // No browser, usar o host atual
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:4000`;
  }
  // Fallback para desenvolvimento
  return 'http://localhost:4000';
};

const API_BASE_URL = `${getBaseURL()}/api`;
const SOCKET_URL = getBaseURL();

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
  private isProduction: boolean = false;

  constructor() {
    // Detectar ambiente de produção
    this.isProduction = typeof window !== 'undefined' && 
                       !window.location.hostname.includes('localhost');
  }

  // Conectar ao WebSocket com configuração para produção
  connectSocket(): Socket {
    if (!this.socket) {
      console.log(`🔌 Conectando ao WebSocket: ${SOCKET_URL}`);
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('✅ Conectado ao servidor WhatsApp Multi-Cliente');
        console.log(`📍 Ambiente: ${this.isProduction ? 'Produção' : 'Desenvolvimento'}`);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Desconectado do servidor WhatsApp:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Erro no WebSocket:', error);
      });
    }

    return this.socket;
  }

  // Desconectar WebSocket
  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Entrar no room de um cliente específico
  joinClientRoom(clientId: string) {
    if (this.socket) {
      this.socket.emit('join_client', clientId);
      console.log(`📱 Entrou no room do cliente: ${clientId}`);
    }
  }

  // Ouvir atualizações de status de um cliente
  onClientStatus(clientId: string, callback: (data: WhatsAppClient) => void) {
    if (this.socket) {
      this.socket.on(`client_status_${clientId}`, callback);
    }
  }

  // Ouvir mensagens de um cliente
  onClientMessage(clientId: string, callback: (message: MessageData) => void) {
    if (this.socket) {
      this.socket.on(`message_${clientId}`, callback);
    }
  }

  // Ouvir atualizações de todos os clientes
  onClientsUpdate(callback: (clients: WhatsAppClient[]) => void) {
    if (this.socket) {
      this.socket.on('clients_update', callback);
    }
  }

  // Remover listeners
  removeListener(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // API Calls
  async getAllClients(): Promise<WhatsAppClient[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar clientes');
      }
      
      return data.clients;
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      throw error;
    }
  }

  async connectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao conectar cliente');
      }
      
      return data;
    } catch (error) {
      console.error(`Erro ao conectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  async disconnectClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao desconectar cliente');
      }
      
      return data;
    } catch (error) {
      console.error(`Erro ao desconectar cliente ${clientId}:`, error);
      throw error;
    }
  }

  async getClientStatus(clientId: string): Promise<WhatsAppClient> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/status`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar status do cliente');
      }
      
      return {
        clientId: data.clientId,
        status: data.status,
        phoneNumber: data.phoneNumber,
        hasQrCode: !!data.qrCode,
        qrCode: data.qrCode
      };
    } catch (error) {
      console.error(`Erro ao buscar status do cliente ${clientId}:`, error);
      throw error;
    }
  }

  async sendMessage(clientId: string, to: string, message: string, mediaUrl?: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          message,
          mediaUrl
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }
      
      return data;
    } catch (error) {
      console.error(`Erro ao enviar mensagem:`, error);
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
      console.error(`Erro ao buscar chats:`, error);
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
      console.error(`Erro ao buscar mensagens:`, error);
      throw error;
    }
  }

  async checkServerHealth(): Promise<any> {
    try {
      const healthURL = `${getBaseURL()}/health`;
      console.log(`🔍 Verificando saúde do servidor: ${healthURL}`);
      
      const response = await fetch(healthURL);
      const data = await response.json();
      
      console.log('✅ Servidor saudável:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao verificar saúde do servidor:', error);
      throw error;
    }
  }

  // Método para testar conectividade
  async testConnection(): Promise<boolean> {
    try {
      await this.checkServerHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const whatsappService = new WhatsAppMultiClientService();

export default whatsappService;
